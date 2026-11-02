import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { FlaskConical, Check } from "lucide-react-native";
import type { Enums } from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { SatinButton, p, u } from "@/components/planner/ui";
import { Pressable } from "@/components/ui/pressable";

export function BetaPlans() {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const cache = useQueryClient();
  const access = useQuery({
    queryKey: ["beta_access", claims?.family_id],
    enabled: claims?.role === "parent",
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_beta_test_access");
      if (error) throw error;
      return data[0] ?? null;
    },
  });
  const change = useMutation({
    mutationFn: async (plan: Enums<"plan_code"> | null) => {
      const { error } = await supabase.rpc("set_beta_test_plan", {
        p_plan: plan,
      });
      if (error) throw error;
    },
    onSuccess: () => cache.invalidateQueries(),
  });
  if (!access.data) return null;
  return (
    <View style={[u.card, { backgroundColor: p.lilac, gap: 14 }]}>
      <View style={u.row}>
        <FlaskConical color={p.purple} size={26} />
        <Text style={u.heading}>{t("betaUx.testPlans")}</Text>
      </View>
      <Text style={u.copy}>{t("betaUx.testPlansBody")}</Text>
      <View style={[u.row, { flexWrap: "wrap" }]}>
        {(["free", "plus", "pro"] as const).map((plan) => (
          <Pressable
            key={plan}
            accessibilityRole="button"
            accessibilityState={{
              selected: access.data?.selected_plan === plan,
              disabled: change.isPending,
            }}
            disabled={change.isPending}
            onPress={() => change.mutate(plan)}
            style={{
              minHeight: 56,
              minWidth: 90,
              flex: 1,
              padding: 12,
              borderRadius: 18,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor:
                access.data?.selected_plan === plan ? p.purple : "#fff",
            }}
          >
            {access.data?.selected_plan === plan && (
              <Check size={18} color="#fff" />
            )}
            <Text
              style={[
                u.bold,
                { color: access.data?.selected_plan === plan ? "#fff" : p.ink },
              ]}
            >
              {t(`betaUx.plan.${plan}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={u.small}>
        {t("betaUx.testExpires", {
          date: new Intl.DateTimeFormat(i18n.language).format(
            new Date(access.data.expires_at),
          ),
        })}
      </Text>
      {access.data.selected_plan && (
        <SatinButton
          secondary
          title={t("betaUx.endTest")}
          disabled={change.isPending}
          onPress={() => change.mutate(null)}
        />
      )}
      {change.error && (
        <Text accessibilityRole="alert" style={u.error}>
          {t("betaUx.testError")}
        </Text>
      )}
      {change.isSuccess && (
        <Text accessibilityLiveRegion="polite" style={u.small}>
          {t("betaUx.testSaved")}
        </Text>
      )}
    </View>
  );
}
