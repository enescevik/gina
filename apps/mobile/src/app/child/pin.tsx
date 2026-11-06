import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { InfoCard } from "@/components/ui/parent-screen";

import { Button } from "@/components/ui/button";
import { PinEntry, PinRecovery } from "@/components/ui/pin-entry";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen } from "@/components/room/child-screen";
import { refreshClaims } from "@/lib/session";
import { supabase } from "@/lib/supabase";

const isRevoked = (error: unknown) => {
  const detail = (error ?? {}) as { code?: string; message?: string };
  return detail.code === "42501" || /forbidden/.test(detail.message ?? "");
};

export default function ChildPinScreen() {
  const { t } = useTranslation();
  const { childId, name } = useLocalSearchParams<{ childId: string; name?: string }>();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [revoked, setRevoked] = useState(false);

  async function submit() {
    if (busy || revoked || !childId || !/^\d{4}$/.test(pin)) return;
    setBusy(true);
    setError(null);
    try {
      const { data: ok, error: rpcError } = await supabase.rpc("child_pin_login", { p_child_id: childId, p_pin: pin });
      if (rpcError) throw rpcError;
      if (!ok) {
        setError(new Error(t("child.wrongPin")));
        setPin("");
        return;
      }
      await refreshClaims();
      router.replace("/child/today");
    } catch (e) {
      setPin("");
      // Access removed while this screen was open: say so calmly, then let the layout
      // move the device back to pairing once the refreshed session has no device role.
      if (isRevoked(e)) {
        setRevoked(true);
        void refreshClaims().catch(() => undefined);
      } else setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (revoked) {
    return (
      <Screen tone="child" surface="access" title={t("u02.revoked.title")}>
        <InfoCard title={t("u02.revoked.title")} body={t("u02.revoked.body")} />
        <Button size="child" title={t("u02.revoked.action")} onPress={() => router.replace("/")} />
      </Screen>
    );
  }

  return (
    <Screen tone="child" surface="access" title={name ? t("child.hello", { name }) : t("child.enterPin")}>
      <View style={{ alignItems: "center", gap: 12 }}>
        <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 17, color: "#625C85", textAlign: "center" }}>{t("experience.pin.prompt")}</Text>
      </View>
      <PinEntry label={t("childV5.pinLabel")} value={pin} onChange={setPin} disabled={busy} onSubmit={() => void submit()} />
      <ErrorText error={error} />
      <Button size="child" title={t("unified.enterMyWorld")} loading={busy} disabled={!childId || pin.length !== 4} onPress={submit} />
      <PinRecovery audience="child" />
      <Button variant="ghost" title={t("common.cancel")} disabled={busy} onPress={() => router.back()} />
    </Screen>
  );
}
