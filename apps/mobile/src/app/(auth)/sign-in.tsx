import { AuthIssueText, classifyAuthIssue, SocialSignIn, type AuthIssue } from "@/components/social-sign-in";
import { AuthLinkResend } from "@/components/email-verification";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Text, View } from "react-native";


import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ParentScreen, parentStyles, InfoCard } from "@/components/ui/parent-screen";
import { Toggle } from "@/components/ui/toggle";
import { supabase } from "@/lib/supabase";
import { resolveLocale } from "@gina/core";

type Mode = "in" | "up" | "reset";
/** Web only: lets the reset-password tab tell an operator to return to the admin tab. No address or token stored. */
const ADMIN_RESET_MARK = "gina.u01.adminReset";

export default function SignInScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ mode?: string; reason?: string; from?: string; error?: string; error_code?: string }>();
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState<Mode>(params.mode === "reset" ? "reset" : params.mode === "up" ? "up" : "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  // A redirect that lands here (expired link, cancelled provider) or a session that ended explains itself first.
  const [issue, setIssue] = useState<AuthIssue | null>(() =>
    params.reason === "session_expired" ? "session_expired" : params.error ? classifyAuthIssue({ error: params.error, error_code: params.error_code }) : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resend, setResend] = useState(false);
  const fromAdmin = params.from === "admin";
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = validEmail && (mode === "reset" || (password.length >= (mode === "up" ? 8 : 1) && (mode !== "up" || adult)));

  async function submit() {
    if (busy || !valid) return;
    setBusy(true); setIssue(null); setNotice(null); setResend(false);
    try {
      if (mode === "reset") {
        if (fromAdmin && Platform.OS === "web") {
          try { globalThis.localStorage?.setItem(ADMIN_RESET_MARK, String(Date.now())); } catch { /* copy only */ }
        }
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: Linking.createURL("/reset-password") });
        if (error) throw error;
        setNotice(t(fromAdmin ? "u01.adminResetSent" : "accountV5.resetSent"));
      } else {
        const result = mode === "in"
          ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
          : await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: Linking.createURL("/auth-callback"), data: { locale: resolveLocale(i18n.language) } } });
        if (result.error) throw result.error;
        if (result.data.session) router.replace("/");
        else { setPassword(""); setNotice(t("accountV5.checkEmail")); }
      }
    } catch (e) { setIssue(classifyAuthIssue(e)); } finally { setBusy(false); }
  }
  function change(next: Mode) { setMode(next); setIssue(null); setNotice(null); setResend(false); setPassword(""); setShowPassword(false); }
  const canResendSignup = issue === "email_not_confirmed" || issue === "expired" || (mode === "up" && !!notice);

  return <ParentScreen navigation={false} title={t(mode === "reset" ? "accountV5.resetTitle" : mode === "up" ? "auth.signUp" : "unified.loginTitle")} subtitle={t(mode === "reset" ? "unified.resetBody" : mode === "up" ? "unified.signupBody" : "unified.loginBody")}>
    {mode !== "reset" ? <View role="group" aria-label={t("u01.intentLabel")} style={{ flexDirection: "row", gap: 8 }}>
      {(["in", "up"] as const).map(option => <View key={option} style={{ flex: 1 }}>
        <Button aria-pressed={mode === option} accessibilityState={{ selected: mode === option }}
          title={t(option === "in" ? "u01.intentSignIn" : "u01.intentSignUp")} variant={mode === option ? "primary" : "secondary"}
          disabled={busy} onPress={() => { if (mode !== option) change(option); }} />
      </View>)}
    </View> : null}

    <View style={parentStyles.card}>
      {mode === "in" ? <Text style={parentStyles.title}>{t("unified.parentLogin")}</Text> : null}
      {mode === "up" ? <View style={{ gap: 4 }}>
        <Toggle label={t("accountV5.adult")} value={adult} onChange={setAdult} disabled={busy} />
        <Text style={parentStyles.muted}>{t("u01.adultOnce")}</Text>
      </View> : null}
      {mode !== "reset" ? <SocialSignIn disabled={busy} onBusy={setBusy} adult={mode === "up" ? adult : undefined} /> : null}
      {mode === "reset" && fromAdmin ? <Text style={parentStyles.muted}>{t("u01.adminResetHelp")}</Text> : null}
      <Field label={t("auth.email")} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} editable={!busy} returnKeyType={mode === "reset" ? "send" : "next"} onSubmitEditing={() => { if (mode === "reset") void submit(); }} />
      {mode !== "reset" ? <Field label={t("auth.password")} secureTextEntry={!showPassword} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChangeText={setPassword} editable={!busy} returnKeyType="go" onSubmitEditing={() => void submit()} /> : null}
      {mode !== "reset" ? <Toggle label={t(showPassword ? "unified.hidePassword" : "unified.showPassword")} value={showPassword} onChange={setShowPassword} disabled={busy}/> : null}
      {mode === "up" ? <Text style={parentStyles.muted}>{t("accountV5.passwordHint")}</Text> : null}
      {mode === "up" && !adult ? <Text style={parentStyles.muted}>{t("u01.adultRequired")}</Text> : null}
      <AuthIssueText issue={issue} />
      {notice ? <Text accessibilityLiveRegion="polite" style={[parentStyles.copy, { backgroundColor: "#F1EDFD", padding: 16, borderRadius: 12 }]}>{notice}</Text> : null}
      <Button title={t(mode === "reset" ? "accountV5.sendReset" : mode === "in" ? "auth.signIn" : "auth.signUp")} loading={busy} disabled={!valid} onPress={submit} />
      {issue === "invalid_login" && mode === "in" ? <Button variant="secondary" title={t("accountV5.forgot")} disabled={busy} onPress={() => change("reset")} /> : null}
      {canResendSignup && mode !== "reset" ? resend
        ? <View style={{ gap: 8 }}><Text style={parentStyles.title}>{t("u01.resendTitle")}</Text><AuthLinkResend kind="signup" initialEmail={email} /></View>
        : <Button variant="ghost" title={t("u01.resendPrompt")} disabled={busy} onPress={() => setResend(true)} /> : null}
      <View style={{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",gap:8}}>
        {mode === "in" && issue !== "invalid_login" ? <Button variant="ghost" title={t("accountV5.forgot")} disabled={busy} onPress={() => change("reset")} /> : null}
        {mode === "reset" ? <Button variant="ghost" title={t("u01.backToSignIn")} disabled={busy} onPress={() => change("in")} /> : null}
      </View>
    </View>
    {mode !== "reset" ? <InfoCard title={t("unified.childDeviceTitle")} body={t("unified.childDeviceBody")}>
      <Button variant="secondary" title={t("unified.connectDevice")} disabled={busy} onPress={() => router.push("/device/pair")} />
    </InfoCard> : null}
  </ParentScreen>;
}
