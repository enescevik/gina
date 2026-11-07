import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { ErrorText } from "@/components/ui/screen";
import { supabase } from "@/lib/supabase";
import { parentItemStatus, readStructuredSummary, type StructuredSummaryRow } from "./model";
import { qt } from "./ui";

/** get_attempt_summary ham yanıtı (structured_answers core şemasında yok; burada ayrıca okunur). */
export async function fetchStructuredSummary(attemptId: string): Promise<StructuredSummaryRow[]> {
  const { data, error } = await supabase.rpc("get_attempt_summary", { p_attempt_id: attemptId });
  if (error) throw error;
  return readStructuredSummary(data);
}
/** ["attempt_summary", id] önekiyle: mevcut yenileme (invalidate) bunu da tazeler. */
export const structuredSummaryKey = (attemptId: string) => ["attempt_summary", attemptId, "structured"] as const;

export function structuredStatusText(t: (k: string, o?: Record<string, unknown>) => string, row: StructuredSummaryRow) {
  const status = parentItemStatus(row);
  return t(`prova.qt.review.status.${status}`, { score: row.score ?? 0 });
}

/** Veli deneme sonucu: yapılandırılmış maddeler — puanlı (kısmi dahil), sizi bekliyor, cevapsız ayrı. */
export function StructuredAttemptSection({ attemptId, finished }: { attemptId: string; finished: boolean }) {
  const { t } = useTranslation();
  const summary = useQuery({ queryKey: structuredSummaryKey(attemptId), enabled: !!attemptId, queryFn: () => fetchStructuredSummary(attemptId) });
  const rows = [...(summary.data ?? [])].sort((a, b) => a.position - b.position);
  if (!rows.length && !summary.error) return null;
  const statuses = rows.map(parentItemStatus);
  const count = (s: string[]) => statuses.filter((x) => s.includes(x)).length;
  return (
    <View testID="qt-attempt-section" className="gap-1 rounded-2xl border border-[#EAE5EE] bg-[#FFFFFF] p-4">
      <Text accessibilityRole="header" className="font-body-bold text-base text-ink">{t("prova.qt.review.title")}</Text>
      {finished ? (
        <Text testID="qt-attempt-counts" className="font-body text-sm text-gray-600">
          {t("prova.qt.review.counts", {
            scored: count(["auto_scored", "auto_scored_partial", "parent_scored"]),
            partial: count(["auto_scored_partial"]),
            pending: count(["pending_parent"]),
            unanswered: count(["unanswered"]),
          })}
        </Text>
      ) : (
        <Text className="font-body text-sm text-gray-600">{t("prova.qt.review.notFinished")}</Text>
      )}
      {rows.map((row) => {
        const status = parentItemStatus(row);
        return (
          <View key={row.question_id} testID={`qt-attempt-row-${row.position}`} style={{ gap: 4, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F0ECF4" }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <View style={{ flexGrow: 1, flexShrink: 1, gap: 2 }}>
                <Text className="font-body-bold text-base text-ink">
                  {t("prova.qt.review.questionN", { n: row.position, type: row.interaction_type ? t(`prova.qt.review.type.${row.interaction_type}`) : "" })}
                </Text>
                {finished ? (
                  <Text testID={`qt-attempt-status-${status}`} style={{ fontFamily: "Nunito_700Bold", fontSize: 15, lineHeight: 21, color: status === "pending_parent" ? qt.ink : qt.muted }}>
                    {structuredStatusText(t, row)}
                  </Text>
                ) : null}
              </View>
              {finished ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("prova.qt.review.openA11y", { n: row.position })}
                  style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 8 }}
                  onPress={() => router.push({ pathname: "/parent/prova/review/[attemptId]", params: { attemptId, questionId: row.question_id } })}
                >
                  <Text className="font-body-bold text-teal-dark">{t(status === "pending_parent" || status === "unanswered" ? "prova.qt.review.scoreAction" : "prova.qt.review.open")}</Text>
                </Pressable>
              ) : null}
            </View>
            {finished && status === "pending_parent" && row.auto_score !== null ? (
              <Text className="font-body text-sm text-gray-600">{t("prova.qt.review.autoHint", { score: Math.round(row.auto_score) })}</Text>
            ) : null}
          </View>
        );
      })}
      <ErrorText error={summary.error} />
    </View>
  );
}
