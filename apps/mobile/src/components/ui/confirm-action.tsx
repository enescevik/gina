import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button } from "./button";

/** Inline confirmation works identically on native and web, including keyboard users. */
export function ConfirmAction({ title, busy, onConfirm }: { title: string; busy?: boolean; onConfirm: () => void }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  return confirming ? <View style={{ gap: 10, flex: 1 }}>
    <Text accessibilityLiveRegion="polite" style={{ fontFamily: "Nunito_600SemiBold", fontSize: 16, color: "#294A48" }}>{t("release.confirmRemove")}</Text>
    <Button title={title} variant="danger" loading={busy} onPress={() => { onConfirm(); setConfirming(false); }} />
    <Button title={t("common.cancel")} variant="ghost" disabled={busy} onPress={() => setConfirming(false)} />
  </View> : <Button title={title} variant="ghost" disabled={busy} onPress={() => setConfirming(true)} />;
}
