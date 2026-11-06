import { isPhase2aType, isPhase2bType } from "@gina/core";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { autoResultHint, orderingSummary, reviewRows, type ClientAnswer, type ClientInteractionType, type ScoreDetails } from "./model";
import { phase2aReviewRows, phase2aSummary } from "./phase2a-model";
import { phase2bReviewRows, regionCountSummary } from "./phase2b-model";
import { MarkBadge, qt } from "./ui";

/** Yalnız VELİ: alt madde başına çocuğun cevabı, sunucu işareti ve anahtardaki doğru cevap. Salt okunur. */
export function StructuredReview({
  type,
  payload,
  answer,
  details,
  answerKey,
}: {
  type: ClientInteractionType;
  payload: unknown;
  answer: ClientAnswer | undefined;
  details: ScoreDetails | null;
  answerKey: unknown;
}) {
  const { t } = useTranslation();
  const p2Labels = {
    selected: t("prova.qt.review.p2.selected"),
    notSelected: t("prova.qt.review.p2.notSelected"),
    shouldSelect: t("prova.qt.review.p2.shouldSelect"),
    shouldNotSelect: t("prova.qt.review.p2.shouldNotSelect"),
    marked: (fix: string | null) => (fix ? t("prova.qt.review.p2.markedFix", { fix }) : t("prova.qt.review.p2.markedNoFix")),
    notMarked: t("prova.qt.review.p2.notMarked"),
    notAnError: t("prova.qt.review.p2.notAnError"),
    stage1: t("prova.qt.review.p2.stage1"),
    stage2: t("prova.qt.review.p2.stage2"),
    time: t("prova.qt.review.p2.time"),
  };
  const rows = isPhase2bType(type) ? phase2bReviewRows(type, payload, answer, details, answerKey, p2Labels) : isPhase2aType(type) ? phase2aReviewRows(type, payload, answer, details, answerKey, {
    selected: t("prova.qt.review.p2.selected"),
    notSelected: t("prova.qt.review.p2.notSelected"),
    shouldSelect: t("prova.qt.review.p2.shouldSelect"),
    shouldNotSelect: t("prova.qt.review.p2.shouldNotSelect"),
    marked: (fix) => (fix ? t("prova.qt.review.p2.markedFix", { fix }) : t("prova.qt.review.p2.markedNoFix")),
    notMarked: t("prova.qt.review.p2.notMarked"),
    notAnError: t("prova.qt.review.p2.notAnError"),
    stage1: t("prova.qt.review.p2.stage1"),
    stage2: t("prova.qt.review.p2.stage2"),
  }) : reviewRows(type, payload, answer as never, details, answerKey, {
    yes: t("prova.qt.child.tf.true"),
    no: t("prova.qt.child.tf.false"),
    blank: (n) => t("prova.qt.review.blankN", { n }),
    value: t("prova.qt.review.value"),
    unit: t("prova.qt.review.unit"),
    position: (n) => t("prova.qt.review.positionN", { n }),
  });
  const order = type === "ordering" ? orderingSummary(details) : null;
  const orders = type === "ordering" && answerKey && typeof answerKey === "object" && Array.isArray((answerKey as { orders?: unknown }).orders)
    ? ((answerKey as { orders: unknown[] }).orders.length)
    : 0;
  const hint = autoResultHint(details);
  const p2 = isPhase2aType(type) || type === "region_select" ? phase2aSummary(type === "region_select" ? "mark_text" : type, details) : null;
  const regionCount = type === "region_select" ? regionCountSummary(details) : null;
  return (
    <View testID="qt-review" style={{ gap: 10 }}>
      {order ? (
        <Text testID="qt-review-order-summary" style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: qt.ink }}>
          {t("prova.qt.review.orderSummary", { correct: order.correct, required: order.required })}
        </Text>
      ) : null}
      {orders > 1 ? <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 15, color: qt.muted }}>{t("prova.qt.review.altOrders", { count: orders - 1 })}</Text> : null}
      {p2 ? (
        <Text testID="qt-review-p2-summary" style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, lineHeight: 22, color: qt.ink }}>
          {t(`prova.qt.review.p2.summary.${p2.key}`, p2.values)}
        </Text>
      ) : null}
      {regionCount ? (
        <Text testID="qt-review-region-count" style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, lineHeight: 22, color: qt.ink }}>
          {t("prova.qt.review.p2.summary.count", regionCount)}
        </Text>
      ) : null}
      {hint !== null ? <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 15, color: qt.ink }}>{t("prova.qt.review.autoHint", { score: Math.round(hint) })}</Text> : null}
      {rows.map((row) => (
        <View key={row.id} testID={`qt-review-row-${row.id}`} style={{ gap: 4, borderTopWidth: 1, borderTopColor: "#F0ECF4", paddingTop: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <Text style={{ flexGrow: 1, flexShrink: 1, fontFamily: "Nunito_700Bold", fontSize: 16, lineHeight: 22, color: qt.ink }}>{row.prompt}</Text>
            <MarkBadge mark={row.mark} />
          </View>
          <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 15, lineHeight: 21, color: qt.ink }}>
            {t("prova.qt.review.childAnswer", { text: row.given ?? t("prova.qt.review.noAnswer") })}
          </Text>
          {row.expected !== null ? (
            <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 15, lineHeight: 21, color: qt.mintDark }}>
              {t("prova.qt.review.correctAnswer", { text: row.expected })}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
