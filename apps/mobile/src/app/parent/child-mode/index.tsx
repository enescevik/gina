import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useChildMode } from "@/lib/child-mode";
import { supabase } from "@/lib/supabase";

/** Veli telefonunda çocuk moduna giriş: çocuk seçimi + çocuk PIN'i (veli PIN'i tanımlı olmalı). */
export default function ChildModeEntryScreen() {
  const { t } = useTranslation();
  const { enter } = useChildMode();
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const parentPinSet = useQuery({
    queryKey: ["parent_pin_set"],
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc("parent_pin_set");
      if (rpcError) throw rpcError;
      return data;
    },
  });

  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error: queryError } = await supabase.from("children").select("id, name").order("sort_order");
      if (queryError) throw queryError;
      return data;
    },
  });

  async function submit() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const { data: ok, error: rpcError } = await supabase.rpc("verify_child_pin", { p_child_id: selected.id, p_pin: pin });
      if (rpcError) throw rpcError;
      if (!ok) {
        setError(new Error(t("child.wrongPin")));
        setPin("");
        return;
      }
      enter(selected);
      router.replace("/parent/child-mode/today");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (parentPinSet.isSuccess && !parentPinSet.data) {
    return (
      <Screen title={t("parent.childMode")}>
        <Text className="text-base text-ink dark:text-night-text">{t("childMode.setParentPinFirst")}</Text>
        <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen tone="child" title={selected ? t("child.hello", { name: selected.name }) : t("child.pickProfile")}>
      {!selected ? (
        <View className="flex-row flex-wrap gap-4">
          {children.data?.map((child) => (
            <Pressable
              key={child.id}
              accessibilityRole="button"
              className="min-h-32 min-w-40 flex-1 items-center justify-center rounded-child bg-white p-6 active:bg-teal-light dark:bg-night-surface"
              onPress={() => setSelected(child)}
            >
              <View className="mb-3 h-16 w-16 rounded-full bg-teal-light" />
              <Text className="text-xl font-bold text-ink dark:text-night-text">{child.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Text className="text-base text-ink dark:text-night-text">{t("child.enterPin")}</Text>
          <Field label="PIN" keyboardType="number-pad" secureTextEntry maxLength={4} value={pin} onChangeText={setPin} className="text-center text-3xl tracking-widest" />
          <Button size="child" title={t("common.ok")} loading={busy} disabled={pin.length !== 4} onPress={submit} />
          <Button variant="ghost" title={t("common.cancel")} onPress={() => setSelected(null)} />
        </>
      )}
      <ErrorText error={error ?? children.error ?? parentPinSet.error} />
      {!selected ? <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} /> : null}
    </Screen>
  );
}
