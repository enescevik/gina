import type { Enums, Tables } from "@gina/core";

/**
 * Web: satış yok (DECISIONS.md). Satın alma yalnız iOS/Android uygulamasında; web yetkiyi yalnız yansıtır.
 * iap.ts ile aynı dışa aktarımlar; expo-iap web paketine girmez.
 */

export const ANDROID_PACKAGE = "com.enescevik.gina";
export const iapSupported = false;

export type PlanProduct = Tables<"plan_products">;

export interface StoreOffer {
  productId: string;
  plan: Enums<"plan_code">;
  period: Enums<"billing_period">;
  sku: string;
  displayPrice: string;
  offerToken: string | null;
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

export interface CurrentStoreSub {
  platform: Enums<"store_platform">;
  product_id: string;
  store_key: string;
}

const unsupported = () => Promise.reject(new Error("iap_unsupported_on_web"));

export const connectStore = (): Promise<boolean> => Promise.resolve(false);
export function useIapObserver(_onEvent?: (e: IapEvent) => void) {}
export const verifyPurchase = (): Promise<VerifyResult> => unsupported();
export const loadStoreOffers = (_rows: PlanProduct[]): Promise<StoreOffer[]> => Promise.resolve([]);
export const buySubscription = (
  _offer: StoreOffer,
  _opts: { familyId: string; current?: CurrentStoreSub | null; currentAndroidSku?: string | null; upgrade?: boolean },
): Promise<void> => unsupported();
export const restoreStorePurchases = (_rows: PlanProduct[]): Promise<VerifyResult[]> => Promise.resolve([]);
export const openManageSubscriptions = (_androidSku?: string | null): Promise<void> => unsupported();
export const openRedeemCode = (): Promise<void> => unsupported();
