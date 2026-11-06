import { useMutation } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Text, View } from "react-native";
import type { DeletionPreview } from "@gina/core";
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { Toggle } from "./ui/toggle";
import { parentStyles } from "./ui/parent-screen";
import { EmailVerification } from "./email-verification";
import { DeletionPreviewSheet } from "./deletion-preview-sheet";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { appleReauthenticate, type AppleReauth, freshAppleOAuth, hasAppleIdentity } from "@/lib/social-auth";

type Reauth = { password: string } | { reauthentication: "email_otp" } | AppleReauth;
type Revocation = "succeeded" | "pending" | "manual_required";

/** Edge errors arrive as an HTTP response; surface only the server's error code. */
async function invokeDelete(reauth: Reauth, requestId: string, previewToken?: string): Promise<Revocation | null> {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    body: { confirm: true, ...reauth, request_id: requestId, ...(previewToken ? { preview_token: previewToken } : {}) },
  });
  if (error) {
    let code = "deletion_failed";
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try { code = (await context.json())?.error ?? code; } catch { /* keep generic */ }
    }
    throw new Error(code);
  }
  if (data?.ok !== true) throw new Error("deletion_failed");
  return data.apple_revocation ?? null;
}

/** H01: fresh Sign in with Apple before deleting an Apple-linked account (lets the server revoke the token). */
function AppleVerification({ verified, onVerified }: { verified: boolean; onVerified: (proof: AppleReauth) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (verified) return <Text accessibilityLiveRegion="polite" style={[parentStyles.copy, { color: "#247A68" }]}>{t("accountV5.appleReauthDone")}</Text>;
  const verify = async () => {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const proof = await appleReauthenticate();
      if (proof && proof !== "redirected") onVerified(proof);
    } catch { setError(true); } finally { setBusy(false); }
  };
  return <View style={{ gap: 12 }}>
    <Text style={parentStyles.muted}>{t("accountV5.appleReauthHelp")}</Text>
    {Platform.OS === "web" ? <Text style={parentStyles.muted}>{t("accountV5.appleReauthWeb")}</Text> : null}
    <Button variant="secondary" title={t("accountV5.appleReauth")} loading={busy} onPress={() => void verify()} />
    {error ? <Text accessibilityRole="alert" style={[parentStyles.muted, { color: "#A43135" }]}>{t("experience.social.failed")}</Text> : null}
  </View>;
}

/** Available before family setup as well as in the parent menu. No client-side admin key. */
export function AccountDeletion() {
  const { t } = useTranslation();
  const { session, claims } = useSession();
  // Keep the chosen method stable if OTP adds an email identity to a social account.
  const [socialOnly] = useState(() => !!session?.user.identities?.length && !session.user.identities.some(i => i.provider === 'email'));
  // Apple-linked accounts always re-authenticate with Apple: it proves the person and yields a revocable token.
  const [appleLinked] = useState(() => hasAppleIdentity(session));
  // The impact preview needs a parent of a family; before family setup there is nothing to preview.
  const withPreview = claims?.role === "parent" && !!claims.family_id;
  // Web/Android: a fresh Apple OAuth session (also after the web redirect) already counts as re-authentication.
  const [freshOAuth] = useState(() => hasAppleIdentity(session) && freshAppleOAuth(session));
  const [verifiedAt, setVerifiedAt] = useState(() => (freshOAuth ? Date.now() : 0));
  const [appleProof, setAppleProof] = useState<AppleReauth | null>(() => (freshOAuth ? { reauthentication: "apple_oauth" } : null));
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [revocation, setRevocation] = useState<Revocation | null>(null);
  const revocationRef = useRef<Revocation | null>(null);
  const keepRevocation = (value: Revocation | null) => { revocationRef.current = value; setRevocation(value); };
  // Same attempt → same request id, so a retry after a lost response never starts a second revocation.
  const requestId = useRef(randomUUID());
  const reauth = (): Reauth => (appleLinked ? appleProof! : socialOnly ? { reauthentication: "email_otp" } : { password });
  const reauthReady = appleLinked ? !!appleProof && verifiedAt > 0 : socialOnly ? verifiedAt > 0 : !!password;
  const assertReady = () => {
    if (!confirmed || !reauthReady || ((appleLinked || socialOnly) && Date.now() - verifiedAt > 240000)) throw new Error("confirmation_required");
  };
  const finish = async () => {
    setDeleted(true); setPassword(""); setAppleProof(null);
    // The server has already deleted Auth and its refresh tokens. Local cleanup must not mask success.
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) throw signOutError;
    // Stay on the confirmation when the Apple revocation is still pending or needs the user's action.
    if (revocationRef.current === "pending" || revocationRef.current === "manual_required") return;
    router.replace("/(auth)/sign-in");
  };
  const handleError = (error: unknown) => {
    // A rejected Apple proof is single-use: ask for a new one.
    if (error instanceof Error && error.message.startsWith("apple_")) { setAppleProof(null); setVerifiedAt(0); }
  };
  const remove = useMutation({
    mutationFn: async () => {
      assertReady();
      keepRevocation(await invokeDelete(reauth(), requestId.current));
      await finish();
    },
    onError: handleError,
  });
  const reset = useCallback(() => {
    setOpen(false); setPassword(""); setVerifiedAt(0); setAppleProof(null); setConfirmed(false); remove.reset(); requestId.current = randomUUID();
  }, [remove]);
  const perform = async (preview: DeletionPreview, previewRequestId: string) => {
    assertReady();
    try { keepRevocation(await invokeDelete(reauth(), previewRequestId, preview.preview_token)); } catch (e) { handleError(e); throw e; }
  };
  // Own codes of delete-account: wrong password/OTP, an expired verification, or the Apple step.
  const errorText = (code: string) => (code === "apple_reauthentication_required" ? t("accountV5.appleReauthRequired")
    : code === "apple_unavailable" ? t("accountV5.appleUnavailable")
    : code === "reauthentication_failed" || code === "confirmation_required" || code === "invalid_input" ? t("accountV5.deleteFailed") : null);
  const revocationText = revocation === "pending" ? t("accountV5.appleRevocationPending") : revocation === "manual_required" ? t("accountV5.appleRevocationManual") : null;

  if (deleted) return <View style={parentStyles.card}><Text style={parentStyles.copy}>{t("accountV5.deleteDone")}</Text>
    {revocationText ? <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{revocationText}</Text> : null}
    <Button title={t("auth.signIn")} onPress={async () => { await supabase.auth.signOut({ scope: "local" }); router.replace("/(auth)/sign-in"); }} /></View>;

  const reauthFields = <>
    {appleLinked ? <AppleVerification verified={!!appleProof} onVerified={proof => { setAppleProof(proof); setVerifiedAt(Date.now()); }} />
      : socialOnly ? <EmailVerification onVerified={() => setVerifiedAt(Date.now())} onExpired={() => setVerifiedAt(0)} /> : <>
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
  const removeError = remove.error ? errorText(remove.error instanceof Error ? remove.error.message : "") ?? t("accountV5.deleteFailed") : null;
  return <View style={parentStyles.card}>
    <Text style={parentStyles.title}>{t("accountV5.deleteTitle")}</Text>
    <Text style={parentStyles.copy}>{t("accountV5.deleteBody")}</Text>
    <Text style={parentStyles.copy}>{t("accountV5.deleteStore")}</Text>
    {reauthFields}
    {removeError ? <Text accessibilityRole="alert" style={[parentStyles.copy, { color: "#A43135" }]}>{removeError}</Text> : null}
    <Button variant="danger" title={t("accountV5.deleteNow")} loading={remove.isPending} disabled={!confirmed || !reauthReady} onPress={() => remove.mutate()} />
    <Button variant="ghost" title={t("common.cancel")} disabled={remove.isPending} onPress={reset} />
  </View>;
}
