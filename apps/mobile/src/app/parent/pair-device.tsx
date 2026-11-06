import { useEffect, useRef, useState, type ReactNode } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Tablet, Users } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { InfoCard, ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { ErrorText } from "@/components/ui/screen";
import { PairingSteps } from "@/components/device/pairing-steps";
import { clearPairingCode, usePendingPairing } from "@/components/device/pending-pairing";
import { formatPairingCode, formatSeconds, isPairingCode, normalizePairingCode } from "@/components/device/pairing-code";
import { supabase } from "@/lib/supabase";

const errorText = (error: unknown) => String((error as { message?: string } | null)?.message ?? "");
const expiredError = (error: unknown) => /invalid_or_expired_code/.test(errorText(error));
const tokenError = (error: unknown) => /invalid_preview_token/.test(errorText(error));
type Preview =
  | { status: "ok"; device_name: string; family_name: string | null; seconds_left: number; preview_token: string; token_seconds_left: number }
  | { status: "invalid_or_expired"; attempts_left?: number }
  | { status: "pairing_locked"; retry_after_seconds: number };
// Generated database types predate the C06 preview RPC / C13-AUTH-1 token signature.
const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/**
 * The single parent-side pairing screen (menu, QR link and post-sign-in hand-off all land here).
 * Code → server preview (device name + receiving family, nothing consumed; wrong codes are counted
 * and lock trying for a while) → explicit confirm with the single-use preview token (5 min) →
 * device access settings. A code kept from a signed-out QR scan is never paired automatically.
 */
export default function PairDeviceScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ code?: string; resume?: string }>();
  const linkRaw = typeof params.code === "string" ? normalizePairingCode(params.code) : "";
  const linkCode = isPairingCode(linkRaw) ? linkRaw : null;
  const resume = params.resume === "1";
  const pending = usePendingPairing();
  // Typed input wins; otherwise the code comes from the QR link or the code kept before sign-in.
  const [typed, setTyped] = useState<string | null>(null);
  const code = typed ?? linkCode ?? (resume ? pending?.code ?? "" : "");
  const source: "qr" | "resume" | "manual" = typed !== null ? "manual" : linkCode ? "qr" : resume ? "resume" : "manual";
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockLeft, setLockLeft] = useState(0);
  const sending = useRef(false);
  const started = useRef(false);

  const inspect = useMutation({
    mutationFn: async (value: string) => {
      const { data, error } = await rpc("preview_device_pairing", { p_code: value });
      if (error) throw error;
      return data as Preview;
    },
    onSuccess: (result) => {
      if (result.status === "ok") {
        // The confirm window is the token's life (≤ 5 min, never past the code's own expiry).
        const seconds = Math.min(result.seconds_left, result.token_seconds_left);
        setDeadline(Date.now() + seconds * 1000); setRemaining(seconds); setLockedUntil(null);
      } else if (result.status === "pairing_locked") {
        setDeadline(null); setLockedUntil(Date.now() + result.retry_after_seconds * 1000); setLockLeft(result.retry_after_seconds);
      } else { setDeadline(null); void clearPairingCode(); }
    },
  });
  const pair = useMutation({
    mutationFn: async ({ value, token }: { value: string; token: string }) => {
      const { data, error } = await rpc("pair_child_device", { p_code: value, p_preview_token: token });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (deviceId) => {
      void clearPairingCode();
      void qc.invalidateQueries({ queryKey: ["devices"] });
      if (deviceId) router.replace({ pathname: "/parent/device-access", params: { deviceId } });
    },
    onError: (error) => { if (expiredError(error) || tokenError(error)) { setDeadline(null); if (expiredError(error)) void clearPairingCode(); } },
    onSettled: () => { sending.current = false; },
  });

  // QR (signed in) or a code kept from before sign-in: show the target right away, never pair.
  useEffect(() => {
    if (started.current) return;
    if (linkCode) { started.current = true; void clearPairingCode(); inspect.mutate(linkCode); return; }
    if (resume && pending) { started.current = true; inspect.mutate(pending.code); }
    if (resume && pending === null) started.current = true;
  }, [linkCode, resume, pending, inspect]);

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  useEffect(() => {
    if (!lockedUntil) return;
    const timer = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setLockLeft(seconds);
      if (!seconds) { setLockedUntil(null); inspect.reset(); }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil, inspect]);

  const preview = inspect.data?.status === "ok" ? inspect.data : null;
  const locked = !!lockedUntil && lockLeft > 0;
  const timedOut = !!preview && !!deadline && remaining === 0;
  const tokenLost = timedOut || tokenError(pair.error);
  const invalid = inspect.data?.status === "invalid_or_expired" || expiredError(pair.error);
  const attemptsLeft = inspect.data?.status === "invalid_or_expired" ? inspect.data.attempts_left : undefined;
  const lostResume = resume && !linkCode && pending === null && !inspect.data && !inspect.isPending && source === "resume";
  const valid = isPairingCode(code);
  const busy = inspect.isPending || pair.isPending;
  const reset = () => { inspect.reset(); pair.reset(); setDeadline(null); };
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/parent/menu?section=devices"));

  return (
    <ParentScreen title={t("u02.parentPair.title")} subtitle={t("auth1.parentPair.body")}>
      <PairingSteps current={3} />
      {source !== "manual" && !invalid && !lostResume && !locked ? (
        <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{t(source === "resume" ? "c06.pair.resumed" : "u02.parentPair.fromQr")}</Text>
      ) : null}
      {lostResume ? <InfoCard title={t("c06.pair.lostTitle")} body={t("c06.pair.lostBody")} /> : null}

      {preview && !tokenLost && !pair.isSuccess && !expiredError(pair.error) ? (
        <View testID="pairing-target" accessibilityLiveRegion="polite" style={[parentStyles.card, { gap: 14, borderColor: "#A89BD4" }]}>
          <Text accessibilityRole="header" style={parentStyles.title}>{t("c06.pair.targetTitle")}</Text>
          <Target icon={<Tablet size={22} color="#6042DE" />} label={t("c06.pair.device")} value={preview.device_name} />
          <Target icon={<Users size={22} color="#6042DE" />} label={t("c06.pair.family")} value={preview.family_name ?? "—"} />
          <Text style={parentStyles.muted}>{t("c06.pair.checkDevice")}</Text>
          <Text testID="pairing-confirm-remaining" style={parentStyles.muted}>{t("auth1.parentPair.confirmRemaining", { time: formatSeconds(remaining) })}</Text>
          <ErrorText error={pair.error} />
          <Button
            title={t("u02.parentPair.confirm")}
            loading={pair.isPending}
            disabled={busy}
            onPress={() => {
              if (sending.current || busy) return;
              sending.current = true;
              pair.mutate({ value: code, token: preview.preview_token });
            }}
          />
          <Button variant="ghost" title={t("c06.pair.notThis")} disabled={pair.isPending} onPress={() => { void clearPairingCode(); reset(); setTyped(""); }} />
          <Text style={parentStyles.muted}>{t("u02.parentPair.next")}</Text>
        </View>
      ) : (
        <>
          <InfoCard title={t("u02.parentPair.cameraTitle")} body={t("u02.parentPair.cameraBody")} />
          <Field
            testID="pairing-code-input"
            label={t("auth1.parentPair.codeLabel")}
            hint={t("auth1.parentPair.codeHint")}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            maxLength={9}
            editable={!busy}
            value={formatPairingCode(code)}
            onChangeText={(v) => { setTyped(normalizePairingCode(v)); inspect.reset(); pair.reset(); setDeadline(null); }}
            style={{ fontFamily: "Nunito_700Bold", fontSize: 22, letterSpacing: 3 }}
          />
          {locked ? (
            <View testID="pairing-locked" accessibilityLiveRegion="assertive">
              <InfoCard title={t("auth1.parentPair.lockedTitle")} body={t("auth1.parentPair.lockedBody", { time: formatSeconds(lockLeft) })} />
            </View>
          ) : tokenLost && !invalid ? (
            <View testID="pairing-token-expired"><InfoCard title={t("auth1.parentPair.tokenExpired")} /></View>
          ) : invalid ? (
            <View testID="pairing-invalid">
              <InfoCard title={t("u02.parentPair.expiredTitle")} body={t("u02.parentPair.expiredBody")} />
              {typeof attemptsLeft === "number" ? <Text accessibilityLiveRegion="polite" style={[parentStyles.muted, { marginTop: 8 }]}>{t("auth1.parentPair.attemptsLeft", { count: attemptsLeft })}</Text> : null}
            </View>
          ) : <ErrorText error={inspect.error} />}
          <Button
            title={t("c06.pair.show")}
            disabled={!valid || busy || locked}
            loading={inspect.isPending}
            onPress={() => { if (valid && !busy && !locked) { reset(); inspect.mutate(code); } }}
          />
          <Text style={parentStyles.muted}>{t("c06.pair.previewFirst")}</Text>
        </>
      )}
      <Button variant="ghost" title={t("common.cancel")} disabled={pair.isPending} onPress={() => { void clearPairingCode(); leave(); }} />
    </ParentScreen>
  );
}

function Target({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "#F2EDFF", alignItems: "center", justifyContent: "center" }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[parentStyles.muted, { fontSize: 14 }]}>{label}</Text>
        <Text style={[parentStyles.copy, { fontFamily: "Nunito_800ExtraBold" }]}>{value}</Text>
      </View>
    </View>
  );
}
