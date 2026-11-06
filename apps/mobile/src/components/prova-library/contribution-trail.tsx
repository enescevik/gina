import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { History } from "lucide-react-native";
import {
  canSupersede,
  type ContributionTrail,
  contributionRow,
  contributionTrailSchema,
} from "@gina/core";
import { p, SatinButton, u } from "@/components/planner/ui";
import { useFamilyTimezone } from "@/lib/family";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const MAX_CHAINS = 15;

/** Known server codes of the correction flow; anything else becomes a calm generic message. */
export const trailErrorCodes = [
  "contribution_unchanged",
  "contribution_supersede_invalid",
  "contribution_supersede_taken",
  "request_conflict",
  "contribution_not_found",
] as const;
export function trailErrorKey(error: unknown) {
  const code = (error as { message?: string } | null)?.message ?? "";
  return (trailErrorCodes as readonly string[]).includes(code)
    ? `contributionTrail.errors.${code}`
    : null;
}

export function useContributionChains() {
  const { claims } = useSession();
  return useQuery({
    // Shares the "contribution_sets" prefix so withdraw/submit invalidations refresh it.
    queryKey: ["contribution_sets", "chains", claims?.family_id],
    enabled: !!claims?.family_id,
    queryFn: async () => {
      const list = await supabase.rpc("list_question_contributions");
      if (list.error) throw list.error;
      const rows = contributionRow.array().parse(list.data);
      const seen = new Set<string>();
      const chains: ContributionTrail[] = [];
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        if (chains.length >= MAX_CHAINS) break;
        const { data, error } = await supabase.rpc("contribution_review_trail", { p_id: row.id });
        if (error) throw error;
        const trail = contributionTrailSchema.parse(data);
        for (const step of trail.steps) seen.add(step.id);
        chains.push(trail);
      }
      return {
        chains,
        truncated: rows.some((r) => !seen.has(r.id)),
        rows: new Map(rows.map((r) => [r.id, r])),
      };
    },
  });
}

export function ContributionChains() {
  const { t, i18n } = useTranslation();
  const timeZone = useFamilyTimezone();
  const chains = useContributionChains();
  const date = (s: string) =>
    new Date(s).toLocaleString(i18n.language, {
      timeZone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <View style={{ gap: 16 }} testID="contribution-chains">
      <View style={u.row}>
        <History size={26} color={p.purple} />
        <Text accessibilityRole="header" style={[u.heading, { flex: 1 }]}>
          {t("contributionTrail.title")}
        </Text>
      </View>
      <Text style={u.copy}>{t("contributionTrail.help")}</Text>
      {chains.isPending
        ? <Text style={u.copy}>{t("common.loading")}</Text>
        : chains.error
        ? (
          <View style={u.card}>
            <Text accessibilityRole="alert" style={u.error}>{t("contributionTrail.failed")}</Text>
            <SatinButton secondary title={t("common.retry")} onPress={() => void chains.refetch()} />
          </View>
        )
        : !chains.data.chains.length
        ? (
          <View style={u.card}>
            <Text style={u.copy}>{t("contributionTrail.empty")}</Text>
          </View>
        )
        : chains.data.chains.map((chain) => {
          const latest = chain.steps[chain.steps.length - 1];
          const grouped = chain.steps.some((s) => s.question_count > 1);
          return (
            <View key={chain.chain_id} style={u.card} testID="contribution-chain">
              <Text style={u.heading}>{latest?.title ?? t("contribution.title")}</Text>
              {grouped
                ? (
                  <Text style={u.copy}>
                    {t("contributionTrail.grouped", { count: latest?.question_count ?? 0 })}
                  </Text>
                )
                : null}
              {chain.steps.map((step) => {
                const row = chains.data.rows.get(step.id);
                const fixable = canSupersede(step.id, chain) && step.status === "rejected";
                const taken = step.status === "rejected" &&
                  chain.steps.some((s) => s.supersedes_id === step.id && s.status !== "withdrawn");
                return (
                  <View
                    key={step.id}
                    testID="contribution-step"
                    style={{
                      gap: 6,
                      padding: 14,
                      borderRadius: 18,
                      backgroundColor: step.status === "rejected"
                        ? "#FFF1DD"
                        : step.status === "approved"
                        ? "#EAF8F2"
                        : "#F7F5FA",
                    }}
                  >
                    <Text style={u.bold}>
                      {t("contributionTrail.version", { version: step.version })} ·{" "}
                      {t(`contributionTrail.status.${step.status}`)}
                    </Text>
                    {step.supersedes_id
                      ? <Text style={u.small}>{t("contributionTrail.corrects")}</Text>
                      : null}
                    <Text style={u.small}>
                      {t("contributionTrail.questions", { count: step.question_count })} ·{" "}
                      {t("contributionTrail.sentAt", { date: date(step.created_at) })}
                      {step.reviewed_at
                        ? ` · ${t("contributionTrail.reviewedAt", { date: date(step.reviewed_at) })}`
                        : ""}
                    </Text>
                    {step.review_note
                      ? (
                        <Text selectable style={u.copy}>
                          {t("contributionTrail.note", { note: step.review_note })}
                        </Text>
                      )
                      : null}
                    {step.decision === "approved" && step.package_status
                      ? <Text style={u.small}>{t("contributionTrail.inLibraryDraft")}</Text>
                      : null}
                    {fixable && row?.question_id
                      ? (
                        <SatinButton
                          title={t("contributionTrail.fix")}
                          onPress={() =>
                            router.push({
                              pathname: "/parent/prova/share",
                              params: { questionId: row.question_id!, supersedes: step.id },
                            })}
                        />
                      )
                      : taken
                      ? <Text style={u.small}>{t("contributionTrail.fixTaken")}</Text>
                      : null}
                  </View>
                );
              })}
              {grouped ? <Text style={u.small}>{t("contributionTrail.atomic")}</Text> : null}
            </View>
          );
        })}
      {chains.data?.truncated ? <Text style={u.small}>{t("contributionTrail.more")}</Text> : null}
    </View>
  );
}
