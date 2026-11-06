import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { groupExamPhasesSchema, rankingReason } from "@gina/core";
import { p, u } from "@/components/planner/ui";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export function rankingReasonKey(reason: unknown) {
  const parsed = rankingReason.safeParse(reason);
  return parsed.success && parsed.data !== "eligible"
    ? `groupPhases.rankingReason.${parsed.data}`
    : "groupPhases.rankingReason.unknown";
}

/** Participation window, the child's own time, the review stage and (secondary) ranking. */
export function GroupPhases({
  group,
  formatDate,
  childName,
}: {
  group: string;
  formatDate: (iso: string) => string;
  childName: (id: string) => string;
}) {
  const { t } = useTranslation();
  const { claims } = useSession();
  const phases = useQuery({
    // "group_exams" prefix: enrolment/consent refreshes re-read the phases too.
    queryKey: ["group_exams", "phases", claims?.family_id, group],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("group_exam_phases", { p_group: group });
      if (error) throw error;
      return groupExamPhasesSchema.parse(data);
    },
  });
  if (phases.isPending) return null;
  if (phases.error || !phases.data) {
    return <Text style={u.small}>{t("groupPhases.failed")}</Text>;
  }
  const d = phases.data;
  const part = d.participation;
  const line = (text: string, strong = false) => (
    <Text style={strong ? u.bold : u.small}>{text}</Text>
  );
  return (
    <View
      testID="group-phases"
      style={{ gap: 6, padding: 14, borderRadius: 18, backgroundColor: "#F7F5FA" }}
    >
      <Text style={u.bold}>{t("groupPhases.title")}</Text>
      {line(
        t(`groupPhases.participation.${part.phase}`, {
          date: formatDate(part.phase === "upcoming" ? part.starts_at : part.ends_at),
        }),
        true,
      )}
      {line(t("groupPhases.childTime", { minutes: d.child_time.duration_minutes }))}
      {line(t(`groupPhases.review.${d.review.phase}`))}
      <View style={{ height: 1, backgroundColor: p.line, marginVertical: 4 }} />
      {line(t("groupPhases.ranking", { count: d.ranking.eligible_entries }))}
      {d.ranking.mine?.map((m) => (
        <Text key={m.child_id} style={u.small} testID="group-phase-mine">
          {m.eligible
            ? t("groupPhases.mineEligible", { name: childName(m.child_id) })
            : t("groupPhases.mineReason", {
              name: childName(m.child_id),
              reason: t(rankingReasonKey(m.reason)),
            })}
        </Text>
      ))}
    </View>
  );
}

/** Shown in a result when the entry is not on the definitive board, and for interim counts. */
export function RankingNotice(
  { ranked, reason, interim }: { ranked?: boolean; reason?: string | null; interim?: boolean },
) {
  const { t } = useTranslation();
  if (ranked !== false && !interim) return null;
  return (
    <View
      testID="group-ranking-notice"
      accessibilityLiveRegion="polite"
      style={{ gap: 6, padding: 14, borderRadius: 18, backgroundColor: "#FFF7EA" }}
    >
      {interim
        ? (
          <>
            <Text style={u.bold}>{t("groupPhases.interim")}</Text>
            <Text style={u.small}>{t("groupPhases.interimHelp")}</Text>
          </>
        )
        : null}
      {ranked === false
        ? (
          <>
            <Text style={u.bold}>{t("groupPhases.notRanked")}</Text>
            <Text style={u.small}>{t(rankingReasonKey(reason))}</Text>
          </>
        )
        : null}
    </View>
  );
}
