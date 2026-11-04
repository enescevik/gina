import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { contributionRow } from "@gina/core";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { SatinButton, u } from "@/components/planner/ui";
export function ContributionHistory() {
  const { t } = useTranslation(),
    { claims } = useSession(),
    cache = useQueryClient();
  const [confirm, setConfirm] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["contribution_sets", claims?.family_id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_question_contributions");
      if (error) throw error;
      return contributionRow.array().parse(data);
    },
  });
  const withdraw = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("withdraw_question_contribution", {
        p_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setConfirm(null);
      void cache.invalidateQueries({ queryKey: ["contribution_sets"] });
    },
  });
  if (list.isPending) return null;
  return (
    <View style={u.card}>
      <Text style={u.heading}>{t("contribution.history")}</Text>
      {list.error
        ? (
          <SatinButton
            secondary
            title={t("common.retry")}
            onPress={() => void list.refetch()}
          />
        )
        : !list.data?.length
        ? <Text style={u.copy}>{t("contribution.empty")}</Text>
        : list.data.map((row) => (
          <View key={row.id} style={{ gap: 8, paddingVertical: 12 }}>
            <Text style={u.heading}>{row.title}</Text>
            <Text style={u.copy}>
              {t(`contribution.status.${row.status}`)} ·{" "}
              {t("contribution.count", { count: row.question_count })}
            </Text>
            {row.review_note
              ? <Text style={u.copy}>{row.review_note}</Text>
              : null}
            {row.status === "preparing"
              ? (
                <SatinButton
                  secondary
                  title={t("setupRecovery.retry")}
                  onPress={() =>
                    router.push({
                      pathname: "/parent/prova/share",
                      params: { questionId: row.question_id },
                    })}
                />
              )
              : null}
            {["pending", "preparing", "rejected"].includes(row.status)
              ? (
                <SatinButton
                  secondary
                  title={t(
                    confirm === row.id
                      ? "contribution.withdrawConfirm"
                      : "contribution.withdraw",
                  )}
                  disabled={withdraw.isPending}
                  onPress={() =>
                    confirm === row.id
                      ? withdraw.mutate(row.id)
                      : setConfirm(row.id)}
                />
              )
              : null}
          </View>
        ))}
      {withdraw.error
        ? (
          <Text accessibilityRole="alert" style={u.error}>
            {t("contribution.errors.contribution_failed")}
          </Text>
        )
        : null}
    </View>
  );
}
