import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { PinEntry, PinRecovery } from "@/components/ui/pin-entry";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, EmptyCard, parentStyles, InfoCard } from "@/components/ui/parent-screen";
import { useChildMode } from "@/lib/child-mode";
import { supabase } from "@/lib/supabase";

/** Veli telefonunda çocuk moduna giriş: çocuk seçimi + çocuk PIN'i (veli PIN'i tanımlı olmalı). */
export default function ChildModeEntryScreen() {
  const { t } = useTranslation();
  const { enter } = useChildMode();
  const [chosen, setSelected] = useState<{ id: string; name: string; avatar: string } | null>(null);
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
      const { data, error: queryError } = await supabase.from("children").select("id, name, grade, avatar").is("archived_at", null).order("sort_order");
      if (queryError) throw queryError;
      return data;
    },
  });

  const selected = chosen ?? (children.data?.length === 1 ? children.data[0] : null);

  async function submit() {
    if (busy || !selected || !/^\d{4}$/.test(pin)) return;
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
      setPin("");
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  if (parentPinSet.isSuccess && !parentPinSet.data) {
    return (
      <Screen title={t("parent.childMode")}>
        <InfoCard title={t("unified.parentPinFirstTitle")} body={t("unified.parentPinFirstBody")}/><Button title={t("unified.setParentPin")} onPress={() => router.push({pathname:"/parent/menu",params:{section:"security"}})} />
      </Screen>
    );
  }

  return (
    <Screen title={selected ? t("child.hello", { name: selected.name }) : t("parentV5.childModeTitle")} subtitle={t("parentV5.childModeSubtitle")}
      loading={children.isLoading || parentPinSet.isLoading} error={children.error ?? parentPinSet.error} onRetry={() => { void children.refetch(); void parentPinSet.refetch(); }}>
      {children.data?.length === 0 ? <EmptyCard title={t("parentV5.noChildren")}><Button title={t("parent.menu")} onPress={() => router.push("/parent/menu")} /></EmptyCard> : null}
      {!selected ? <InfoCard title={t("unified.samePhone")} body={t("u02.childMode.noPairing")} /> : null}
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
          <View style={{ alignItems: "center", gap: 8 }}>
            <Avatar slug={selected.avatar} size={72} />
            <Text style={[parentStyles.muted, { textAlign: "center" }]}>{t("experience.pin.prompt")}</Text>
          </View>
          <PinEntry label={t("childV5.pinLabel")} value={pin} onChange={setPin} disabled={busy} onSubmit={() => void submit()} />
          <ErrorText error={error} />
          <Button size="child" title={t("unified.enterMyWorld")} loading={busy} disabled={pin.length !== 4} onPress={submit} />
          <PinRecovery audience="child" />
          <Button variant="ghost" title={t("common.cancel")} disabled={busy} onPress={() => { if (children.data?.length === 1) router.back(); else setSelected(null); setPin(""); setError(null); }} />
        </>
      )}
      {!selected ? <ErrorText error={children.error ?? parentPinSet.error} /> : null}
      {!selected ? <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} /> : null}
    </Screen>
  );
}
