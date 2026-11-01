import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";


import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ParentScreen, parentStyles, InfoCard } from "@/components/ui/parent-screen";
import { ErrorText } from "@/components/ui/screen";
import { Toggle } from "@/components/ui/toggle";
import { supabase } from "@/lib/supabase";

export default function SignInScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{mode?:string}>();
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<"in" | "up" | "reset">(params.mode === "reset" ? "reset" : "in");
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
  function change(next: typeof mode) { setMode(next); setError(null); setNotice(null); setPassword(""); setShowPassword(false); }
  return <ParentScreen navigation={false} title={t(mode === "reset" ? "accountV5.resetTitle" : mode === "up" ? "auth.signUp" : "unified.loginTitle")} subtitle={t(mode === "reset" ? "unified.resetBody" : mode === "up" ? "unified.signupBody" : "unified.loginBody")}>

    <View style={parentStyles.card}>
      <Text style={parentStyles.title}>{t(mode === "in" ? "unified.parentLogin" : mode === "up" ? "auth.signUp" : "accountV5.sendReset")}</Text>
      <Field label={t("auth.email")} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!busy} />
      {mode !== "reset" ? <Field label={t("auth.password")} secureTextEntry={!showPassword} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChangeText={setPassword} editable={!busy} /> : null}
      {mode !== "reset" ? <Toggle label={t(showPassword ? "unified.hidePassword" : "unified.showPassword")} value={showPassword} onChange={setShowPassword} disabled={busy}/> : null}
      {mode === "up" ? <><Text style={parentStyles.muted}>{t("accountV5.passwordHint")}</Text><Toggle label={t("accountV5.adult")} value={adult} onChange={setAdult} disabled={busy} /></> : null}
      <ErrorText error={error} />
      {notice ? <Text accessibilityLiveRegion="polite" style={[parentStyles.copy, { backgroundColor: "#F1EDFD", padding: 16, borderRadius: 12 }]}>{notice}</Text> : null}
      <Button title={t(mode === "reset" ? "accountV5.sendReset" : mode === "in" ? "auth.signIn" : "auth.signUp")} loading={busy} disabled={!valid} onPress={submit} />
      {mode === "in" ? <Button variant="ghost" title={t("accountV5.forgot")} disabled={busy} onPress={() => change("reset")} /> : null}
      <Button variant="secondary" title={t(mode === "in" ? "auth.signUp" : "auth.signIn")} disabled={busy} onPress={() => change(mode === "in" ? "up" : "in")} />
    </View>
    {mode === "in" ? <InfoCard title={t("unified.childDeviceTitle")} body={t("unified.childDeviceBody")}>
      <Button variant="secondary" title={t("unified.connectDevice")} disabled={busy} onPress={() => router.push("/device/pair")} />
    </InfoCard> : null}
  </ParentScreen>;
}
