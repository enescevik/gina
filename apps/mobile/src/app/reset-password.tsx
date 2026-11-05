import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Text } from "react-native";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Field } from "@/components/ui/field";
import { ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { ErrorText } from "@/components/ui/screen";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** PKCE recovery: native consumes the code; web is consumed by the auth client at startup. */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { session, recovering } = useSession();
  const started = useRef(false);
  const [checking, setChecking] = useState(Platform.OS !== "web" && !!code);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (Platform.OS === "web" || !code || started.current) return;
    started.current = true;
    void supabase.auth.exchangeCodeForSession(code).then(({ error }) => { if (error) throw error; }).catch(setError).finally(() => setChecking(false));
  }, [code]);
  async function save() {
    if (busy || !recovering || password.length < 8 || password !== confirm) return;
    setBusy(true); setError(null);
    try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; setPassword(""); setConfirm(""); setDone(true); }
    catch (e) { setError(e); } finally { setBusy(false); }
  }
  return <ParentScreen navigation={false} title={t("accountV5.resetTitle")} loading={checking}>
    {done ? <><Text style={parentStyles.copy}>{t("accountV5.passwordChanged")}</Text><Button title={t("common.continue")} onPress={() => router.replace("/")} /></> : session && recovering ? <>
      <Text style={parentStyles.copy}>{t("accountV5.passwordHint")}</Text>
      <Field label={t("auth.password")} secureTextEntry={!showPassword} autoComplete="new-password" value={password} onChangeText={setPassword} editable={!busy} />
      <Field label={t("accountV5.confirmPassword")} secureTextEntry={!showPassword} autoComplete="new-password" value={confirm} onChangeText={setConfirm} editable={!busy} error={confirm.length > 0 && password !== confirm ? t("unified.passwordMismatch") : undefined} />
      <Toggle label={t(showPassword ? "unified.hidePassword" : "unified.showPassword")} value={showPassword} onChange={setShowPassword} disabled={busy}/>
      <Button title={t("common.save")} disabled={password.length < 8 || password !== confirm} loading={busy} onPress={save} />
    </> : <><Text style={parentStyles.copy}>{t("accountV5.resetExpired")}</Text><Button title={t("accountV5.sendReset")} onPress={() => router.replace({pathname:"/(auth)/sign-in",params:{mode:"reset"}})} /></>}
    <ErrorText error={error} />
  </ParentScreen>;
}
