import { type ReactNode, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { sourceAction } from "@/lib/learning-files";
import { provaErrorMessage } from "@/lib/prova-ai";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { p } from "@/components/planner/ui";
import { Pressable } from "@/components/ui/pressable";
import { QuestionMedia } from "./question-media";
import type { BuilderQuestion } from "./prova-builder-data";
export function BuilderChoice(
  { label, selected, onPress, disabled = false }: {
    label: string;
    selected: boolean;
    onPress: () => void;
    disabled?: boolean;
  },
) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[b.choice, selected && b.selected, disabled && { opacity: .45 }]}
    >
      <Text
        style={[
          b.copy,
          { flexShrink: 1 },
          selected && { color: p.purple, fontFamily: "Nunito_800ExtraBold" },
        ]}
      >
        {label}
      </Text>
      {selected ? <Check size={18} color={p.purple} /> : null}
    </Pressable>
  );
}
export function BuilderCard(
  { title, children }: { title?: string; children: ReactNode },
) {
  return (
    <View style={b.card}>
      {title
        ? <Text accessibilityRole="header" style={b.h2}>{title}</Text>
        : null}
      {children}
    </View>
  );
}
export function BuilderQuestionPreview(
  { q, showAnswer = false }: { q: BuilderQuestion; showAnswer?: boolean },
) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 14 }}>
      <Text style={b.h2}>{q.stem}</Text>
      <QuestionMedia questionId={q.id} />
      {Array.isArray(q.choices)
        ? (q.choices as { key: string; text: string }[]).map((c) => (
          <View key={c.key} style={b.choice}>
            <Text style={[b.copy, { fontFamily: "Nunito_800ExtraBold" }]}>
              {c.key}
            </Text>
            <Text style={[b.copy, { flex: 1 }]}>{c.text}</Text>
          </View>
        ))
        : null}
      {showAnswer
        ? (
          <View style={b.hint}>
            <Text style={b.bold}>{t("provaBuilder.answer")}</Text>
            <Text style={b.copy}>
              {q.kind === "multiple_choice" ? q.correct_key : q.expected_answer}
            </Text>
            {q.solution ? <Text style={b.muted}>{q.solution}</Text> : null}
            <DocumentOrigin question={q} />
          </View>
        )
        : null}
    </View>
  );
}
function DocumentOrigin({ question }: { question: BuilderQuestion }) {
  const { t } = useTranslation();
  const [error, setError] = useState<unknown>(null);
  const provenance = question.provenance;
  const sourceId = provenance && typeof provenance === "object" &&
      !Array.isArray(provenance) &&
      typeof provenance.document_source_id === "string"
    ? provenance.document_source_id
    : null;
  const source = useQuery({
    queryKey: ["builder_document_origin", question.id, sourceId],
    enabled: !!sourceId,
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_sources").select(
        "name",
      ).eq("id", sourceId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!sourceId) return null;
  return (
    <View style={{ gap: 8 }}>
      <Text style={b.muted}>
        {t("provaBuilder.documentOrigin")}:{" "}
        {source.data?.name ?? t("sources.unavailable")}
      </Text>
      {source.data
        ? (
          <Pressable
            accessibilityRole="button"
            style={b.choice}
            onPress={() =>
              void sourceAction<{ url: string }>({
                action: "view",
                id: sourceId,
              }).then((result) => Linking.openURL(result.url)).catch(setError)}
          >
            <Text style={b.bold}>{t("provaBuilder.openOriginal")}</Text>
          </Pressable>
        )
        : null}
      {error || source.error
        ? (
          <Text style={b.error}>
            {provaErrorMessage(error ?? source.error)}
          </Text>
        )
        : null}
    </View>
  );
}
export const b = StyleSheet.create({
  top: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  page: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    padding: 22,
    paddingBottom: 36,
    gap: 16,
  },
  h1: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 30,
    lineHeight: 38,
    color: p.ink,
  },
  h2: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 24,
    lineHeight: 31,
    color: p.ink,
  },
  copy: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 17,
    lineHeight: 25,
    color: p.ink,
  },
  bold: {
    fontFamily: "Nunito_800ExtraBold",
    fontSize: 17,
    lineHeight: 24,
    color: p.ink,
  },
  muted: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 15,
    lineHeight: 23,
    color: p.muted,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  choice: {
    maxWidth: "100%",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: "#E5DDED",
    borderRadius: 16,
    backgroundColor: "#FFFEFB",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  selected: { backgroundColor: p.lilac, borderColor: "#9C81E8" },
  child: {
    minHeight: 84,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: p.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "#E7DEEE",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 22,
    gap: 18,
    boxShadow: "0 4px 16px #35255706",
  },
  steps: {
    flexDirection: "row",
    marginVertical: 4,
    gap: 6,
    padding: 6,
    borderRadius: 24,
    backgroundColor: "#F0EBFA",
  },
  step: {
    alignItems: "center",
    flex: 1,
    minHeight: 60,
    justifyContent: "center",
    padding: 6,
    gap: 6,
    borderRadius: 18,
    minWidth: 0,
  },
  columns: { gap: 30, alignItems: "stretch" },
  sidebar: {
    width: 340,
    borderLeftWidth: 1,
    borderLeftColor: p.line,
    paddingLeft: 28,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: p.line,
  },
  hint: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#E8F5EF",
    gap: 8,
    color: p.ink,
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
    lineHeight: 24,
  },
  block: {
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: p.line,
    paddingVertical: 18,
  },
  footer: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: p.line,
    backgroundColor: "#FFFEFB",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  status: { padding: 30, color: p.ink },
  error: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 16,
    lineHeight: 24,
    color: "#9C3F36",
  },
  overlay: {
    flex: 1,
    backgroundColor: "#20195166",
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "95%",
    padding: 22,
    borderRadius: 26,
    backgroundColor: p.cream,
    gap: 20,
  },
});
