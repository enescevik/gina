import type { StructuredAnswer, StructuredInteractionType } from "@gina/core";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { autoResultHint, orderingSummary, reviewRows, type ScoreDetails } from "./model";
import { MarkBadge, qt } from "./ui";

/** Yalnız VELİ: alt madde başına çocuğun cevabı, sunucu işareti ve anahtardaki doğru cevap. Salt okunur. */
export function StructuredReview({
  type,
  payload,
  answer,
  details,
  answerKey,
}: {
  type: StructuredInteractionType;
  payload: unknown;
  answer: StructuredAnswer | undefined;
  details: ScoreDetails | null;
  answerKey: unknown;
}) {
  const { t } = useTranslation();
  const rows = reviewRows(type, payload, answer, details, answerKey, {
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
  return (
    <View testID="qt-review" style={{ gap: 10 }}>
      {order ? (
        <Text testID="qt-review-order-summary" style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: qt.ink }}>
          {t("prova.qt.review.orderSummary", { correct: order.correct, required: order.required })}
        </Text>
      ) : null}
      {orders > 1 ? <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 15, color: qt.muted }}>{t("prova.qt.review.altOrders", { count: orders - 1 })}</Text> : null}
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
