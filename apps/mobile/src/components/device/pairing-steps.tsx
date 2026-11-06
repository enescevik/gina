import { Text, useWindowDimensions, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Check, Smartphone, Tablet } from "lucide-react-native";
import { parentStyles } from "@/components/ui/parent-screen";

/**
 * What happens on which device, as one picture: the child device creates the code / QR,
 * the parent phone scans or types it and then chooses who may use the device.
 * `current` highlights the step the person is on (1–4); earlier steps show a check.
 */
export function PairingSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 700 && fontScale < 1.3;
  const columns = [
    { key: "child", Icon: Tablet, title: t("u02.steps.childDevice"), steps: [1, 2] },
    { key: "parent", Icon: Smartphone, title: t("u02.steps.parentPhone"), steps: [3, 4] },
  ] as const;
  return (
    <View testID="pairing-steps" accessibilityRole="list" accessibilityLabel={t("u02.steps.title")} style={[parentStyles.card, { gap: 14 }]}>
      <Text accessibilityRole="header" style={[parentStyles.copy, { fontFamily: "Nunito_800ExtraBold" }]}>{t("u02.steps.title")}</Text>
      <View style={{ flexDirection: wide ? "row" : "column", gap: 14 }}>
        {columns.map(({ key, Icon, title, steps }) => (
          <View key={key} style={{ flex: 1, gap: 10, padding: 14, borderRadius: 20, backgroundColor: key === "child" ? "#EDF7F1" : "#F5F1FC" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
                <Icon size={24} color={key === "child" ? "#247A68" : "#6042DE"} />
              </View>
              <Text style={[parentStyles.copy, { flex: 1, fontFamily: "Nunito_800ExtraBold" }]}>{title}</Text>
            </View>
            {steps.map((step) => {
              const done = step < current;
              const active = step === current;
              return (
                <View key={step} accessibilityRole="text" accessibilityState={{ selected: active }} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: done ? "#247A68" : active ? "#6042DE" : "#FFFFFF", borderWidth: done || active ? 0 : 1, borderColor: "#CFC6E4" }}>
                    {done ? <Check size={16} color="#FFFFFF" /> : <Text style={{ fontFamily: "Nunito_800ExtraBold", color: active ? "#FFFFFF" : "#625C85" }}>{step}</Text>}
                  </View>
                  <Text style={[parentStyles.muted, { flex: 1 }, active && { color: "#201951", fontFamily: "Nunito_700Bold" }]}>{t(step === 2 || step === 3 ? `auth1.steps.step${step}` : `u02.steps.step${step}`)}</Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
