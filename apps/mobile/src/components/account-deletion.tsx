import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import type { DeletionPreview } from "@gina/core";
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { Toggle } from "./ui/toggle";
import { parentStyles } from "./ui/parent-screen";
import { EmailVerification } from "./email-verification";
import { DeletionPreviewSheet } from "./deletion-preview-sheet";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

type Reauth = { password: string } | { reauthentication: "email_otp" };

/** Edge errors arrive as an HTTP response; surface only the server's error code. */
async function invokeDelete(reauth: Reauth, previewToken?: string) {
  const { data, error } = await supabase.functions.invoke("delete-account", { body: { confirm: true, ...reauth, ...(previewToken ? { preview_token: previewToken } : {}) } });
  if (error) {
    let code = "deletion_failed";
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try { code = (await context.json())?.error ?? code; } catch { /* keep generic */ }
    }
    throw new Error(code);
  }
  if (data?.ok !== true) throw new Error("deletion_failed");
}

/** Available before family setup as well as in the parent menu. No client-side admin key. */
export function AccountDeletion() {
  const { t } = useTranslation();
  const { session, claims } = useSession();
  // Keep the chosen method stable if OTP adds an email identity to a social account.
  const [socialOnly] = useState(() => !!session?.user.identities?.length && !session.user.identities.some(i => i.provider === 'email'));
  // The impact preview needs a parent of a family; before family setup there is nothing to preview.
  const withPreview = claims?.role === "parent" && !!claims.family_id;
  const [verifiedAt, setVerifiedAt] = useState(0);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const reauth = (): Reauth => (socialOnly ? { reauthentication: "email_otp" } : { password });
  const reauthReady = socialOnly ? verifiedAt > 0 : !!password;
  const assertReady = () => {
    if (!confirmed || !reauthReady || (socialOnly && Date.now() - verifiedAt > 240000)) throw new Error("confirmation_required");
  };
  const finish = async () => {
    setDeleted(true); setPassword("");
    // The server has already deleted Auth and its refresh tokens. Local cleanup must not mask success.
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) throw signOutError;
    router.replace("/(auth)/sign-in");
  };
  const remove = useMutation({
    mutationFn: async () => {
      assertReady();
      await invokeDelete(reauth());
      await finish();
    },
  });
  const reset = useCallback(() => { setOpen(false); setPassword(""); setVerifiedAt(0); setConfirmed(false); remove.reset(); }, [remove]);
  const perform = async (preview: DeletionPreview) => {
    assertReady();
    await invokeDelete(reauth(), preview.preview_token);
  };
  // Own codes of delete-account: wrong password/OTP or an expired verification.
  const errorText = (code: string) => (code === "reauthentication_failed" || code === "confirmation_required" || code === "invalid_input" ? t("accountV5.deleteFailed") : null);

  if (deleted) return <View style={parentStyles.card}><Text style={parentStyles.copy}>{t("accountV5.deleteDone")}</Text>
    <Button title={t("auth.signIn")} onPress={async () => { await supabase.auth.signOut({ scope: "local" }); router.replace("/(auth)/sign-in"); }} /></View>;

  const reauthFields = <>
    {socialOnly ? <EmailVerification onVerified={() => setVerifiedAt(Date.now())} onExpired={() => setVerifiedAt(0)} /> : <>
      <Text style={parentStyles.muted}>{t("accountV5.deletePassword")}</Text>
      <Field label={t("auth.password")} secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} editable={!remove.isPending} /></>}
    <Toggle label={t("accountV5.deleteConfirm")} value={confirmed} onChange={setConfirmed} disabled={remove.isPending} />
  </>;

  if (withPreview) return <>
    <Text style={parentStyles.copy}>{t("accountV5.deleteStore")}</Text>
    <Button variant="danger" title={t("deletionPreview.reviewAccount")} onPress={() => setOpen(true)} />
    {open ? <DeletionPreviewSheet target={{ kind: "account" }} ready={confirmed && reauthReady} perform={perform} errorText={errorText}
      onClose={reset} onDone={() => { void finish().catch(() => undefined); }}>
      <View style={{ gap: 12 }}>
        <Text accessibilityRole="header" style={[parentStyles.copy, { fontFamily: "Nunito_800ExtraBold" }]}>{t("deletionPreview.accountReauthHeading")}</Text>
        <Text style={parentStyles.muted}>{t("deletionPreview.reauth")}</Text>
        {reauthFields}
      </View>
    </DeletionPreviewSheet> : null}
  </>;

  if (!open) return <Button variant="ghost" title={t("accountV5.deleteTitle")} onPress={() => setOpen(true)} />;
  return <View style={parentStyles.card}>
    <Text style={parentStyles.title}>{t("accountV5.deleteTitle")}</Text>
    <Text style={parentStyles.copy}>{t("accountV5.deleteBody")}</Text>
    <Text style={parentStyles.copy}>{t("accountV5.deleteStore")}</Text>
    {reauthFields}
    {remove.error ? <Text accessibilityRole="alert" style={[parentStyles.copy, { color: "#A43135" }]}>{t("accountV5.deleteFailed")}</Text> : null}
    <Button variant="danger" title={t("accountV5.deleteNow")} loading={remove.isPending} disabled={!confirmed || !reauthReady} onPress={() => remove.mutate()} />
    <Button variant="ghost" title={t("common.cancel")} disabled={remove.isPending} onPress={reset} />
  </View>;
}
