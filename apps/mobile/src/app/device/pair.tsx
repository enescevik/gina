import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { ParentScreen, parentStyles } from "@/components/ui/parent-screen";
import { ErrorText } from "@/components/ui/screen";
import { refreshClaims, useSession } from "@/lib/session";
import { unregisterPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";

export default function PairScreen() {
  const { t } = useTranslation();
  const { session, claims, loading, isAnonymous } = useSession();
  const [pairing, setPairing] = useState<{ code: string; expires: number } | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
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
    if (claims?.role === "device") router.replace("/child");
    else if (session && !isAnonymous) router.replace("/");
  }, [claims?.role, session, isAnonymous]);
  useFocusEffect(useCallback(() => {
    if (!pairing) return;
    let live = true; let polling = false; let lastPoll = 0;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((pairing.expires - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds || AppState.currentState === "background" || polling || Date.now() - lastPoll < 5000) return;
      polling = true; lastPoll = Date.now();
      void refreshClaims().then(next => { if (live && next?.role === "device") router.replace("/child"); })
        .catch(e => { if (live) setError(e); }).finally(() => { polling = false; });
    };
    tick(); const timer = setInterval(tick, 1000);
    const sub = AppState.addEventListener("change", state => { if (state === "active") tick(); });
    return () => { live = false; clearInterval(timer); sub.remove(); };
  }, [pairing]));
  async function requestCode() {
    if (busy || !isAnonymous) return;
    setBusy(true); setError(null);
    try {
      const started = Date.now();
      const { data, error } = await supabase.rpc("request_pairing", { p_device_name: "Tablet" });
      if (error) throw error;
      setPairing({ code: data, expires: started + 10 * 60_000 }); setRemaining(600);
    } catch (e) { setError(e); } finally { setBusy(false); }
  }
  async function exit() {
    if (busy) return; leaving.current = true; setBusy(true); setError(null);
    try { await unregisterPush(); const { error } = await supabase.auth.signOut(); if (error) throw error; router.replace("/(auth)/sign-in"); }
    catch (e) { leaving.current = false; setError(e); } finally { setBusy(false); }
  }
  return <ParentScreen navigation={false} title={t("device.pairTitle")} subtitle={t("device.pairHelp")}>
    {pairing ? <View style={[parentStyles.card, { alignItems: "center", paddingVertical: 32 }]}>
      <Text selectable style={{ fontFamily: "Baloo2_700Bold", fontSize: 44, letterSpacing: 5, color: remaining ? "#0B7F7F" : "#63736B" }}>{pairing.code}</Text>
      <Text style={[parentStyles.copy, { textAlign: "center" }]}>{t(remaining ? "device.waiting" : "accountV5.codeExpired")}</Text>
      {remaining ? <Text style={parentStyles.muted}>{t("accountV5.codeRemaining", { time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` })}</Text> : null}
    </View> : null}
    {!pairing || !remaining ? <Button title={t(pairing ? "accountV5.newCode" : "device.getCode")} disabled={!isAnonymous} loading={busy} onPress={requestCode} /> : null}
    {!session && error ? <Button title={t("common.retry")} onPress={authenticate} loading={busy} /> : null}
    <ErrorText error={error} />
    <Button variant="ghost" title={t("device.thisIsParentPhone")} disabled={busy} onPress={exit} />
  </ParentScreen>;
}
