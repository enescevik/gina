import { Redirect, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, useWindowDimensions } from "react-native";

import { RoomChildHome } from "@/components/room/child-home";
import { WIDE_LAYOUT_MIN_DP } from "@/components/room/layout";
import { TodayView } from "@/components/today-view";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ChildScreen as Screen } from "@/components/room/child-screen";
import { ErrorText } from "@/components/ui/screen";
import { useChildMode } from "@/lib/child-mode";
import { supabase } from "@/lib/supabase";

/** Veli telefonunda kilitli çocuk görünümü; çıkış veli PIN'i ister. */
export default function ChildModeTodayScreen() {
  const { t } = useTranslation();
  const { actingChild, exit } = useChildMode();
  const [asking, setAsking] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const { width, fontScale } = useWindowDimensions();
  const wide = width >= WIDE_LAYOUT_MIN_DP && fontScale <= 1.2;

  if (!actingChild) return <Redirect href="/parent/child-mode" />;

  if (wide && !asking) {
    return <RoomChildHome childId={actingChild.id} childName={actingChild.name} actingAsParent onParentExit={() => setAsking(true)} />;
  }

  async function confirmExit() {
    if (busy || !/^\d{4}$/.test(pin)) return;
    setBusy(true);
    setError(null);
    try {
      const { data: ok, error: rpcError } = await supabase.rpc("verify_parent_pin", { p_pin: pin });
      if (rpcError) throw rpcError;
      if (!ok) {
        setError(new Error(t("childMode.wrongParentPin")));
        setPin("");
        return;
      }
      await exit();
      router.replace("/parent");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tone="child" title={t("child.hello", { name: actingChild.name })}>
      {!asking ? <>
        <TodayView childId={actingChild.id} actingAsParent />
        <Button variant="secondary" title={t("child.week")} onPress={() => router.push("/parent/child-mode/week")} />
        <Button variant="secondary" title={t("child.calendar")} onPress={() => router.push("/parent/child-mode/calendar")} />
        <Button variant="secondary" title={t("room.myCollection")} onPress={() => router.push("/parent/child-mode/collection")} />
        <Button variant="secondary" title={t("childV5.customize")} onPress={() => router.push("/parent/child-mode/room-preview")} />
      </> : null}
      {asking ? (
        <View className="gap-3 rounded-child bg-white p-4 dark:bg-night-surface">
          <Text className="text-base font-body-bold text-ink dark:text-night-text">{t("childMode.parentPin")}</Text>
          <Field label={t("childMode.parentPin")} keyboardType="number-pad" secureTextEntry maxLength={4} editable={!busy} value={pin} onChangeText={value => setPin(value.replace(/\D/g, ""))} className="text-center text-2xl tracking-widest" />
          <ErrorText error={error} />
          <Button title={t("childMode.exit")} loading={busy} disabled={pin.length !== 4} onPress={confirmExit} />
          <Button variant="ghost" title={t("common.cancel")} disabled={busy} onPress={() => { setAsking(false); setPin(""); setError(null); }} />
        </View>
      ) : (
        <Button variant="ghost" title={t("childMode.exit")} onPress={() => setAsking(true)} />
      )}
    </Screen>
  );
}
