import {ConnectionMoment} from "@/components/ui/quiet-motion";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { PairingQr } from "@/components/device/pairing-qr";
import { PairingSteps } from "@/components/device/pairing-steps";
import { PairingReceipt } from "@/components/device/pairing-receipt";
import { formatPairingCode, spellPairingCode } from "@/components/device/pairing-code";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { InfoCard, ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { ErrorText } from "@/components/ui/screen";
import { refreshClaims, useSession } from "@/lib/session";
import { unregisterPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";

/** The QR carries only the short-lived 8-character code inside an app link; no names or family data. */
const pairingLink = (code: string) => Linking.createURL("/parent/pair-device", { queryParams: { code } });

export default function PairScreen() {
  const { t } = useTranslation();
  const { session, claims, loading, isAnonymous } = useSession();
  const { revoked } = useLocalSearchParams<{ revoked?: string }>();
  const [deviceName,setDeviceName] = useState(t("unified.defaultDeviceName"));
  const [pairing, setPairing] = useState<{ code: string; expires: number } | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // C13-AUTH-1: once a parent pairs this tablet, show the receiving family before entering child mode.
  const paired = claims?.role === "device";
  const [rejected, setRejected] = useState(false);
  const signingIn = useRef(false);
  const leaving = useRef(false);
  const authenticate = useCallback(async () => {
    if (signingIn.current) return;
    signingIn.current = true; setBusy(true); setError(null);
    try { const { error } = await supabase.auth.signInAnonymously(); if (error) throw error; }
    catch (e) { setError(e); } finally { signingIn.current = false; setBusy(false); }
  }, []);
  useEffect(() => { if (!loading && !session && !leaving.current) void authenticate(); }, [loading, session, authenticate]);
  useEffect(() => {
    if (claims?.role === "device") return;
    else if (session && !isAnonymous) router.replace("/");
  }, [claims?.role, session, isAnonymous]);
  useFocusEffect(useCallback(() => {
    if (!pairing || paired) return;
    let live = true; let polling = false; let lastPoll = 0;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((pairing.expires - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds || AppState.currentState === "background" || polling || Date.now() - lastPoll < 5000) return;
      polling = true; lastPoll = Date.now();
      void refreshClaims().then(next => { if (live && next?.role === "device") setPairing(null); })
        .catch(e => { if (live) setError(e); }).finally(() => { polling = false; });
    };
    tick(); const timer = setInterval(tick, 1000);
    const sub = AppState.addEventListener("change", state => { if (state === "active") tick(); });
    return () => { live = false; clearInterval(timer); sub.remove(); };
  }, [pairing, paired]));
  const enterChildMode = useCallback(() => router.replace("/child"), []);
  const afterReject = useCallback(() => {
    // The server revoked this tablet; a fresh token drops the device role so a new code can be asked for.
    void refreshClaims().catch(e => setError(e)).finally(() => { setPairing(null); setRejected(true); });
  }, []);
  async function requestCode() {
    if (busy || !isAnonymous) return;
    setBusy(true); setError(null); setRejected(false);
    try {
      const started = Date.now();
      const { data, error } = await supabase.rpc("request_pairing", { p_device_name: deviceName.trim() || t("unified.defaultDeviceName") });
      if (error) throw error;
      setPairing({ code: data, expires: started + 10 * 60_000 }); setRemaining(600);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function exit() {
    if (busy) return; leaving.current = true; setBusy(true); setError(null);
    try { await unregisterPush(); const { error } = await supabase.auth.signOut(); if (error) throw error; router.replace("/(auth)/sign-in"); }
    catch (e) { leaving.current = false; setError(e); } finally { setBusy(false); }
  }
  if (paired) {
    return <ParentScreen navigation={false} title={t("unified.pairTitle")}>
      <PairingReceipt onContinue={enterChildMode} onRejected={afterReject} />
      <ErrorText error={error} />
    </ParentScreen>;
  }
  return <ParentScreen navigation={false} title={t("unified.pairTitle")} subtitle={t("unified.pairBody")}>
    {rejected && !pairing ? <View testID="pairing-rejected"><InfoCard title={t("auth1.device.rejectedTitle")} body={t("auth1.device.rejectedBody")} /></View> : null}
    {revoked === "1" && !pairing && !rejected ? <InfoCard title={t("u02.revoked.title")} body={t("u02.revoked.body")} /> : null}
    <ConnectionMoment status={pairing && remaining ? "waiting" : "idle"}/>
    {!pairing ? <Field label={t("unified.deviceName")} hint={t("unified.deviceNameHint")} value={deviceName} onChangeText={setDeviceName} maxLength={60} editable={!busy}/> : null}
    {pairing && remaining ? <View testID="pairing-active" style={[parentStyles.card, { alignItems: "center", paddingVertical: 28 }]}>
      <Text style={[parentStyles.copy, { textAlign: "center", fontFamily: "Nunito_800ExtraBold" }]}>{t("u02.pair.scanTitle")}</Text>
      <PairingQr value={pairingLink(pairing.code)} label={t("u02.pair.qrLabel")} />
      <Text style={[parentStyles.muted, { textAlign: "center" }]}>{t("u02.pair.orType")}</Text>
      <Text testID="pairing-code" selectable accessibilityLabel={t("u02.pair.codeLabel", { code: spellPairingCode(pairing.code) })} style={{ fontFamily: "Nunito_700Bold", fontSize: 40, letterSpacing: 4, color: "#6042DE", textAlign: "center" }}>{formatPairingCode(pairing.code)}</Text>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 600, now: remaining }} style={{ width: "100%", maxWidth: 320, height: 8, borderRadius: 4, backgroundColor: "#EEE8FA", overflow: "hidden" }}>
        <View style={{ width: `${Math.round((remaining / 600) * 100)}%`, height: 8, backgroundColor: remaining > 60 ? "#6042DE" : "#C9534F" }} />
      </View>
      <Text style={parentStyles.muted}>{t("accountV5.codeRemaining", { time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` })}</Text>
      <Text style={[parentStyles.muted, { textAlign: "center" }]}>{t("auth1.pair.qrPrivacy")}</Text>
    </View> : null}
    {pairing && !remaining ? <View testID="pairing-expired" accessibilityLiveRegion="polite" style={[parentStyles.card, { alignItems: "center", gap: 12 }]}>
      <Text style={[parentStyles.title, { textAlign: "center", fontSize: 21 }]}>{t("u02.pair.expiredTitle")}</Text>
      <Text style={[parentStyles.copy, { textAlign: "center" }]}>{t("u02.pair.expiredBody")}</Text>
    </View> : null}
    {!pairing || !remaining ? <Button title={t(pairing ? "accountV5.newCode" : "unified.pairCodeAction")} disabled={!isAnonymous} loading={busy} onPress={requestCode} /> : null}
    {!session && error ? <Button title={t("common.retry")} onPress={authenticate} loading={busy} /> : null}
    <ErrorText error={error} />
    <PairingSteps current={pairing && remaining ? 3 : 1} />
    <Button variant="ghost" title={t("device.thisIsParentPhone")} disabled={busy} onPress={exit} />
  </ParentScreen>;
}
