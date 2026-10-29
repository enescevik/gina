import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, TextInput, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText, Screen } from "@/components/ui/screen";
import { useRealtimeInvalidate } from "@/lib/realtime";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/** Çocuk satırı: ad, sınıf ve 4 haneli PIN belirleme (set_child_pin RPC). */
function ChildRow({ id, name, grade }: { id: string; name: string; grade: number | null }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const setChildPin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_child_pin", { p_child_id: id, p_pin: pin });
      if (error) throw error;
    },
    onSuccess: () => setPin(""),
  });
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-base text-ink dark:text-night-text">
          • {name}
          {grade ? ` (${t("parent.gradeShort", { grade })})` : ""}
        </Text>
        <TextInput
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          value={pin}
          onChangeText={setPin}
          placeholder="PIN"
          placeholderTextColor="#9CA3AF"
          className="w-20 rounded-parent border border-mist bg-white px-2 py-1 text-center text-ink dark:bg-night-surface dark:text-night-text"
        />
        <Button variant="ghost" title="PIN" loading={setChildPin.isPending} disabled={pin.length !== 4} onPress={() => setChildPin.mutate()} />
      </View>
      <ErrorText error={setChildPin.error} />
    </View>
  );
}

/** Veli PIN'i: telefonda çocuk modundan çıkış ve cihaz ayarları için (set_parent_pin RPC). */
function ParentPinRow() {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const savePin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_parent_pin", { p_pin: pin });
      if (error) throw error;
    },
    onSuccess: () => setPin(""),
  });
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-sm text-ink dark:text-night-text">{t("parent.parentPin")}</Text>
        <TextInput
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          value={pin}
          onChangeText={setPin}
          placeholder="PIN"
          placeholderTextColor="#9CA3AF"
          className="w-20 rounded-parent border border-mist bg-white px-2 py-1 text-center text-ink dark:bg-night-surface dark:text-night-text"
        />
        <Button variant="ghost" title={t("parent.savePin")} loading={savePin.isPending} disabled={pin.length !== 4} onPress={() => savePin.mutate()} />
      </View>
      <ErrorText error={savePin.error} />
    </View>
  );
}

/** Veli ana sayfası (iskelet): aile ve davet kodu, çocuklar, cihaz eşleştirme, onay kuyruğu. */
export default function ParentHomeScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();
  const [childName, setChildName] = useState("");
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
      const { data, error } = await supabase.from("children").select("id, name, grade").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("id, name, paired_at, revoked_at").is("revoked_at", null);
      if (error) throw error;
      return data;
    },
  });

  const approvals = useQuery({
    queryKey: ["approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_completions")
        .select("id, due_date, task_templates(title, stars), children(name)")
        .eq("status", "done")
        .order("completed_at");
      if (error) throw error;
      return data;
    },
  });

  // Çocuk tablette tik atınca onay kuyruğu anında güncellenir.
  useRealtimeInvalidate("task_completions", familyId ? `family_id=eq.${familyId}` : null, [["approvals"]]);

  const addChild = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("children").insert({ family_id: familyId, name });
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

  const review = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("review_task", { p_completion_id: id, p_approve: approve });
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["approvals"] }),
  });

  return (
    <Screen title={family.data?.name ?? t("parent.home")}>
      <View className="rounded-parent bg-teal-light p-4">
        <Text className="text-sm text-ink">{t("parent.inviteCode")}</Text>
        <Text className="text-2xl font-bold tracking-widest text-teal-dark">{family.data?.invite_code ?? "…"}</Text>
      </View>

      <View className="gap-2 rounded-parent border border-mist p-4">
        <Text className="text-lg font-semibold text-ink dark:text-night-text">{t("parent.approvals")}</Text>
        {approvals.data?.length === 0 ? <Text className="text-gray-500">{t("parent.noApprovals")}</Text> : null}
        {approvals.data?.map((item) => (
          <View key={item.id} className="flex-row items-center gap-2 rounded-parent bg-star/20 p-3">
            <View className="flex-1">
              <Text className="font-semibold text-ink">{item.task_templates?.title}</Text>
              <Text className="text-sm text-gray-600">
                {item.children?.name} · {item.due_date} · {item.task_templates?.stars} ⭐
              </Text>
            </View>
            <Button title={t("parent.approve")} onPress={() => review.mutate({ id: item.id, approve: true })} />
            <Button variant="danger" title={t("parent.return")} onPress={() => review.mutate({ id: item.id, approve: false })} />
          </View>
        ))}
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button variant="secondary" title={t("parent.tasks")} onPress={() => router.push("/parent/tasks")} />
        </View>
        <View className="flex-1">
          <Button variant="secondary" title={t("parent.calendar")} onPress={() => router.push("/parent/calendar")} />
        </View>
      </View>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button variant="secondary" title={t("parent.notes")} onPress={() => router.push("/parent/notes")} />
        </View>
        <View className="flex-1">
          <Button variant="secondary" title={t("parent.grades")} onPress={() => router.push("/parent/grades")} />
        </View>
      </View>
      <Button title={t("parent.childMode")} onPress={() => router.push("/parent/child-mode")} />
      <ParentPinRow />

      <View className="gap-2 rounded-parent border border-mist p-4">
        <Text className="text-lg font-semibold text-ink dark:text-night-text">{t("parent.children")}</Text>
        {children.data?.map((child) => (
          <ChildRow key={child.id} id={child.id} name={child.name} grade={child.grade} />
        ))}
        <Field label={t("parent.addChild")} value={childName} onChangeText={setChildName} placeholder={t("parent.childNamePlaceholder")} />
        <Button variant="secondary" title={t("common.add")} loading={addChild.isPending} disabled={!childName.trim()} onPress={() => addChild.mutate(childName.trim())} />
      </View>

      <View className="gap-2 rounded-parent border border-mist p-4">
        <Text className="text-lg font-semibold text-ink dark:text-night-text">{t("parent.pairDevice")}</Text>
        {devices.data?.map((device) => (
          <Text key={device.id} className="text-base text-ink dark:text-night-text">
            • {device.name}
          </Text>
        ))}
        <Field label={t("parent.pairCodeLabel")} keyboardType="number-pad" maxLength={6} value={pairCode} onChangeText={setPairCode} />
        <Button variant="secondary" title={t("parent.pairDevice")} loading={pairDevice.isPending} disabled={pairCode.length !== 6} onPress={() => pairDevice.mutate(pairCode)} />
      </View>

      <ErrorText error={family.error ?? children.error ?? devices.error ?? approvals.error ?? addChild.error ?? pairDevice.error ?? review.error} />
      <Button variant="ghost" title={t("auth.signOut")} onPress={() => void supabase.auth.signOut().then(() => router.replace("/"))} />
    </Screen>
  );
}
