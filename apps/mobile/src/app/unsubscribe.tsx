import { channelErrorKey, describeUnsubscribeToken } from "@gina/core";
import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ParentScreen as Screen, parentStyles } from "@/components/ui/parent-screen";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/**
 * C10: public page behind the visible "stop announcement emails/SMS" link. Opening it changes nothing
 * (link scanners); the parent presses the button, the anon RPC verifies signature, expiry and single use.
 * Mail clients use the RFC 8058 one-click POST on the Edge function `channel-unsubscribe` instead.
 */
export default function UnsubscribeScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token) ?? "";
  const info = describeUnsubscribeToken(token);
  const apply = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("unsubscribe_with_token", { p_token: token });
      if (error) throw error;
      return data as unknown as { status?: "unsubscribed" | "already_done"; enabled?: boolean };
    },
  });
  const errorCode = apply.error && typeof apply.error === "object" && "message" in apply.error ? String(apply.error.message) : null;
  const subject = info ? t(`channels.unsubscribe.subject.${info.channel}.${info.purpose}`) : "";

  return <Screen navigation={false} title={t("channels.unsubscribe.title")}>
    <Head>
      <title>{t("channels.unsubscribe.title")}</title>
      <meta name="robots" content="noindex, nofollow, noarchive" />
      <meta name="referrer" content="no-referrer" />
    </Head>
    {!info ? <View testID="unsubscribe-invalid" style={parentStyles.card}>
      <Text style={parentStyles.copy}>{t("channels.unsubscribe.invalid")}</Text>
    </View> : apply.data ? <View testID="unsubscribe-done" accessibilityLiveRegion="polite" style={parentStyles.card}>
      <Text style={[parentStyles.copy, { fontFamily: "Nunito_800ExtraBold" }]}>{t(apply.data.status === "already_done" ? "channels.unsubscribe.already" : "channels.unsubscribe.done", { subject })}</Text>
      {apply.data.status === "already_done" && apply.data.enabled ? <Text style={parentStyles.muted}>{t("channels.unsubscribe.reEnabled")}</Text> : null}
      <Text style={parentStyles.muted}>{t("channels.unsubscribe.serviceKept")}</Text>
    </View> : <View testID="unsubscribe-ready" style={parentStyles.card}>
      <Text style={parentStyles.copy}>{t("channels.unsubscribe.body", { subject })}</Text>
      <Text style={parentStyles.muted}>{t("channels.unsubscribe.serviceKept")}</Text>
      {info.expired ? <Text style={parentStyles.muted}>{t("channels.unsubscribe.expiredHint")}</Text> : null}
      <Button title={t("channels.unsubscribe.action")} loading={apply.isPending} onPress={() => apply.mutate()} />
      {apply.error ? <Text accessibilityRole="alert" style={[parentStyles.copy, { color: "#A43135" }]}>{t(channelErrorKey(errorCode))}</Text> : null}
    </View>}
    <Button variant="secondary" title={t(claims?.role === "parent" ? "channels.unsubscribe.manage" : "channels.unsubscribe.signIn")}
      onPress={() => router.push(claims?.role === "parent" ? "/parent/notifications" : "/")} />
  </Screen>;
}
