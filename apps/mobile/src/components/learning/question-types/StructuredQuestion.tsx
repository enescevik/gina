import {
  answerState,
  isStructuredType,
  type AnswerOf,
  type StructuredAnswer,
  type StructuredInteractionType,
} from "@gina/core";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { CircleAlert, Undo2 } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { ClassificationQuestion } from "./classification";
import { FillBlankQuestion } from "./fill-blank";
import { MatchingQuestion } from "./matching";
import { canRender, readPayload, type ScoreDetails } from "./model";
import { NumericQuestion } from "./numeric";
import { OrderingQuestion } from "./ordering";
import { StructuredReview } from "./structured-review";
import { TrueFalseQuestion } from "./true-false";
import { qt } from "./ui";

export interface StructuredReviewData {
  /** exam_answers.score_details (sunucu yazar; bitişten önce yoktur). */
  details: ScoreDetails | null;
  /** get_question_answer_keys(...).key — yalnız veli. */
  answerKey: unknown;
  score?: number | null;
  gradedBy?: string | null;
}

/** Güncelleme gerekiyor kutusu: bilinmeyen tür/şema asla serbest metne düşmez. */
export function UpdateRequired({ testID = "qt-update-required" }: { testID?: string }) {
  const { t } = useTranslation();
  return (
    <View testID={testID} accessibilityRole="alert" style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", borderRadius: 20, borderWidth: 2, borderColor: qt.warmLine, backgroundColor: qt.warm, padding: 16 }}>
      <CircleAlert size={26} color={qt.ink} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 18, lineHeight: 25, color: qt.ink }}>{t("prova.qt.child.updateTitle")}</Text>
        <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 16, lineHeight: 23, color: qt.ink }}>{t("prova.qt.child.updateBody")}</Text>
      </View>
    </View>
  );
}

/** Çocuğa doluluk durumu (puan/doğruluk DEĞİL): Boş · Yarım · Cevaplandı. */
export function FillStatePill({ type, payload, answer }: { type: StructuredInteractionType; payload: unknown; answer: StructuredAnswer | undefined }) {
  const { t } = useTranslation();
  const state = answerState(type, payload, answer ?? null);
  const look = { unanswered: ["#FFFFFF", qt.line, "○"], partial: [qt.warm, qt.warmLine, "◐"], complete: [qt.lilac, qt.purple, "●"] }[state];
  return (
    <View testID={`qt-fill-${state}`} accessibilityLabel={t(`prova.qt.child.state.${state}`)} style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: look[1], backgroundColor: look[0], paddingHorizontal: 12, paddingVertical: 4 }}>
      <Text aria-hidden style={{ fontSize: 14, color: qt.purpleDark }}>{look[2]}</Text>
      <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 15, color: qt.ink }}>{t(`prova.qt.child.state.${state}`)}</Text>
    </View>
  );
}

/**
 * Yapılandırılmış soru dağıtıcısı. Çocuk modunda (review yok) doğruluk ASLA gösterilmez; yalnız
 * doluluk durumu ve geri al. `review` verilirse salt okunur veli incelemesi çizilir.
 * `onChange(answer, typed)` — typed=true yazarak yapılan değişikliktir (ekran ~400ms erteleyerek kaydeder).
 */
export function StructuredQuestion({
  type,
  schemaVersion,
  payload,
  answer,
  onChange,
  disabled = false,
  review,
  onOpenWorkArea,
  hasWork,
}: {
  type: string | null | undefined;
  schemaVersion?: number | null;
  payload: unknown;
  answer: StructuredAnswer | undefined;
  onChange?: (answer: StructuredAnswer | undefined, typed: boolean) => void;
  disabled?: boolean;
  review?: StructuredReviewData;
  onOpenWorkArea?: () => void;
  hasWork?: boolean;
}) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<(StructuredAnswer | undefined)[]>([]);
  const typing = useRef(false);
  if (!isStructuredType(type) || !canRender(type, schemaVersion, payload)) {
    return review ? <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 16, color: qt.ink }}>{t("prova.qt.review.unsupported")}</Text> : <UpdateRequired />;
  }
  if (review) {
    return <StructuredReview type={type} payload={payload} answer={answer} details={review.details} answerKey={review.answerKey} />;
  }
  const locked = disabled || !onChange;
  function change(next: StructuredAnswer | undefined, typed = false) {
    if (locked) return;
    // Yazarken her harfi ayrı geri alma adımı yapmayız: ardışık yazım tek adımdır.
    if (!(typed && typing.current)) setHistory((h) => [...h.slice(-19), answer]);
    typing.current = typed;
    onChange!(next, typed);
  }
  function undo() {
    if (locked || !history.length) return;
    const previous = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    typing.current = false;
    onChange!(previous, false);
  }
  const common = { disabled: locked };
  let body: React.ReactNode;
  switch (type) {
    case "true_false":
      body = <TrueFalseQuestion {...common} payload={readPayload("true_false", payload)!} answer={answer as AnswerOf<"true_false"> | undefined} onChange={(a) => change(a)} />;
      break;
    case "fill_blank":
      body = <FillBlankQuestion {...common} payload={readPayload("fill_blank", payload)!} answer={answer as AnswerOf<"fill_blank"> | undefined} onChange={(a, typed) => change(a, typed)} />;
      break;
    case "matching":
      body = <MatchingQuestion {...common} payload={readPayload("matching", payload)!} answer={answer as AnswerOf<"matching"> | undefined} onChange={(a) => change(a)} />;
      break;
    case "numeric":
      body = <NumericQuestion {...common} payload={readPayload("numeric", payload)!} answer={answer as AnswerOf<"numeric"> | undefined} onChange={(a, typed) => change(a, typed)} onOpenWorkArea={onOpenWorkArea} hasWork={hasWork} />;
      break;
    case "ordering":
      body = <OrderingQuestion {...common} payload={readPayload("ordering", payload)!} answer={answer as AnswerOf<"ordering"> | undefined} onChange={(a) => change(a)} />;
      break;
    case "classification":
      body = <ClassificationQuestion {...common} payload={readPayload("classification", payload)!} answer={answer as AnswerOf<"classification"> | undefined} onChange={(a) => change(a)} />;
      break;
  }
  return (
    <View testID={`qt-${type}`} style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
        <FillStatePill type={type} payload={payload} answer={answer} />
        <Pressable
          testID="qt-undo"
          accessibilityRole="button"
          accessibilityLabel={t("prova.qt.child.undoA11y")}
          accessibilityState={{ disabled: locked || !history.length }}
          disabled={locked || !history.length}
          onPress={undo}
          style={{ minHeight: 48, minWidth: 48, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: history.length && !locked ? qt.lilac : "transparent", opacity: history.length && !locked ? 1 : 0.5 }}
        >
          <Undo2 size={20} color={qt.purpleDark} />
          <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: qt.purpleDark }}>{t("prova.qt.child.undo")}</Text>
        </Pressable>
      </View>
      {body}
    </View>
  );
}
