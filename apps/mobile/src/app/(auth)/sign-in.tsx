import { router } from "expo-router";
import * as Linking from "expo-linking";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import Wordmark from "../../../../../packages/assets/brand/yan-yana/logo-wordmark.svg";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { ErrorText } from "@/components/ui/screen";
import { Toggle } from "@/components/ui/toggle";
import { supabase } from "@/lib/supabase";

export default function SignInScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = validEmail && (mode === "reset" || (password.length >= (mode === "up" ? 8 : 1) && (mode !== "up" || adult)));

  async function submit() {
    if (busy || !valid) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL("/reset-password") });
        if (error) throw error;
        setNotice(t("accountV5.resetSent"));
      } else {
        const result = mode === "in"
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password });
        if (result.error) throw result.error;
        if (result.data.session) router.replace("/");
        else { setPassword(""); setNotice(t("accountV5.checkEmail")); }
      }
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  function change(next: typeof mode) { setMode(next); setError(null); setNotice(null); setPassword(""); }
  return <ParentScreen navigation={false} title={t(mode === "reset" ? "accountV5.resetTitle" : mode === "up" ? "auth.signUp" : "accountV5.welcome")} subtitle={t("accountV5.welcomeBody")}>
    <Wordmark width={112} height={46} accessibilityLabel={t("app.name")} />
    <View style={{ gap: 14 }}>
      <Field label={t("auth.email")} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!busy} />
      {mode !== "reset" ? <Field label={t("auth.password")} secureTextEntry autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChangeText={setPassword} editable={!busy} /> : null}
      {mode === "up" ? <><Text style={parentStyles.muted}>{t("accountV5.passwordHint")}</Text><Toggle label={t("accountV5.adult")} value={adult} onChange={setAdult} disabled={busy} /></> : null}
      <ErrorText error={error} />
      {notice ? <Text accessibilityLiveRegion="polite" style={[parentStyles.copy, { backgroundColor: "#E6F3ED", padding: 16, borderRadius: 12 }]}>{notice}</Text> : null}
      <Button title={t(mode === "reset" ? "accountV5.sendReset" : mode === "in" ? "auth.signIn" : "auth.signUp")} loading={busy} disabled={!valid} onPress={submit} />
      {mode === "in" ? <Button variant="ghost" title={t("accountV5.forgot")} disabled={busy} onPress={() => change("reset")} /> : null}
      <Button variant="secondary" title={t(mode === "in" ? "auth.signUp" : "auth.signIn")} disabled={busy} onPress={() => change(mode === "in" ? "up" : "in")} />
    </View>
    <View style={{ borderTopWidth: 1, borderColor: "#E4DAC8", paddingTop: 16, marginTop: 8 }}>
      <Button variant="ghost" title={t("auth.thisIsChildTablet")} disabled={busy} onPress={() => router.push("/device/pair")} />
    </View>
  </ParentScreen>;
}
