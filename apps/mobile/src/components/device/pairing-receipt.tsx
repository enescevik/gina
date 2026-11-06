import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Users } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { InfoCard, parentStyles } from "@/components/ui/parent-screen";
import { ErrorText } from "@/components/ui/screen";
import { supabase } from "@/lib/supabase";
import { formatSeconds } from "./pairing-code";

type Status = { status: "not_paired" } | { status: "paired"; family_name: string | null; device_name: string; undo_seconds_left: number };
// Generated database types predate the C13-AUTH-1 device RPCs.
const rpc = supabase.rpc.bind(supabase) as unknown as (name: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const undoExpired = (error: unknown) => /pairing_undo_expired/.test(String((error as { message?: string } | null)?.message ?? ""));

/**
 * C13-AUTH-1, tablet side: right after a parent pairs this tablet, show which family received it.
 * "This is not my family" removes the pairing with the tablet's own session (server allows it only
 * within 15 minutes of pairing); the tablet can then ask for a new code. Only the family name is shown.
 */
export function PairingReceipt({ onContinue, onRejected }: { onContinue: () => void; onRejected: () => void }) {
  const { t } = useTranslation();
  const status = useQuery({
    queryKey: ["device_pairing_status"],
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await rpc("device_pairing_status");
      if (error) throw error;
      const result = data as Status;
      return { ...result, until: result.status === "paired" ? Date.now() + result.undo_seconds_left * 1000 : 0 };
    },
  });
  const [now, setNow] = useState(() => Date.now());
  const paired = status.data?.status === "paired" ? status.data : null;
  const until = paired?.until ?? 0;
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (!status.data) return;
    if (status.data.status === "not_paired") { onRejected(); return; }
    // An old pairing (window closed) needs no receipt.
    if (status.data.undo_seconds_left <= 0) onContinue();
  }, [status.data, onContinue, onRejected]);
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  const reject = useMutation({
    mutationFn: async () => {
      const { error } = await rpc("reject_device_pairing");
      if (error) throw error;
    },
    onSuccess: () => onRejected(),
  });

  if (status.error) return <View style={{ gap: 12 }}><ErrorText error={status.error} /><Button title={t("common.retry")} onPress={() => void status.refetch()} /></View>;
  if (!paired) return null;
  const open = left > 0 && !undoExpired(reject.error);
  return (
    <View testID="pairing-receipt" accessibilityLiveRegion="assertive" style={[parentStyles.card, { gap: 14, borderColor: "#A89BD4" }]}>
      <Text accessibilityRole="header" style={parentStyles.title}>{t("auth1.device.pairedTitle")}</Text>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: "#F2EDFF", alignItems: "center", justifyContent: "center" }}><Users size={22} color="#6042DE" /></View>
        <Text testID="pairing-receipt-family" style={[parentStyles.copy, { flex: 1, fontFamily: "Nunito_800ExtraBold" }]}>{t("auth1.device.pairedBody", { family: paired.family_name ?? "—" })}</Text>
      </View>
      {open ? <Text style={parentStyles.muted}>{t("auth1.device.pairedCheck", { time: formatSeconds(left) })}</Text> : <InfoCard title={t("auth1.device.undoExpired")} />}
      <ErrorText error={undoExpired(reject.error) ? null : reject.error} />
      <Button title={t("auth1.device.continue")} disabled={reject.isPending} onPress={onContinue} />
      {open ? <Button variant="danger" testID="pairing-not-my-family" title={t("auth1.device.notMyFamily")} loading={reject.isPending} disabled={reject.isPending} onPress={() => reject.mutate()} /> : null}
    </View>
  );
}
