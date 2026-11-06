import type { AnswerState } from "@gina/core";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { qt } from "./ui";

const MARK: Record<AnswerState, string> = { unanswered: "○", partial: "◐", complete: "●" };

/**
 * Soru gezgini: her soru için Boş / Yarım / Cevaplandı (simge + erişilebilir metin; renk tek başına
 * anlam taşımaz). Doğruluk göstermez.
 */
export function QuestionNavigator({
  states,
  current,
  onSelect,
  disabled,
}: {
  states: AnswerState[];
  current: number;
  onSelect: (index: number) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <View testID="qt-navigator" accessibilityRole="toolbar" accessibilityLabel={t("prova.qt.child.navigatorLabel")} style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {states.map((state, i) => {
          const here = i === current;
          const label = t("prova.qt.child.navItem", { n: i + 1, state: t(`prova.qt.child.state.${state}`) }) + (here ? `, ${t("prova.qt.child.navCurrent")}` : "");
          return (
            <Pressable
              key={i}
              testID={`qt-nav-${i + 1}-${state}`}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: here, disabled }}
              disabled={disabled}
              onPress={() => onSelect(i)}
              style={{
                minWidth: 52,
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                paddingHorizontal: 8,
                borderRadius: 16,
                borderWidth: here ? 3 : 2,
                borderColor: here ? qt.ink : state === "unanswered" ? qt.line : qt.purple,
                backgroundColor: state === "complete" ? qt.lilac : state === "partial" ? qt.warm : "#FFFFFF",
              }}
            >
              <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16, color: qt.ink }}>{i + 1}</Text>
              <Text aria-hidden style={{ fontSize: 13, color: qt.purpleDark }}>{MARK[state]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13, lineHeight: 18, color: qt.muted }}>
        {`${MARK.complete} ${t("prova.qt.child.state.complete")}   ${MARK.partial} ${t("prova.qt.child.state.partial")}   ${MARK.unanswered} ${t("prova.qt.child.state.unanswered")}`}
      </Text>
    </View>
  );
}
