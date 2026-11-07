import { ReportQuestion } from "./report-question";
import { QuestionFocus } from "./question-focus";
import { QuestionLike } from "./question-like";
import { SetupSourceLinks } from "@/components/setup/source-links";
import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Check, Pencil } from "lucide-react-native";
import { contentReviewNames, isPhase2AuthorType, questionContentReviewOf } from "@gina/core";
import { useTranslation } from "react-i18next";
import { p } from "@/components/planner/ui";
import { Pressable } from "@/components/ui/pressable";
import { QuestionMedia } from "./question-media";
import type { BuilderQuestion } from "./prova-builder-data";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { StructuredQuestionPreview } from "./structured-question-author";
import { Phase2QuestionPreview, StimulusPreview } from "./structured-question-author-p2";

/**
 * QT: yapılandırılmış sorunun önizlemesi. Görünüm satırı (standalone_question_bank) yeni sütunları
 * taşımayabilir; içerik o zaman question_bank'tan okunur. Anahtar yalnız “cevabı göster” açıkken
 * veli RPC'siyle (`get_question_answer_keys`) alınır.
 */
export function StructuredBuilderPreview({ q, showAnswer }: { q: BuilderQuestion; showAnswer: boolean }) {
  // AI sonucu satırı veliye dönen anahtarı taşır; o zaman ayrıca RPC çağrılmaz.
  const row = q as BuilderQuestion & { interaction_type?: string | null; payload?: unknown; answer_key?: unknown };
  const content = useQuery({
    queryKey: ["qt_payload", q.id],
    enabled: row.payload === undefined || row.interaction_type === undefined,
    queryFn: async () => {
      const { data, error } = await supabase.from("question_bank").select("interaction_type,payload").eq("id", q.id).single();
      if (error) throw error;
      return data;
    },
  });
  const key = useQuery({
    queryKey: ["qt_answer_key", q.id],
    enabled: showAnswer && !row.answer_key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_question_answer_keys", { p_question_ids: [q.id] });
      if (error) throw error;
      return ((data ?? []) as unknown as { question_id: string; key: unknown }[]).find((k) => k.question_id === q.id)?.key ?? null;
    },
  });
  const type = row.interaction_type ?? content.data?.interaction_type ?? null;
  const payload = row.payload ?? content.data?.payload ?? null;
  if (!payload) return null;
  const answerKey = showAnswer ? row.answer_key ?? key.data ?? undefined : undefined;
  return (
    <View testID="builder-qt-preview" style={{ gap: 12 }}>
      <StimulusPreview stimulus={(payload as { stimulus?: unknown }).stimulus} />
      {isPhase2AuthorType(type)
        ? <Phase2QuestionPreview type={type} payload={payload} answerKey={answerKey} />
        : <StructuredQuestionPreview type={type} payload={payload} answerKey={answerKey} testID="builder-qt-preview-body" />}
    </View>
  );
}
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
      style={[
        b.choice,
        selected && b.selected,
        disabled && !selected &&
        { backgroundColor: "#F0EDF4", borderColor: "#D8D0E4" },
      ]}
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
  { q, showAnswer = false, onEdit, editable = !!onEdit }: {
    q: BuilderQuestion;
    showAnswer?: boolean;
    /** D14: AI sorusunu mevcut editörde aç ("Düzenle"). */
    onEdit?: () => void;
    /** D14: düzenleme yolu var (ör. grup düzeyinde) → not "Düzenle"yi önerir. */
    editable?: boolean;
  },
) {
  const { t } = useTranslation();
  const edited = !!q.provenance && typeof q.provenance === "object" &&
    !Array.isArray(q.provenance) && q.provenance.generator === "ai_edited";
  return (
    <View style={{ gap: 14 }}>
      {edited
        ? (
          <Text testID="question-edited-tag" style={[b.muted, { color: p.purple }]}>
            {t("d14.edit.edited")}
          </Text>
        )
        : null}
      <Text style={b.h2}>{q.stem}</Text>
      <QuestionMedia questionId={q.id} />
      <QuestionLike questionId={q.id} />
      <ReportQuestion key={q.id} questionId={q.id} />
      <QuestionFocus questionId={q.id} grade={q.grade} />
      {q.kind === "structured" ? <StructuredBuilderPreview q={q} showAnswer={showAnswer} /> : null}
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
      <ContentReviewNote question={q} editable={editable} />
      {onEdit ? <EditAction onPress={onEdit} /> : null}
      {showAnswer && q.kind !== "structured"
        ? (
          <View style={b.hint}>
            <Text style={b.bold}>{t("provaBuilder.answer")}</Text>
            <Text style={b.copy}>
              {q.kind === "multiple_choice" ? q.correct_key : q.expected_answer}
            </Text>
            {q.solution &&
                (q.kind === "multiple_choice" ||
                  q.solution.trim() !== q.expected_answer?.trim())
              ? <Text style={b.muted}>{q.solution}</Text>
              : null}
            <DocumentOrigin question={q} />
          </View>
        )
        : null}
    </View>
  );
}
/**
 * D10: AI sorusunda kişi adı uyarısı (D9/B6). Sakin, engellemeyen bilgi notu; seçim/gönderim değişmez.
 * Kaynak: üretim sonucu öğesi `content_review` ya da `question_bank.provenance.content_review`. Yalnız veli
 * ekranlarında (öneri seçici, taslak önizleme) kullanılır; animasyon yok (azaltılmış hareket etkilenmez).
 * D14: düzenleme yolu olan yerde ikinci satır "Düzenle"yi önerir; olmayan yerde (eski metin) seçmeden geçmeyi/kendi sorusunu.
 */
function ContentReviewNote(
  { question, editable }: { question: BuilderQuestion; editable: boolean },
) {
  const { t } = useTranslation();
  const names = contentReviewNames(questionContentReviewOf(question));
  if (!names.length) return null;
  return (
    <View
      testID="question-content-review"
      accessible
      accessibilityRole="text"
      style={{ backgroundColor: p.lilac, borderRadius: 16, padding: 12, gap: 6 }}
    >
      <Text style={[b.muted, { color: p.purple }]}>
        {t("d10.contentReview.title")}
      </Text>
      <Text style={b.copy}>
        {t("d10.contentReview.personName", { names: names.join(", ") })}
      </Text>
      <Text style={b.muted}>
        {t(editable ? "d14.contentReview.canEdit" : "d10.contentReview.noEdit")}
      </Text>
    </View>
  );
}
/** D14: sakin ikincil eylem (48pt dokunma alanı, kalem simgesi); animasyon yok. */
export function EditAction(
  { onPress, label, disabled = false }: {
    onPress: () => void;
    label?: string;
    disabled?: boolean;
  },
) {
  const { t } = useTranslation();
  return (
    <Pressable
      testID="ai-question-edit"
      accessibilityRole="button"
      accessibilityLabel={label ?? t("d14.edit.actionLabel")}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[b.choice, {
        alignSelf: "flex-start",
        borderColor: "#D9CCF3",
        backgroundColor: "#FFFFFF",
        opacity: disabled ? 0.55 : 1,
      }]}
    >
      <Pencil size={18} color={p.purple} />
      <Text style={[b.bold, { color: p.purple, flexShrink: 1 }]}>
        {label ?? t("d14.edit.action")}
      </Text>
    </Pressable>
  );
}
function DocumentOrigin({ question }: { question: BuilderQuestion }) {
  const { t } = useTranslation();
  const provenance = question.provenance;
  const sourceId = provenance && typeof provenance === "object" &&
      !Array.isArray(provenance) &&
      typeof provenance.document_source_id === "string"
    ? provenance.document_source_id
    : null;
  if (!sourceId) return null;
  return <View style={{gap:8}}>
    <Text style={b.muted}>{t("provaBuilder.documentOrigin")}</Text>
    <SetupSourceLinks sources={[{item_id:question.id,source_id:sourceId,name:t("planImport.document"),mime:""}]}/>
  </View>;
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
