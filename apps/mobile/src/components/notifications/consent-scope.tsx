import { CHANNEL_CONSENT_VERSION, type MyNotificationChannels } from "@gina/core";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { InfoCard, parentStyles } from "@/components/ui/parent-screen";

/**
 * Consent scope in plain words: what each purpose covers, what is never in a message, how to stop,
 * and the parent's own recent changes (newest first). Marketing is shown closed until legal review.
 */
export function ConsentScope({ view }: { view: MyNotificationChannels }) {
  const { t, i18n } = useTranslation();
  const history = view.consent_history ?? [];
  const formatTime = (iso: string) => new Date(iso).toLocaleString(i18n.language === "en" ? "en-GB" : "tr-TR", { dateStyle: "medium", timeStyle: "short" });
  return <View testID="consent-scope" style={{ gap: 16 }}>
    <InfoCard title={t("channels.scope.title")} steps={[
      t("channels.scope.service"),
      t("channels.scope.announcement"),
      t(view.marketing_allowed ? "channels.scope.marketingOpen" : "channels.scope.marketingClosed"),
      t("channels.scope.privacy"),
      t("channels.scope.stop"),
    ]}>
      <Text style={parentStyles.muted}>{t("channels.scope.version", { version: CHANNEL_CONSENT_VERSION })}</Text>
    </InfoCard>
    <View style={parentStyles.card}>
      <Text accessibilityRole="header" style={[parentStyles.copy, { fontFamily: "Nunito_800ExtraBold" }]}>{t("channels.history.title")}</Text>
      {history.length === 0 ? <Text style={parentStyles.muted}>{t("channels.history.empty")}</Text> : history.map((entry, index) =>
        <View key={`${entry.at}-${index}`} testID="consent-entry" style={{ gap: 2 }}>
          <Text style={parentStyles.copy}>{t(entry.enabled ? "channels.history.on" : "channels.history.off", { channel: t(`channels.channel.${entry.channel}`), purpose: t(`channels.purpose.${entry.purpose}`) })}</Text>
          <Text style={parentStyles.muted}>{formatTime(entry.at)} · {t(`channels.history.source.${entry.source}`)}</Text>
        </View>)}
    </View>
  </View>;
}
