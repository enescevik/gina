import { Redirect, router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, useWindowDimensions } from "react-native";

import { RoomChildHome } from "@/components/room/child-home";
import { WIDE_LAYOUT_MIN_DP } from "@/components/room/layout";
import { TodayView } from "@/components/today-view";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
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
      exit();
      router.replace("/parent");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen tone="child" title={t("child.hello", { name: actingChild.name })}>
      <TodayView childId={actingChild.id} actingAsParent />
      {asking ? (
        <View className="gap-3 rounded-child bg-white p-4 dark:bg-night-surface">
          <Text className="text-base font-semibold text-ink dark:text-night-text">{t("childMode.parentPin")}</Text>
          <Field label="PIN" keyboardType="number-pad" secureTextEntry maxLength={4} value={pin} onChangeText={setPin} className="text-center text-2xl tracking-widest" />
          <ErrorText error={error} />
          <Button title={t("childMode.exit")} loading={busy} disabled={pin.length !== 4} onPress={confirmExit} />
          <Button variant="ghost" title={t("common.cancel")} onPress={() => setAsking(false)} />
        </View>
      ) : (
        <Button variant="ghost" title={t("childMode.exit")} onPress={() => setAsking(true)} />
      )}
    </Screen>
  );
}
