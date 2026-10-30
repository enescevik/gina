import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import { ChildPicker, ParentScreen as Screen } from "@/components/ui/parent-screen";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Bu puanın altındaki konular «çalışılacak» sayılır. */
const WEAK_THRESHOLD = 60;

interface MasteryRow {
  subject: string;
  grade: number;
  topic: string;
  total: number;
  correct: number;
  pending: number;
  accuracy: number | null;
  score: number | null;
  level_total: number;
  last_at: string | null;
}

function barColor(score: number): string {
  if (score >= 80) return "bg-green";
  if (score >= WEAK_THRESHOLD) return "bg-star";
  return "bg-coral";
}

/** Konu ilerlemesi: çocuk başına, ders ders konu hakimiyeti (yakın tarihli denemeler ağır basar); en zayıf önce. */
export default function ProvaProgressScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const [childId, setChildId] = useState<string | null>(null);

  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("id, name, grade, avatar").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const activeChildId = childId ?? children.data?.[0]?.id ?? null;

  const mastery = useQuery({
    queryKey: ["topic_mastery", activeChildId],
    enabled: !!activeChildId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("child_topic_mastery", { p_child_id: activeChildId ?? "" });
      if (error) throw error;
      return data as MasteryRow[];
    },
  });
  useRealtimeInvalidate("exam_attempts", familyId ? `family_id=eq.${familyId}` : null, [["topic_mastery", activeChildId]]);

  // Ders bazında grupla; her derste puanı olmayanlar sona, en zayıf konu başa.
  const subjects = useMemo(() => {
    const groups = new Map<string, MasteryRow[]>();
    for (const row of mastery.data ?? []) {
      const list = groups.get(row.subject) ?? [];
      list.push(row);
      groups.set(row.subject, list);
    }
    return Array.from(groups.entries())
      .map(([subject, rows]) => {
        const sorted = [...rows].sort((a, b) => (a.score ?? 101) - (b.score ?? 101) || a.topic.localeCompare(b.topic, "tr"));
        const scored = rows.filter((r) => r.score !== null);
        const avg = scored.length ? Math.round(scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length) : null;
        return { subject, rows: sorted, avg };
      })
      .sort((a, b) => (a.avg ?? 101) - (b.avg ?? 101));
  }, [mastery.data]);

  const weak = useMemo(
    () => (mastery.data ?? []).filter((r) => r.score !== null && r.score < WEAK_THRESHOLD).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)),
    [mastery.data],
  );


  return (
    <Screen title={t("prova.progress.title")} loading={children.isLoading || mastery.isLoading} error={children.error ?? mastery.error} onRetry={() => { void children.refetch(); if (activeChildId) void mastery.refetch(); }}>
      <Text className="font-body text-base text-gray-600">{t("prova.progress.intro")}</Text>
      <ChildPicker profiles={children.data ?? []} selected={activeChildId} onSelect={id => { if (id) setChildId(id); }} />

      {mastery.data && mastery.data.length === 0 ? (
        <View className="gap-2 rounded-2xl border border-[#E4DAC8] bg-[#FFFCF6] p-4">
          <Text className="font-body text-gray-500">{t("prova.progress.empty")}</Text>
          <Button variant="secondary" title={t("prova.level.title")} onPress={() => router.push("/parent/prova/level")} />
        </View>
      ) : null}

      {weak.length > 0 ? (
        <View className="gap-2 rounded-parent bg-coral-light p-4">
          <Text className="font-display text-lg text-ink">{t("prova.progress.weakTitle")}</Text>
          <Text className="font-body text-sm text-gray-600">{t("prova.progress.weakHint")}</Text>
          {weak.map((r) => (
            <Text key={`${r.subject}-${r.topic}`} className="font-body text-base text-ink">
              • {r.subject} — {r.topic} ({t("prova.progress.scoreShort", { score: r.score ?? 0 })})
            </Text>
          ))}
        </View>
      ) : null}

      {subjects.map(({ subject, rows, avg }) => (
        <View key={subject} className="gap-3 rounded-2xl border border-[#E4DAC8] bg-[#FFFCF6] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-display text-xl text-ink">{subject}</Text>
            {avg !== null ? <Text className="font-body text-sm text-gray-500">{t("prova.progress.average", { score: avg })}</Text> : null}
          </View>
          {rows.map((r) => (
            <View key={r.topic} className="gap-1">
              <View className="flex-row items-baseline justify-between gap-2">
                <Text className="font-body flex-1 text-base text-ink">{r.topic}</Text>
                <Text className="font-body-bold text-sm text-ink">{r.score !== null ? `${r.score}` : "—"}</Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-mist">
                {r.score !== null ? <View className={`h-2 rounded-full ${barColor(r.score)}`} style={{ width: `${Math.max(2, r.score)}%` }} /> : null}
              </View>
              <Text className="font-body text-xs text-gray-500">
                {t("prova.progress.correctOf", { correct: Number(r.correct).toLocaleString(), count: r.total })}
                {r.pending > 0 ? ` · ${t("prova.progress.pending", { count: r.pending })}` : ""}
                {r.level_total > 0 ? ` · ${t("prova.progress.fromLevel")}` : ""}
              </Text>
            </View>
          ))}
        </View>
      ))}

      <Text className="font-body text-xs text-gray-500">{t("prova.progress.scoreNote")}</Text>
      <ErrorText error={children.error ?? mastery.error} />
      <Button variant="ghost" title={t("prova.backToList")} onPress={() => router.back()} />
    </Screen>
  );
}
