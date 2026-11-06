import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { TaskReturnReason } from "@gina/core";
import { c, s } from "./theme";

/**
 * C03: geri gönderilmiş görevde sakin, uygulanabilir sıradaki adım. Neden yoksa (eski kayıt ya da veli neden
 * seçmedi) mevcut genel açıklama gösterilir; uygulama neden uydurmaz. Velinin kısa notu kelimesi kelimesine,
 * tırnak içinde ve yalnız bu çocuğun kendi gönderiminde görünür.
 */
export function ReturnNext({ returned, compact = false, testID = "child-return-next" }: {
  returned: { reason: TaskReturnReason; note: string | null } | null | undefined;
  compact?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  if (!returned) {
    return <Text style={s.small}>{t("childMint.returnedBody")}</Text>;
  }
  return (
    <View testID={testID} accessibilityLiveRegion="polite" style={{ backgroundColor: "#FFF6E5", borderRadius: 14, padding: compact ? 8 : 10, gap: 4 }}>
      <Text style={[s.small, { color: c.ink }]}>{t("c03.child.nextStep")}</Text>
      <Text style={[s.text, { color: c.ink }]}>{t(`c03.childNext.${returned.reason}`)}</Text>
      {returned.note ? <Text testID={`${testID}-note`} style={s.small}>{t("c03.child.note", { note: `“${returned.note}”` })}</Text> : null}
    </View>
  );
}
