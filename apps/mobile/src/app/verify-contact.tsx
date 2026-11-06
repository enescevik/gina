import { parseVerificationLink } from "@gina/core";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ParentScreen as Screen, parentStyles } from "@/components/ui/parent-screen";
import { useChildMode } from "@/lib/child-mode";
import { useSession } from "@/lib/session";

/**
 * C10: target of the verification deep link in the email (`/verify-contact?kind=email&code=…`).
 * The code is bound to the parent account that asked for it, so this page only hands it to the
 * preferences screen of a signed-in parent; nothing is confirmed by opening the link.
 */
export default function VerifyContactScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const { actingChild } = useChildMode();
  const params = useLocalSearchParams<{ kind?: string; code?: string }>();
  const link = parseVerificationLink(params);
  if (link && claims?.role === "parent" && !actingChild) {
    return <Redirect href={{ pathname: "/parent/notifications", params: { kind: link.kind, code: link.code } }} />;
  }
  return <Screen navigation={false} title={t("channels.verifyLink.title")}>
    <Head>
      <title>{t("channels.verifyLink.title")}</title>
      <meta name="robots" content="noindex, nofollow, noarchive" />
      <meta name="referrer" content="no-referrer" />
    </Head>
    <View testID={link ? "verify-link-signin" : "verify-link-invalid"} style={parentStyles.card}>
      <Text style={parentStyles.copy}>{t(link ? "channels.verifyLink.signIn" : "channels.verifyLink.invalid")}</Text>
      {link ? <Text style={parentStyles.muted}>{t("channels.verifyLink.manual", { code: link.code })}</Text> : null}
      <Button title={t("channels.verifyLink.open")} onPress={() => router.replace("/")} />
    </View>
  </Screen>;
}
