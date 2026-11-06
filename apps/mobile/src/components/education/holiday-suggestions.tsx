// C11 / F01 kararı: otomatik tatil ÖNERİSİ (otomatik silme yok). Öneri yalnız yayımlanmış takvim ve tatil
// kayıtlarından gelir. Veli kabul ederse o günlerdeki dersler "tatil" olarak işaretlenir; ders programı, görevler,
// yıldızlar, ödüller ve sınıf değişmez. Kabul edilen işaret tek dokunuşla geri alınır.
import { useRef, useState } from "react";
import { Linking, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sun } from "lucide-react-native";
import { randomUUID } from "expo-crypto";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";
import { p, SatinButton, u } from "@/components/planner/ui";

type LooseRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as LooseRpc;

type Suggestion = {
  key: string;
  kind: "break" | "public_holiday" | "local_day";
  title: string | null;
  starts_on: string;
  ends_on: string;
  source_url: string;
  lesson_days: number;
  decision: "accepted" | "dismissed" | null;
  revision: number;
};
type Suggestions = { child_id: string; today: string; has_location: boolean; items: Suggestion[] };

function readSuggestions(value: unknown): Suggestions {
  const v = value as Suggestions;
  if (!v || typeof v !== "object" || !Array.isArray(v.items)) throw new Error("holiday_invalid");
  return v;
}

export const holidaySuggestionsKey = (family: string, child: string) => ["education_holiday_suggestions", family, child] as const;

export function HolidaySuggestions({ child }: { child: { id: string; name: string; archived_at: string | null } }) {
  const { t, i18n } = useTranslation();
  const { claims } = useSession();
  const family = claims?.family_id ?? "";
  const cache = useQueryClient();
  const [done, setDone] = useState("");
  const request = useRef({ id: randomUUID(), key: "" });
  const query = useQuery({
    queryKey: holidaySuggestionsKey(family, child.id),
    enabled: !!family && !child.archived_at,
    queryFn: async () => {
      const { data, error } = await rpc("education_holiday_suggestions", { p_child_id: child.id });
      if (error) throw error;
      return readSuggestions(data);
    },
  });
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(value + "T12:00:00Z"));
  const range = (s: Suggestion) => (s.starts_on === s.ends_on ? date(s.starts_on) : `${date(s.starts_on)} – ${date(s.ends_on)}`);
  // Aynı niyetin yeniden denemesi aynı istek kimliğiyle gider (kayıp yanıt → aynı sonuç).
  const requestFor = (key: string) => {
    if (request.current.key !== key) request.current = { id: randomUUID(), key };
    return request.current.id;
  };
  const decide = useMutation({
    mutationFn: async ({ item, decision }: { item: Suggestion; decision: "accept" | "dismiss" | "undo" }) => {
      const { error } = await rpc("decide_education_holiday", {
        p_request_id: requestFor(`${item.key}:${decision}:${item.revision}`),
        p_child_id: child.id,
        p_key: item.key,
        p_decision: decision,
        p_revision: item.revision,
      });
      if (error) throw error;
      return decision;
    },
    onSuccess: async (decision) => {
      setDone(t(decision === "accept" ? "c11.holiday.accepted" : decision === "dismiss" ? "c11.holiday.dismissed" : "c11.holiday.undone"));
      await Promise.all([
        cache.invalidateQueries({ queryKey: holidaySuggestionsKey(family, child.id) }),
        cache.invalidateQueries({ queryKey: ["plan_for_days", family] }),
        cache.invalidateQueries({ queryKey: ["plan_for_day", family] }),
      ]);
    },
    onError: (e) => {
      if (/holiday_changed|holiday_unknown/.test(e.message)) void cache.invalidateQueries({ queryKey: holidaySuggestionsKey(family, child.id) });
    },
  });
  const items = query.data?.items ?? [];
  if (child.archived_at || (!items.length && !query.error)) return null;
  const errorText = (e: Error | null) =>
    !e ? "" : /holiday_changed|holiday_unknown/.test(e.message) ? t("c11.holiday.changed") : t("c11.holiday.error");
  return (
    <View testID="c11-holidays" style={{ gap: 12 }}>
      <Text style={u.heading}>{t("c11.holiday.title")}</Text>
      {query.error ? <Text accessibilityRole="alert" style={u.error}>{t("c11.holiday.loadError")}</Text> : null}
      {done ? <Text accessibilityLiveRegion="polite" style={[u.bold, { color: "#287460" }]}>{done}</Text> : null}
      {decide.error ? <Text accessibilityRole="alert" style={u.error}>{errorText(decide.error)}</Text> : null}
      {items.map((item) => (
        <View key={item.key} testID={`c11-holiday-${item.kind}`} style={[u.card, { gap: 8, backgroundColor: item.decision === "accepted" ? p.mint : p.lilac }]}>
          <View style={u.row}>
            <Sun color={p.purple} size={24} />
            <Text style={[u.bold, u.fill]}>
              {item.title ?? t("c11.holiday.break")} · {range(item)}
            </Text>
          </View>
          {item.decision === "accepted"
            ? <Text style={u.copy}>{t("c11.holiday.acceptedBody", { name: child.name })}</Text>
            : item.decision === "dismissed"
            ? <Text style={u.copy}>{t("c11.holiday.dismissedBody")}</Text>
            : (
              <Text style={u.copy}>
                {item.lesson_days > 0
                  ? t("c11.holiday.question", { name: child.name, count: item.lesson_days })
                  : t("c11.holiday.questionNoLessons", { name: child.name })}
              </Text>
            )}
          <Text style={u.small}>{t("c11.holiday.keeps")}</Text>
          {item.decision
            ? (
              <SatinButton
                secondary
                title={t("c11.holiday.undo")}
                busy={decide.isPending}
                onPress={() => { setDone(""); decide.mutate({ item, decision: "undo" }); }}
              />
            )
            : (
              <View style={{ gap: 8 }}>
                <SatinButton
                  title={t("c11.holiday.accept")}
                  busy={decide.isPending}
                  onPress={() => { setDone(""); decide.mutate({ item, decision: "accept" }); }}
                />
                <SatinButton
                  secondary
                  title={t("c11.holiday.dismiss")}
                  disabled={decide.isPending}
                  onPress={() => { setDone(""); decide.mutate({ item, decision: "dismiss" }); }}
                />
              </View>
            )}
          <SatinButton
            secondary
            title={t("c11.holiday.source")}
            onPress={() => void Linking.openURL(item.source_url).catch(() => {})}
          />
        </View>
      ))}
    </View>
  );
}
