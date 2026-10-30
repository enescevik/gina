import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, EmptyCard, parentStyles } from "@/components/ui/parent-screen";
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
      const { data, error: queryError } = await supabase.from("children").select("id, name, avatar").order("sort_order");
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
      await enter(selected);
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
        <Text className="font-body text-base text-ink">{t("childMode.setParentPinFirst")}</Text>
        <Button variant="secondary" title={t("parent.menu")} onPress={() => router.push("/parent/menu")} />
      </Screen>
    );
  }

  return (
    <Screen title={selected ? t("child.hello", { name: selected.name }) : t("parentV5.childModeTitle")} subtitle={t("parentV5.childModeSubtitle")}
      loading={children.isLoading || parentPinSet.isLoading} error={children.error ?? parentPinSet.error} onRetry={() => { void children.refetch(); void parentPinSet.refetch(); }}>
      {children.data?.length === 0 ? <EmptyCard title={t("parentV5.noChildren")}><Button title={t("parent.menu")} onPress={() => router.push("/parent/menu")} /></EmptyCard> : null}
      {!selected ? (
        <View className="flex-row flex-wrap gap-4">
          {children.data?.map((child) => (
            <Pressable
              key={child.id}
              accessibilityRole="button"
              style={[parentStyles.card, { minWidth: 150, minHeight: 180, flex: 1, alignItems: "center", justifyContent: "center" }]}
              onPress={() => setSelected(child)}
            >
              <View className="mb-3">
                <Avatar slug={child.avatar} size={72} />
              </View>
              <Text className="text-xl font-body-bold text-ink">{child.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Text className="font-body text-base text-ink">{t("child.enterPin")}</Text>
          <Field label="PIN" keyboardType="number-pad" secureTextEntry maxLength={4} value={pin} onChangeText={value => setPin(value.replace(/\D/g, ""))} className="text-center text-3xl tracking-widest" />
          <Button size="child" title={t("common.ok")} loading={busy} disabled={pin.length !== 4} onPress={submit} />
          <Button variant="ghost" title={t("common.cancel")} disabled={busy} onPress={() => { setSelected(null); setPin(""); setError(null); }} />
        </>
      )}
      <ErrorText error={error ?? children.error ?? parentPinSet.error} />
      {!selected ? <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} /> : null}
    </Screen>
  );
}
