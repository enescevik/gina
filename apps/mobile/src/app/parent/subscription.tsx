import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Platform, Pressable, Text, View } from "react-native";

import type { Enums, Json } from "@gina/core";

import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import {
  buySubscription,
  iapSupported,
  loadStoreOffers,
  openManageSubscriptions,
  openRedeemCode,
  restoreStorePurchases,
  useIapObserver,
  type IapEvent,
  type StoreOffer,
} from "@/lib/iap";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type PlanCode = Enums<"plan_code">;
type Period = Enums<"billing_period">;

const PLAN_RANK: Record<PlanCode, number> = { free: 0, plus: 1, pro: 2 };
/** Apple standart EULA (DECISIONS.md: özel EULA yok). */
const APPLE_EULA_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
/** Yayındaki hukuki sayfaların kökü (Cloudflare); tanımlı değilse bağlantılar gizlenir. */
const LEGAL_BASE_URL = process.env.EXPO_PUBLIC_LEGAL_BASE_URL;

function i18nText(j: Json | null, lang: string): string {
  if (j && typeof j === "object" && !Array.isArray(j)) {
    const map = j as Record<string, Json | undefined>;
    const hit = map[lang] ?? map.en ?? Object.values(map)[0];
    if (typeof hit === "string") return hit;
  }
  return "";
}

type Notice = { tone: "ok" | "warn" | "error"; text: string } | null;

/**
 * Paketler, ailenin etkin yetkisi ve mağaza satın alma (expo-iap). Yetki tek kaynaktan
 * (get_family_entitlement) okunur; satın alma sunucuda doğrulanınca yenilenir. Yalnız veli satın alır;
 * webde satış yok.
 */
export default function SubscriptionScreen() {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const isParent = claims?.role === "parent" && !!familyId;
  const canBuy = iapSupported && isParent;

  const [period, setPeriod] = useState<Period>("yearly");
  const [notice, setNotice] = useState<Notice>(null);

  const plans = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const entitlement = useQuery({
    queryKey: ["entitlement"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_family_entitlement");
      if (error) throw error;
      return data[0] ?? null;
    },
  });

  const planProducts = useQuery({
    queryKey: ["plan_products"],
    enabled: isParent,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_products").select("*").eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Ailenin yetki veren mağaza aboneliği (RLS: yalnız kendi ailesi, yalnız veli).
  const storeSub = useQuery({
    queryKey: ["store_subscriptions", familyId],
    enabled: isParent,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_subscriptions")
        .select("platform, product_id, plan, status, expires_at, auto_renewing, store_key")
        .in("status", ["active", "grace", "on_hold"])
        .gt("expires_at", new Date(Date.now() - 60 * 86400_000).toISOString())
        .order("expires_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data[0] ?? null;
    },
  });

  const offers = useQuery({
    queryKey: ["store_offers", Platform.OS, planProducts.data?.map((p) => p.product_id).join(",")],
    enabled: canBuy && !!planProducts.data,
    staleTime: 30 * 60 * 1000,
    retry: false,
    queryFn: () => loadStoreOffers(planProducts.data ?? []),
  });

  useIapObserver((e: IapEvent) => {
    if (e.type === "verified") {
      const plan = plans.data?.find((p) => p.code === e.result.plan);
      setNotice({ tone: "ok", text: t("iap.success", { plan: plan ? i18nText(plan.name_i18n, i18n.language) : e.result.plan }) });
    } else if (e.type === "pending") setNotice({ tone: "warn", text: t("iap.pending") });
    else if (e.type === "error") setNotice({ tone: "error", text: errorText(e.code) });
    else setNotice(null);
  });

  function errorText(code: string): string {
    const known = ["account_mismatch", "store_not_configured", "network_error", "store_unavailable", "invalid_jws", "product_mismatch"];
    return known.includes(code) ? t(`iap.error.${code}`) : t("iap.error.generic");
  }

  const myStorePlatform = Platform.OS === "ios" ? "apple" : "google";
  const current: PlanCode = entitlement.data?.plan ?? "free";
  const sub = storeSub.data;
  const subOnOtherStore = !!sub && sub.platform !== myStorePlatform;
  const currentAndroidSku = sub ? (planProducts.data?.find((p) => p.product_id === sub.product_id)?.android_product_id ?? null) : null;
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long", year: "numeric" });

  const buy = useMutation({
    mutationFn: async (offer: StoreOffer) => {
      setNotice(null);
      const currentRank = sub ? PLAN_RANK[sub.plan] : 0;
      const upgrade = PLAN_RANK[offer.plan] > currentRank || (PLAN_RANK[offer.plan] === currentRank && offer.period === "yearly");
      await buySubscription(offer, { familyId, current: sub, currentAndroidSku, upgrade });
    },
    onError: (e) => setNotice({ tone: "error", text: errorText(e instanceof Error ? e.message : "purchase_error") }),
  });

  const restore = useMutation({
    mutationFn: () => restoreStorePurchases(planProducts.data ?? []),
    onMutate: () => setNotice(null),
    onSuccess: (results) => {
      const ok = results.filter((r) => r.ok).length;
      if (ok > 0) setNotice({ tone: "ok", text: t("iap.restoreDone", { count: ok }) });
      else if (results.length === 0) setNotice({ tone: "warn", text: t("iap.restoreNone") });
      // Hatalar dinleyiciden ayrıca bildirilir.
    },
    onError: () => setNotice({ tone: "error", text: t("iap.error.store_unavailable") }),
  });

  const manage = useMutation({ mutationFn: () => openManageSubscriptions(currentAndroidSku) });
  const redeem = useMutation({ mutationFn: () => openRedeemCode() });

  return (
    <Screen title={t("subscription.title")}>
      {entitlement.data?.source === "comp" ? (
        <Text className="font-body rounded-parent bg-star/20 p-3 text-sm text-ink">{t("subscription.compNote")}</Text>
      ) : null}

      {sub && isParent ? (
        <View className="gap-1 rounded-parent bg-teal-light p-3">
          {sub.status === "grace" ? (
            <Text className="text-sm font-body-bold text-ink">{t("iap.status.grace", { date: dateFormat.format(new Date(sub.expires_at)) })}</Text>
          ) : sub.status === "on_hold" ? (
            <Text className="text-sm font-body-bold text-ink">{t("iap.status.onHold")}</Text>
          ) : (
            <Text className="font-body text-sm text-ink">
              {sub.auto_renewing
                ? t("iap.renewsOn", { date: dateFormat.format(new Date(sub.expires_at)) })
                : t("iap.endsOn", { date: dateFormat.format(new Date(sub.expires_at)) })}
            </Text>
          )}
          {subOnOtherStore || !iapSupported ? (
            <Text className="font-body text-xs text-ink">{t("iap.otherStore", { store: t(`iap.store.${sub.platform}`) })}</Text>
          ) : null}
        </View>
      ) : null}

      {!iapSupported ? (
        <Text className="font-body rounded-parent bg-mist p-3 text-sm text-ink">{t("iap.webNote")}</Text>
      ) : !isParent ? (
        <Text className="font-body rounded-parent bg-mist p-3 text-sm text-ink">{t("iap.parentOnly")}</Text>
      ) : (
        <View className="flex-row gap-2 self-start rounded-full bg-mist p-1" accessibilityRole="tablist">
          {(["monthly", "yearly"] as const).map((p) => (
            <Pressable
              key={p}
              accessibilityRole="tab"
              accessibilityState={{ selected: period === p }}
              onPress={() => setPeriod(p)}
              className={`rounded-full px-4 py-2 ${period === p ? "bg-white dark:bg-night-surface" : ""}`}
            >
              <Text className="text-sm font-body-bold text-ink dark:text-night-text">{t(`iap.${p}`)}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {plans.data?.map((plan) => {
        const isCurrent = plan.code === current;
        const features: string[] = [
          t("subscription.children", { count: plan.max_children }),
          plan.max_devices === null ? t("subscription.devicesUnlimited") : t("subscription.devices", { count: plan.max_devices }),
          plan.max_active_tasks_per_child === null
            ? t("subscription.tasksUnlimited")
            : t("subscription.tasksLimited", { count: plan.max_active_tasks_per_child }),
          plan.history_days === null ? t("subscription.historyUnlimited") : t("subscription.historyDays", { count: plan.history_days }),
          plan.ai_weekly ? t("subscription.aiWeekly") : t("subscription.aiNone"),
        ];
        const offer = offers.data?.find((o) => o.plan === plan.code && o.period === period);
        const ownsThis = !!sub && sub.product_id === offer?.productId && sub.status !== "on_hold";
        return (
          <View
            key={plan.code}
            className={`gap-2 rounded-parent border-2 p-4 ${isCurrent ? "border-teal bg-teal-light" : "border-mist bg-white dark:bg-night-surface"}`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-body-bold text-ink">{i18nText(plan.name_i18n, i18n.language)}</Text>
              {isCurrent ? <Text className="rounded-full bg-teal px-3 py-1 text-xs font-body-bold text-white">{t("subscription.current")}</Text> : null}
            </View>
            {features.map((feature) => (
              <Text key={feature} className="font-body text-sm text-ink dark:text-night-text">
                • {feature}
              </Text>
            ))}
            {plan.code !== "free" && canBuy ? (
              offer ? (
                <View className="gap-2">
                  <Text className="text-base font-body-bold text-ink dark:text-night-text">
                    {t(period === "monthly" ? "iap.pricePerMonth" : "iap.pricePerYear", { price: offer.displayPrice })}
                  </Text>
                  {offer.hasTrial && !sub ? <Text className="font-body text-sm text-teal-dark">{t("iap.trial")}</Text> : null}
                  {ownsThis ? (
                    <Text className="font-body text-sm text-ink dark:text-night-text">{t("iap.currentProduct")}</Text>
                  ) : (
                    <Button
                      title={sub ? t("iap.change") : t("iap.buy")}
                      variant={isCurrent ? "secondary" : "primary"}
                      disabled={subOnOtherStore || buy.isPending}
                      loading={buy.isPending && buy.variables?.productId === offer.productId}
                      onPress={() => buy.mutate(offer)}
                    />
                  )}
                </View>
              ) : (
                <Text className="font-body text-xs text-gray-500">{offers.isLoading ? t("iap.loadingPrices") : t("iap.priceUnavailable")}</Text>
              )
            ) : null}
          </View>
        );
      })}

      {notice ? (
        <Text
          accessibilityLiveRegion="polite"
          className={`font-body rounded-parent p-3 text-sm ${notice.tone === "ok" ? "bg-teal-light text-ink" : notice.tone === "warn" ? "bg-star/20 text-ink" : "bg-coral-light text-danger"}`}
        >
          {notice.text}
        </Text>
      ) : null}

      {canBuy ? (
        <View className="gap-2">
          <Button variant="secondary" title={t("iap.restore")} loading={restore.isPending} onPress={() => restore.mutate()} />
          {sub && !subOnOtherStore ? (
            <Button variant="secondary" title={t("iap.manage")} onPress={() => manage.mutate()} />
          ) : null}
          <Button
            variant="ghost"
            title={Platform.OS === "ios" ? t("iap.redeemIos") : t("iap.redeemAndroid")}
            onPress={() => redeem.mutate()}
          />
        </View>
      ) : null}

      <Text className="font-body text-xs text-gray-500">{iapSupported ? t("iap.legal") : t("subscription.storeNote")}</Text>
      {canBuy ? (
        <View className="flex-row flex-wrap gap-4">
          {Platform.OS === "ios" ? (
            <Text className="font-body text-xs text-teal-dark underline" accessibilityRole="link" onPress={() => void Linking.openURL(APPLE_EULA_URL)}>
              {t("iap.eula")}
            </Text>
          ) : null}
          {LEGAL_BASE_URL ? (
            <>
              <Text
                className="font-body text-xs text-teal-dark underline"
                accessibilityRole="link"
                onPress={() => void Linking.openURL(`${LEGAL_BASE_URL}/legal/abonelik-kosullari`)}
              >
                {t("iap.subscriptionTerms")}
              </Text>
              <Text
                className="font-body text-xs text-teal-dark underline"
                accessibilityRole="link"
                onPress={() => void Linking.openURL(`${LEGAL_BASE_URL}/legal/gizlilik-politikasi`)}
              >
                {t("iap.privacy")}
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

      <ErrorText error={plans.error ?? entitlement.error ?? planProducts.error ?? storeSub.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
