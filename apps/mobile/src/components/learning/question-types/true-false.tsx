import { setTrueFalse, emptyAnswer, type AnswerOf, type TrueFalsePayload } from "@gina/core";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { Help, Option, qt } from "./ui";

/** QT10 — Doğru/yanlış grubu: her ifade için açık seçili/cevapsız durum ve seçimi kaldırma. */
export function TrueFalseQuestion({
  payload,
  answer,
  onChange,
  disabled,
}: {
  payload: TrueFalsePayload;
  answer: AnswerOf<"true_false"> | undefined;
  onChange: (a: AnswerOf<"true_false">) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const current = answer ?? emptyAnswer("true_false");
  return (
    <View style={{ gap: 12 }}>
      <Help>{t("prova.qt.child.tf.help")}</Help>
      {payload.statements.map((s, i) => {
        const value = current.items[s.id];
        const n = i + 1;
        return (
          <View
            key={s.id}
            testID={`qt-tf-${s.id}`}
            style={{ gap: 10, borderRadius: 20, borderWidth: 2, borderColor: value === undefined ? qt.line : qt.purple, backgroundColor: "#FFFFFF", padding: 14 }}
          >
            <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 18, lineHeight: 26, color: qt.ink }}>
              {n}. {s.text}
            </Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={t("prova.qt.child.tf.statement", { n, text: s.text })} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {([true, false] as const).map((option) => {
                const label = t(option ? "prova.qt.child.tf.true" : "prova.qt.child.tf.false");
                const selected = value === option;
                return (
                  <View key={String(option)} style={{ flexGrow: 1, flexBasis: 120 }}>
                    <Option
                      testID={`qt-tf-${s.id}-${option ? "true" : "false"}`}
                      role="radio"
                      label={label}
                      accessibilityLabel={t("prova.qt.child.tf.optionA11y", { n, option: label })}
                      state={{ checked: selected }}
                      selected={selected}
                      disabled={disabled}
                      onPress={() => onChange(setTrueFalse(current, s.id, option))}
                    />
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <Text style={{ flexGrow: 1, fontFamily: "Nunito_600SemiBold", fontSize: 15, lineHeight: 21, color: qt.muted }}>
                {value === undefined ? t("prova.qt.child.tf.notChosen") : t("prova.qt.child.tf.chosen", { option: t(value ? "prova.qt.child.tf.true" : "prova.qt.child.tf.false") })}
              </Text>
              {value !== undefined ? (
                <Pressable
                  testID={`qt-tf-${s.id}-clear`}
                  accessibilityRole="button"
                  accessibilityLabel={t("prova.qt.child.tf.clearA11y", { n })}
                  disabled={disabled}
                  onPress={() => onChange(setTrueFalse(current, s.id, null))}
                  style={{ minHeight: 48, minWidth: 48, justifyContent: "center", paddingHorizontal: 10 }}
                >
                  <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: qt.purple }}>{t("prova.qt.child.tf.clear")}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
