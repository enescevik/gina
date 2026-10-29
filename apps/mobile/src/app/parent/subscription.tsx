import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import type { Enums, Json } from "@gina/core";

import { Button } from "@/components/ui/button";
import { ErrorText, Screen } from "@/components/ui/screen";
import { supabase } from "@/lib/supabase";

type PlanCode = Enums<"plan_code">;

function i18nText(j: Json | null, lang: string): string {
  if (j && typeof j === "object" && !Array.isArray(j)) {
    const map = j as Record<string, Json | undefined>;
    const hit = map[lang] ?? map.en ?? Object.values(map)[0];
    if (typeof hit === "string") return hit;
  }
  return "";
}

/** Paketler ve ailenin etkin yetkisi. Satın alma Faz 2'de expo-iap ile açılır. */
export default function SubscriptionScreen() {
  const { t, i18n } = useTranslation();

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

  const current: PlanCode = entitlement.data?.plan ?? "free";

  return (
    <Screen title={t("subscription.title")}>
      {entitlement.data?.source === "comp" ? (
        <Text className="rounded-parent bg-star/20 p-3 text-sm text-ink">{t("subscription.compNote")}</Text>
      ) : null}
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
        return (
          <View
            key={plan.code}
            className={`gap-2 rounded-parent border-2 p-4 ${isCurrent ? "border-teal bg-teal-light" : "border-mist bg-white dark:bg-night-surface"}`}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-ink">{i18nText(plan.name_i18n, i18n.language)}</Text>
              {isCurrent ? <Text className="rounded-full bg-teal px-3 py-1 text-xs font-semibold text-white">{t("subscription.current")}</Text> : null}
            </View>
            {features.map((feature) => (
              <Text key={feature} className="text-sm text-ink dark:text-night-text">
                • {feature}
              </Text>
            ))}
            {plan.code !== "free" && !isCurrent ? (
              <Button variant="secondary" title={t("subscription.comingSoon")} disabled />
            ) : null}
          </View>
        );
      })}
      <Text className="text-xs text-gray-500">{t("subscription.storeNote")}</Text>
      <ErrorText error={plans.error ?? entitlement.error} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
