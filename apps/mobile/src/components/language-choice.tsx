import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Globe } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { setAppLanguage } from "@/lib/i18n";
import { resolveLocale } from "@gina/core";

/** Full names in settings; compact, labelled buttons in public-page headers. */
export function LanguageChoice({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [temporary, setTemporary] = useState(false);
  const current = resolveLocale(i18n.language);
  return <View style={{ gap: 6, flexShrink: 1 }}>
    {!compact && <Text style={styles.title}>{t("language.title")}</Text>}
    <View accessibilityRole="radiogroup" accessibilityLabel={t("language.title")} style={styles.row}>
      <Globe size={18} color="#625C85" accessible={false} />
      {(["tr", "en"] as const).map(locale => <Pressable key={locale} testID={`language-${locale}`}
        accessibilityRole="radio" aria-checked={current === locale} accessibilityLabel={locale === "tr" ? "Türkçe" : "English"}
        accessibilityState={{ checked: current === locale, disabled: busy }} disabled={busy}
        onPress={async () => { setBusy(true); try { setTemporary(!(await setAppLanguage(locale))); } finally { setBusy(false); } }}
        style={[styles.option, !compact && { flex: 1 }, current === locale && styles.selected]}>
        <Text style={[styles.label, current === locale && { color: "#FFFFFF" }]}>{compact ? locale.toUpperCase() : locale === "tr" ? "Türkçe" : "English"}</Text>
      </Pressable>)}
    </View>
    {!compact && <Text style={styles.hint}>{t("language.help")}</Text>}
    {temporary && <Text accessibilityLiveRegion="polite" style={styles.hint}>{t("language.temporary")}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  option: { minWidth: 48, minHeight: 48, paddingHorizontal: 10, paddingVertical: 10, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#EEE8FA" },
  selected: { backgroundColor: "#6042DE" },
  label: { fontFamily: "Nunito_800ExtraBold", fontSize: 15, color: "#41336B" },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 18, color: "#201951" },
  hint: { fontFamily: "Nunito_400Regular", fontSize: 14, lineHeight: 21, color: "#625C85" },
});
