import { useMutation, useQueries } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  linkForTitle,
  readSubjectSuggestion,
  type SubjectLink,
} from "@gina/core";
import { SatinButton } from "@/components/planner/ui";
import { supabase } from "@/lib/supabase";
import { provaErrorMessage } from "@/lib/prova-ai";
import { b, BuilderCard } from "./prova-builder-ui";

type Rpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;

/**
 * D1: Prova ders metni → C02/S04 kanonik ders kimliği. Yazılan ad hiçbir yerde değişmez; katalog dersine
 * yalnız velinin "Bağla" dokunuşuyla (set_child_subject_links, program/takvimle aynı çocuk bağı) bağlanır.
 * Öneri (suggest_subject) tek başına bağlamaz.
 */
export function ProvaSubjectLinks({
  childId,
  grade,
  subjects,
  links,
  loading,
  onChanged,
}: {
  childId: string;
  grade: number | null;
  subjects: string[];
  links: Pick<SubjectLink, "alias_normalized" | "title" | "subject_id" | "label_tr" | "label_en">[];
  loading: boolean;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const english = i18n.language.startsWith("en");
  const call = supabase.rpc as unknown as Rpc;
  const unlinked = subjects.filter((s) =>
    !linkForTitle(links as SubjectLink[], s)
  );
  const suggestions = useQueries({
    queries: unlinked.map((title) => ({
      queryKey: ["prova_subject_suggest", title, grade],
      enabled: !loading,
      staleTime: 60_000,
      queryFn: async () => {
        const r = await call.call(supabase, "suggest_subject", {
          p_text: title,
          p_grade: grade,
        });
        if (r.error) throw r.error;
        return readSubjectSuggestion(r.data);
      },
    })),
  });
  const link = useMutation({
    mutationFn: async (v: { title: string; subject_id: string }) => {
      const r = await call.call(supabase, "set_child_subject_links", {
        p_request_id: randomUUID(),
        p_child_id: childId,
        p_links: [{ title: v.title, subject_id: v.subject_id, expected: null }],
        p_source: "manual",
      });
      if (r.error) throw r.error;
    },
    onSuccess: onChanged,
  });
  return (
    <BuilderCard title={t("d1.subjects.title")}>
      <Text style={b.muted}>{t("d1.subjects.help")}</Text>
      {subjects.map((title) => {
        const linked = linkForTitle(links as SubjectLink[], title);
        if (linked) {
          return (
            <Text key={title} style={b.copy}>
              {t("d1.subjects.linked", {
                title,
                label: english ? linked.label_en : linked.label_tr,
              })}
            </Text>
          );
        }
        const s = suggestions[unlinked.indexOf(title)];
        const candidates = s?.data?.candidates ?? [];
        return (
          <View key={title} style={{ gap: 6 }}>
            <Text style={b.bold}>{t("d1.subjects.unlinked", { title })}</Text>
            {loading || s?.isPending
              ? <Text style={b.muted}>{t("common.loading")}</Text>
              : candidates.length
              ? (
                <View style={b.wrap}>
                  {candidates.slice(0, 3).map((c) => (
                    <SatinButton
                      key={c.subject_id}
                      secondary
                      busy={link.isPending &&
                        link.variables?.subject_id === c.subject_id &&
                        link.variables?.title === title}
                      disabled={link.isPending}
                      title={t("d1.subjects.link", {
                        label: english ? c.label_en : c.label_tr,
                      })}
                      onPress={() =>
                        link.mutate({ title, subject_id: c.subject_id })}
                    />
                  ))}
                </View>
              )
              : <Text style={b.muted}>{t("d1.subjects.noSuggestion")}</Text>}
          </View>
        );
      })}
      {link.error
        ? (
          <Text accessibilityRole="alert" style={b.error}>
            {provaErrorMessage(link.error)}
          </Text>
        )
        : null}
    </BuilderCard>
  );
}
