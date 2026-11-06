import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { LEGAL_DOCUMENTS, privacyRequestMailto } from "@gina/core";
import { Button } from "@/components/ui/button";
import { ParentScreen, InfoCard, parentStyles } from "@/components/ui/parent-screen";
import { legalUrl, publishedLegal } from "@/lib/legal";

export function PrivacyCenter({ parent = false }: { parent?: boolean }) {
  const { t, i18n } = useTranslation();
  const [failed, setFailed] = useState(false);
  async function open(url: string) {
    setFailed(false);
    try { await Linking.openURL(url); } catch { setFailed(true); }
  }
  return <ParentScreen navigation={parent} title={t("privacyCenter.title")} subtitle={t("privacyCenter.subtitle")}>
    <InfoCard title={t("privacyCenter.documents")} body={!publishedLegal ? t("privacyCenter.unavailable") : undefined}>
      {publishedLegal ? <><Text style={parentStyles.muted}>{t("privacyCenter.version", { version: publishedLegal.version })}</Text>
        {LEGAL_DOCUMENTS.map(slug => <Button key={slug} variant="ghost" title={t(`privacyCenter.docs.${slug}`)} onPress={() => { const url = legalUrl(slug, i18n.language); if (url) void open(url); }} />)}</> : null}
    </InfoCard>
    <InfoCard title={t("privacyCenter.requests")} body={t("privacyCenter.requestBody")}>
      <Text selectable style={parentStyles.copy}>destek@ginafamily.com</Text>
      <Button variant="secondary" title={t("privacyCenter.requestAction")} onPress={() => void open(privacyRequestMailto("privacy", i18n.language))} />
      <Button variant="ghost" title={t("privacyCenter.deletionRequest")} onPress={() => void open(privacyRequestMailto("deletion", i18n.language))} />
      <Text style={parentStyles.muted}>{t("privacyCenter.emailNotice")}</Text>
    </InfoCard>
    {parent ? <View style={{ gap: 12 }}>
      <Button variant="secondary" title={t("privacyCenter.preferences")} onPress={() => router.push("/parent/notifications")} />
      <Button variant="secondary" title={t("privacyCenter.account")} onPress={() => router.push({ pathname: "/parent/menu", params: { section: "account" } })} />
    </View> : <Button variant="ghost" title={t("u01.backToSignIn")} onPress={() => router.replace("/(auth)/sign-in")} />}
    {failed ? <Text accessibilityLiveRegion="polite" style={parentStyles.copy}>{t("privacyCenter.openFailed")}</Text> : null}
  </ParentScreen>;
}
