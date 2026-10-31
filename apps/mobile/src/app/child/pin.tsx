import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ChildScreen as Screen } from "@/components/room/child-screen";
import { refreshClaims } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export default function ChildPinScreen() {
  const { t } = useTranslation();
  const { childId, name } = useLocalSearchParams<{ childId: string; name?: string }>();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit() {
    if (busy || !childId || !/^\d{4}$/.test(pin)) return;
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
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tone="child" title={name ? t("child.hello", { name }) : t("child.enterPin")}>
      <Text className="font-body text-base text-ink">{t("child.enterPin")}</Text>
      <Field
        label={t("childV5.pinLabel")}
        labelStyle={{ color: "#284E4B" }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={4}
        value={pin}
        editable={!busy} onChangeText={value => setPin(value.replace(/\D/g, ""))}
        className="text-center text-3xl tracking-widest"
      />
      <ErrorText error={error} />
      <Button size="child" title={t("common.ok")} loading={busy} disabled={!childId || pin.length !== 4} onPress={submit} />
      <Button variant="ghost" title={t("common.cancel")} disabled={busy} onPress={() => router.back()} />
    </Screen>
  );
}
