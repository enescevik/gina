import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Avatar, CHILD_AVATAR_SLUGS } from "@/components/avatar";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, parentStyles } from "@/components/ui/parent-screen";
import { useSession } from "@/lib/session";
import { unregisterPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";

/** Çocuk satırı: ad, sınıf ve 4 haneli PIN belirleme (set_child_pin RPC). */
function ChildRow({ id, name, grade, avatar }: { id: string; name: string; grade: number | null; avatar: string | null }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const setChildPin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_child_pin", { p_child_id: id, p_pin: pin });
      if (error) throw error;
    },
    onSuccess: () => setPin(""),
  });
  return <View style={parentStyles.card}>
    <View style={parentStyles.row}><Avatar slug={avatar} size={56} /><View className="flex-1 gap-1"><Text style={[parentStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{name}</Text>{grade !== null ? <Text style={parentStyles.muted}>{t("parent.gradeShort", { grade })}</Text> : null}</View></View>
    <Field label={t("parentV5.childPinLabel", { name })} keyboardType="number-pad" secureTextEntry maxLength={4} value={pin} onChangeText={value => setPin(value.replace(/\D/g, ""))} />
    <Button variant="secondary" title={t("parent.savePin")} loading={setChildPin.isPending} disabled={pin.length !== 4} onPress={() => setChildPin.mutate()} />
    <ErrorText error={setChildPin.error} />
  </View>;
}

/** Veli PIN'i: telefonda çocuk modundan çıkış için (set_parent_pin RPC). */
function ParentPinRow() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const savePin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_parent_pin", { p_pin: pin });
      if (error) throw error;
    },
    onSuccess: () => { setPin(""); void queryClient.invalidateQueries({ queryKey: ["parent_pin_set"] }); },
  });
  return <View style={parentStyles.card}>
    <Text style={parentStyles.title}>{t("parent.parentPin")}</Text>
    <Field label={t("parentV5.newParentPin")} keyboardType="number-pad" secureTextEntry maxLength={4} value={pin} onChangeText={value => setPin(value.replace(/\D/g, ""))} />
    <Button variant="secondary" title={t("parent.savePin")} loading={savePin.isPending} disabled={pin.length !== 4} onPress={() => savePin.mutate()} />
    <ErrorText error={savePin.error} />
  </View>;
}

/** Menü: aile kurulumu ve yönetim — davet kodu, çocuklar, cihaz eşleştirme, PIN'ler, paketler, çıkış. */
export default function ParentMenuScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();
  const [childName, setChildName] = useState("");
  const [childAvatar, setChildAvatar] = useState<string>(CHILD_AVATAR_SLUGS[0] ?? "avatar-default");
  const [pairCode, setPairCode] = useState("");

  const family = useQuery({
    queryKey: ["family", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("name, invite_code").eq("id", familyId).single();
      if (error) throw error;
      return data;
    },
  });

  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("id, name, grade, avatar").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("id, name, paired_at").is("revoked_at", null);
      if (error) throw error;
      return data;
    },
  });

  const addChild = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("children").insert({ family_id: familyId, name, avatar: childAvatar });
      if (error) throw error;
    },
    onSuccess: () => {
      setChildName("");
      void queryClient.invalidateQueries({ queryKey: ["children"] });
    },
  });

  const pairDevice = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.rpc("pair_device", { p_code: code });
      if (error) throw error;
    },
    onSuccess: () => {
      setPairCode("");
      void queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });

  const revokeDevice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revoke_device", { p_device_id: id });
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });

  return (
    <Screen title={family.data?.name ?? t("parent.menu")} subtitle={t("parentV5.menuSubtitle")} loading={family.isLoading || children.isLoading || devices.isLoading} error={family.error ?? children.error ?? devices.error} onRetry={() => { void family.refetch(); void children.refetch(); void devices.refetch(); }}>
      <View className="rounded-parent bg-teal-light p-4">
        <Text className="font-body text-sm text-ink">{t("parent.inviteCode")}</Text>
        <Text className="text-2xl font-body-bold tracking-widest text-teal-dark">{family.data?.invite_code ?? "…"}</Text>
        <Text className="font-body mt-1 text-xs text-gray-700">{t("parent.inviteHelp")}</Text>
      </View>

      <View style={parentStyles.card}>
        <Text className="text-lg font-body-bold text-ink">{t("parent.children")}</Text>
        {children.data?.map((child) => (
          <ChildRow key={child.id} id={child.id} name={child.name} grade={child.grade} avatar={child.avatar} />
        ))}
        <Field label={t("parent.addChild")} value={childName} onChangeText={setChildName} placeholder={t("parent.childNamePlaceholder")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {CHILD_AVATAR_SLUGS.map((slug) => (
              <Pressable
                key={slug}
                accessibilityRole="button" accessibilityLabel={t("parentV5.avatarLabel", { number: CHILD_AVATAR_SLUGS.indexOf(slug) + 1 })} accessibilityState={{ selected: childAvatar === slug }} aria-pressed={childAvatar === slug}
                onPress={() => setChildAvatar(slug)}
                className={`min-h-12 items-center justify-center rounded-full border-2 p-0.5 ${childAvatar === slug ? "border-teal" : "border-transparent"}`}
              >
                <Avatar slug={slug} size={44} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <Button variant="secondary" title={t("common.add")} loading={addChild.isPending} disabled={!childName.trim()} onPress={() => addChild.mutate(childName.trim())} />
      </View>

      <View style={parentStyles.card}>
        <Text className="text-lg font-body-bold text-ink">{t("parent.pairDevice")}</Text>
        {devices.data?.map((device) => (
          <View key={device.id} className="flex-row items-center gap-2">
            <Text className="font-body flex-1 text-base text-ink">• {device.name}</Text>
            <ConfirmAction title={t("parent.removeDevice")} busy={revokeDevice.isPending} onConfirm={() => revokeDevice.mutate(device.id)} />
          </View>
        ))}
        <Field label={t("parent.pairCodeLabel")} keyboardType="number-pad" maxLength={6} value={pairCode} onChangeText={setPairCode} />
        <Button variant="secondary" title={t("parent.pairDevice")} loading={pairDevice.isPending} disabled={pairCode.length !== 6} onPress={() => pairDevice.mutate(pairCode)} />
      </View>

      <ParentPinRow />
      <Button variant="secondary" title={t("prova.title")} onPress={() => router.push("/parent/prova")} />
      <Button variant="secondary" title={t("push.menu")} onPress={() => router.push("/parent/notifications")} />
      <Button variant="secondary" title={t("share.title")} onPress={() => router.push("/parent/share")} />
      <Button variant="secondary" title={t("parent.rewards")} onPress={() => router.push("/parent/rewards")} />
      <Button variant="secondary" title={t("parent.subscription")} onPress={() => router.push("/parent/subscription")} />
      <ErrorText error={family.error ?? children.error ?? devices.error ?? addChild.error ?? pairDevice.error ?? revokeDevice.error} />
      <Button variant="ghost" title={t("auth.signOut")} onPress={() => void unregisterPush().then(() => supabase.auth.signOut()).then(() => router.replace("/"))} />
      <Button variant="ghost" title={t("parent.home")} onPress={() => router.back()} />
    </Screen>
  );
}
