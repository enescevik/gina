import { useEffect, useRef } from "react";
import { Linking, Platform } from "react-native";
import {
  deepLinkToSubscriptions,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isUserCancelledError,
  openRedeemOfferCode,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type ProductSubscription,
  type Purchase,
} from "expo-iap";

import type { Enums, Tables } from "@gina/core";

import { queryClient } from "./query";
import { supabase } from "./supabase";

/**
 * Uygulama içi satın alma (DECISIONS.md): yalnız Apple StoreKit 2 ve Google Play Billing, expo-iap ile.
 * Yetki ailenindir ve tek kaynağı Supabase'dir: her satın alma iap-verify'a gider, sunucu
 * doğrulayıp store_subscriptions'a yazdıktan SONRA finishTransaction çağrılır.
 * appAccountToken (iOS) / obfuscatedAccountId (Android) = family_id: sunucu işlemi aileye eşler.
 * Web: iap.web.ts (satış yok).
 */

export const ANDROID_PACKAGE = "com.enescevik.gina";
export const iapSupported = Platform.OS === "ios" || Platform.OS === "android";

export type PlanProduct = Tables<"plan_products">;

export interface StoreOffer {
  /** Kanonik ürün kimliği (plan_products.product_id): gina_plus_monthly ... */
  productId: string;
  plan: Enums<"plan_code">;
  period: Enums<"billing_period">;
  /** Mağazadaki kimlik: iOS'ta productId, Android'de abonelik (gina_plus / gina_pro). */
  sku: string;
  /** Mağazanın yerelleştirilmiş fiyat metni (yenileme fiyatı). */
  displayPrice: string;
  /** Android: base plan / teklif token'ı (zorunlu). */
  offerToken: string | null;
  /** Ücretsiz deneme teklifi kullanıcıya açık mı (Android'de teklif listesinden, iOS'ta intro offer). */
  hasTrial: boolean;
}

export interface VerifyOk {
  ok: true;
  plan: Enums<"plan_code">;
  status: Enums<"subscription_status">;
  product_id: string;
  expires_at: string;
}

export type VerifyResult = VerifyOk | { ok: false; pending: true } | { ok: false; code: string };

export type IapEvent =
  | { type: "verified"; result: VerifyOk }
  | { type: "pending" }
  | { type: "cancelled" }
  | { type: "error"; code: string };

// Bağlantı ve tek dinleyici ----------------------------------------------------------------

let connecting: Promise<boolean> | null = null;
let observing = false;
const subscribers = new Set<(e: IapEvent) => void>();
const inFlight = new Set<string>();

function emit(e: IapEvent) {
  for (const fn of subscribers) fn(e);
}

export function connectStore(): Promise<boolean> {
  if (!iapSupported) return Promise.resolve(false);
  connecting ??= initConnection().catch((e: unknown) => {
    connecting = null;
    throw e;
  });
  return connecting;
}

/**
 * Uygulama boyunca tek purchaseUpdated/purchaseError dinleyicisi. iOS bitirilmemiş işlemleri her
 * açılışta yeniden yayınlar; bu yüzden dinleyici kaldırılmaz (sunucu idempotent).
 */
function ensureObserver() {
  if (observing || !iapSupported) return;
  observing = true;
  purchaseUpdatedListener((purchase) => {
    void handlePurchase(purchase);
  });
  purchaseErrorListener((error) => {
    emit(isUserCancelledError(error) ? { type: "cancelled" } : { type: "error", code: String(error.code ?? "purchase_error") });
  });
}

/** Ekran (veya veli düzeni) mount olduğunda mağaza bağlantısını ve dinleyiciyi açar. */
export function useIapObserver(onEvent?: (e: IapEvent) => void) {
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  });
  useEffect(() => {
    if (!iapSupported) return;
    ensureObserver();
    void connectStore().catch(() => emit({ type: "error", code: "store_unavailable" }));
    const fn = (e: IapEvent) => handler.current?.(e);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);
}

// Sunucu doğrulaması --------------------------------------------------------------------------

async function errorCode(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      // gövde JSON değil
    }
    return `http_${ctx.status}`;
  }
  return "network_error";
}

/** Satın almayı iap-verify'a gönderir (iOS: imzalı JWS, Android: purchaseToken). */
export async function verifyPurchase(purchase: Purchase): Promise<VerifyResult> {
  const token = purchase.purchaseToken;
  if (!token) return { ok: false, code: "missing_token" };
  const body =
    Platform.OS === "ios"
      ? { platform: "apple", signedTransaction: token }
      : { platform: "google", purchaseToken: token, productId: purchase.productId };
  const { data, error } = await supabase.functions.invoke<VerifyOk | { ok: false; pending: true }>("iap-verify", { body });
  if (error) return { ok: false, code: await errorCode(error) };
  if (!data) return { ok: false, code: "empty_response" };
  return data;
}

function invalidateEntitlement() {
  void queryClient.invalidateQueries({ queryKey: ["entitlement"] });
  void queryClient.invalidateQueries({ queryKey: ["store_subscriptions"] });
}

/** Doğrula → sunucu onaylarsa bitir. Onaylanmayan işlem bitirilmez (mağaza yeniden dener / geri yüklenir). */
async function handlePurchase(purchase: Purchase): Promise<VerifyResult | null> {
  if (purchase.purchaseState === "pending") {
    emit({ type: "pending" });
    return { ok: false, pending: true };
  }
  if (purchase.purchaseState !== "purchased") return null;
  const key = purchase.purchaseToken ?? purchase.id;
  if (inFlight.has(key)) return null;
  inFlight.add(key);
  try {
    const result = await verifyPurchase(purchase);
    if (result.ok) {
      try {
        await finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Android'de sunucu zaten onayladı (acknowledge); tekrar onay hatası yetkiyi etkilemez.
      }
      invalidateEntitlement();
      emit({ type: "verified", result });
    } else if ("pending" in result) {
      emit({ type: "pending" });
    } else {
      emit({ type: "error", code: result.code });
    }
    return result;
  } finally {
    inFlight.delete(key);
  }
}

// Ürünler -------------------------------------------------------------------------------------

/** Android'de yenileme fiyatı: sonsuz tekrarlı (recurrenceMode 1) faz; yoksa son faz. */
function androidRecurringPrice(offer: NonNullable<ProductSubscription["subscriptionOffers"]>[number]): string | null {
  const phases = offer.pricingPhasesAndroid?.pricingPhaseList ?? [];
  const recurring = phases.find((p) => p.recurrenceMode === 1) ?? phases[phases.length - 1];
  return recurring?.formattedPrice ?? null;
}

/** plan_products satırlarını mağazadaki ürünlerle eşler; mağazada bulunmayan ürün listelenmez. */
export async function loadStoreOffers(rows: PlanProduct[]): Promise<StoreOffer[]> {
  if (!iapSupported) return [];
  await connectStore();
  const active = rows.filter((r) => r.active && (r.platform === null || r.platform === (Platform.OS === "ios" ? "apple" : "google")));

  if (Platform.OS === "ios") {
    const products = ((await fetchProducts({ skus: active.map((r) => r.product_id), type: "subs" })) ?? []) as ProductSubscription[];
    return active.flatMap((row) => {
      const p = products.find((x) => x.id === row.product_id);
      if (!p || p.platform !== "ios") return [];
      return [
        {
          productId: row.product_id,
          plan: row.plan,
          period: row.period,
          sku: p.id,
          displayPrice: p.displayPrice,
          offerToken: null,
          hasTrial: p.introductoryPricePaymentModeIOS === "free-trial",
        },
      ];
    });
  }

  const android = active.filter((r) => r.android_product_id && r.android_base_plan_id);
  const skus = [...new Set(android.map((r) => r.android_product_id as string))];
  if (skus.length === 0) return [];
  const products = ((await fetchProducts({ skus, type: "subs" })) ?? []) as ProductSubscription[];
  return android.flatMap((row) => {
    const p = products.find((x) => x.id === row.android_product_id);
    if (!p || p.platform !== "android") return [];
    const offers = (p.subscriptionOffers ?? []).filter((o) => o.basePlanIdAndroid === row.android_base_plan_id);
    // Play yalnız kullanıcının uygun olduğu teklifleri döndürür: deneme varsa onu, yoksa base plan.
    const trial = row.android_offer_id ? offers.find((o) => o.id === row.android_offer_id) : undefined;
    const chosen = trial ?? offers.find((o) => o.id === row.android_base_plan_id || !o.offerTagsAndroid?.length) ?? offers[0];
    if (!chosen?.offerTokenAndroid) return [];
    return [
      {
        productId: row.product_id,
        plan: row.plan,
        period: row.period,
        sku: p.id,
        displayPrice: androidRecurringPrice(chosen) ?? chosen.displayPrice,
        offerToken: chosen.offerTokenAndroid,
        hasTrial: !!trial,
      },
    ];
  });
}

// Satın alma ----------------------------------------------------------------------------------

export interface CurrentStoreSub {
  platform: Enums<"store_platform">;
  product_id: string;
  store_key: string;
}

/**
 * Abonelik satın alma akışını başlatır; sonuç dinleyiciden (useIapObserver) gelir.
 * Android'de mevcut Play aboneliği varsa plan değişimi olarak (replacement) istenir; iOS'ta aynı
 * abonelik grubunda Apple yükseltme/düşürmeyi kendisi yönetir.
 */
export async function buySubscription(
  offer: StoreOffer,
  opts: { familyId: string; current?: CurrentStoreSub | null; currentAndroidSku?: string | null; upgrade?: boolean },
): Promise<void> {
  await connectStore();
  ensureObserver();
  if (Platform.OS === "ios") {
    await requestPurchase({
      type: "subs",
      request: { apple: { sku: offer.sku, appAccountToken: opts.familyId } },
    });
    return;
  }
  if (!offer.offerToken) throw new Error("offer_unavailable");
  const replace = opts.current?.platform === "google" && opts.currentAndroidSku ? opts.current : null;
  await requestPurchase({
    type: "subs",
    request: {
      google: {
        skus: [offer.sku],
        subscriptionOffers: [{ sku: offer.sku, offerToken: offer.offerToken }],
        obfuscatedAccountId: opts.familyId,
        ...(replace
          ? {
              purchaseToken: replace.store_key,
              subscriptionProductReplacementParams: {
                oldProductId: opts.currentAndroidSku as string,
                replacementMode: opts.upgrade ? "with-time-proration" : "deferred",
              },
            }
          : {}),
      },
    },
  });
}

/**
 * Satın almaları geri yükler: mağazanın bildiği aktif abonelikleri sunucuya yeniden doğrulatır.
 * Dönen dizi her abonelik için sunucu sonucudur.
 */
export async function restoreStorePurchases(rows: PlanProduct[]): Promise<VerifyResult[]> {
  if (!iapSupported) return [];
  await connectStore();
  ensureObserver();
  await restorePurchases();
  const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
  const skus = new Set(
    rows.flatMap((r) => (Platform.OS === "ios" ? [r.product_id] : r.android_product_id ? [r.android_product_id] : [])),
  );
  const results: VerifyResult[] = [];
  for (const p of purchases) {
    if (!skus.has(p.productId)) continue;
    const r = await handlePurchase(p);
    if (r) results.push(r);
  }
  return results;
}

/** Mağazanın abonelik yönetim ekranı (iptal, plan değişimi, ödeme yöntemi). */
export async function openManageSubscriptions(androidSku?: string | null): Promise<void> {
  if (Platform.OS === "android" && !androidSku) {
    await Linking.openURL(`https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE}`);
    return;
  }
  await deepLinkToSubscriptions({ skuAndroid: androidSku ?? undefined, packageNameAndroid: ANDROID_PACKAGE });
}

/**
 * Kampanya kodu: iOS'ta sistemin Offer Code sayfası, Android'de Play Store'un kod kullanma sayfası.
 * Uygulama kendi kod girişini SUNMAZ (Apple 3.1.1). Kullanılan kodun aboneliği dinleyiciden gelir;
 * gelmezse geri yükleme ile eşlenir.
 */
export async function openRedeemCode(): Promise<void> {
  if (Platform.OS === "ios") {
    await connectStore();
    ensureObserver();
    const purchase = await openRedeemOfferCode();
    if (purchase) await handlePurchase(purchase);
    return;
  }
  await Linking.openURL("https://play.google.com/redeem");
}
