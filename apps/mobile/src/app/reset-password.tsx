import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Field } from "@/components/ui/field";
import { ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { AuthIssueText, classifyAuthIssue, type AuthIssue } from "@/components/social-sign-in";
import { AuthLinkResend } from "@/components/email-verification";
import { useSession } from "@/lib/session";
import { readAuthRedirectError, recoveryExchangeIssue } from "@gina/core";
import { supabase } from "@/lib/supabase";

/** Set by the sign-in reset form opened from the admin panel (web, same browser). Only a timestamp. */
const ADMIN_RESET_MARK = "gina.u01.adminReset";
function takeAdminMark() {
  if (Platform.OS !== "web") return false;
  try {
    const at = Number(globalThis.localStorage?.getItem(ADMIN_RESET_MARK) ?? 0);
    globalThis.localStorage?.removeItem(ADMIN_RESET_MARK);
    return at > 0 && Date.now() - at < 2 * 3600_000;
  } catch { return false; }
}
function redirectIssue(params: { error?: string; error_code?: string; error_description?: string }): AuthIssue | null {
  const found = Platform.OS === "web" && typeof window !== "undefined"
    ? readAuthRedirectError(window.location.search, window.location.hash)
    : params.error ? readAuthRedirectError(new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string")).toString(), "") : null;
  return found ? classifyAuthIssue(found) : null;
}

/** PKCE recovery: native consumes the code; web is consumed by the auth client at startup. */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_code?: string; error_description?: string }>();
  const { code } = params;
  const { session, recovering, loading } = useSession();
  const started = useRef(false);
  const [checking, setChecking] = useState(Platform.OS !== "web" && !!code);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | { admin: boolean }>(null);
  const [issue, setIssue] = useState<AuthIssue | null>(null);
  const [linkIssue] = useState(() => redirectIssue(params));
  const [exchangeAttempt, setExchangeAttempt] = useState(0);
  const [exchangeIssue, setExchangeIssue] = useState<"offline" | "expired" | null>(null);
  useEffect(() => {
    if (Platform.OS === "web" || !code || started.current) return;
    started.current = true;
    // Used/expired/other-app link needs a new link; offline keeps the same link and offers a retry.
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => { if (error) throw error; setExchangeIssue(null); })
      .catch((e: unknown) => setExchangeIssue(recoveryExchangeIssue(e))).finally(() => setChecking(false));
  }, [code, exchangeAttempt]);
  const retryExchange = () => { started.current = false; setChecking(true); setExchangeAttempt((n) => n + 1); };
  const ready = password.length >= 8 && password === confirm;
  async function save() {
    if (busy || !recovering || !ready) return;
    setBusy(true); setIssue(null);
    try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; setPassword(""); setConfirm(""); setDone({ admin: takeAdminMark() }); }
    catch (e) { setIssue(classifyAuthIssue(e)); } finally { setBusy(false); }
  }
  const canSave = !!session && recovering && !linkIssue && !exchangeIssue && issue !== "expired";
  const exchangeOffline = !linkIssue && exchangeIssue === "offline";
  return <ParentScreen navigation={false} title={t("accountV5.resetTitle")} loading={checking || (loading && !done)}>
    {done ? <>
      <Text accessibilityLiveRegion="polite" style={parentStyles.copy}>{t("accountV5.passwordChanged")}</Text>
      {done.admin ? <Text style={[parentStyles.copy, { backgroundColor: "#F1EDFD", padding: 16, borderRadius: 12 }]}>{t("u01.passwordChangedAdmin")}</Text> : null}
      <Button variant={done.admin ? "secondary" : "primary"} title={t("common.continue")} onPress={() => router.replace("/")} />
    </> : canSave ? <>
      <Text style={parentStyles.copy}>{t("accountV5.passwordHint")}</Text>
      <Field label={t("auth.password")} secureTextEntry={!showPassword} autoComplete="new-password" value={password} onChangeText={setPassword} editable={!busy} returnKeyType="next" />
      <Field label={t("accountV5.confirmPassword")} secureTextEntry={!showPassword} autoComplete="new-password" value={confirm} onChangeText={setConfirm} editable={!busy} returnKeyType="go" onSubmitEditing={() => void save()} error={confirm.length > 0 && password !== confirm ? t("unified.passwordMismatch") : undefined} />
      <Toggle label={t(showPassword ? "unified.hidePassword" : "unified.showPassword")} value={showPassword} onChange={setShowPassword} disabled={busy}/>
      <AuthIssueText issue={issue} />
      <Button title={t("common.save")} disabled={!ready} loading={busy} onPress={save} />
      {issue === "session_expired" ? <Button variant="secondary" title={t("u01.newResetLink")} onPress={() => setIssue("expired")} /> : null}
    </> : exchangeOffline ? <>
      <AuthIssueText issue="offline" />
      <Button title={t("common.retry")} onPress={retryExchange} />
      <Button variant="ghost" title={t("u01.backToSignIn")} onPress={() => router.replace("/(auth)/sign-in")} />
    </> : <>
      {/* Expired, used or opened elsewhere: ask for a new link right here instead of a dead end. */}
      <Text style={parentStyles.copy}>{t(linkIssue === "offline" ? "release.networkError" : "accountV5.resetExpired")}</Text>
      <View style={[parentStyles.card, { gap: 12 }]}>
        <Text style={parentStyles.title}>{t("u01.newResetLink")}</Text>
        <Text style={parentStyles.muted}>{t("u01.resetExpiredInline")}</Text>
        <AuthLinkResend kind="recovery" />
      </View>
      <Button variant="ghost" title={t("u01.backToSignIn")} onPress={() => router.replace("/(auth)/sign-in")} />
    </>}
  </ParentScreen>;
}
