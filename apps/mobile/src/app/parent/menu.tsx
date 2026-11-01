import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import { Users, Tablet, ShieldCheck, UserRound, Bell, Share2, Crown, NotebookPen, GraduationCap } from "lucide-react-native";
import { Avatar, CHILD_AVATAR_SLUGS } from "@/components/avatar";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { AccountDeletion } from "@/components/account-deletion";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, parentStyles, FormSection, InfoCard, NavigationCard } from "@/components/ui/parent-screen";
import { useSession } from "@/lib/session";
import { unregisterPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";

/** Çocuk satırı: ad, sınıf ve 4 haneli PIN belirleme (set_child_pin RPC). */
function ChildRow({ id, name, grade, avatar }: { id: string; name: string; grade: number | null; avatar: string | null }) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [pin, setPin] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setChildPin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_child_pin", { p_child_id: id, p_pin: pin });
      if (error) throw error;
    },
    onSuccess: () => setPin(""),
  });
  const remove = useMutation({ mutationFn: async () => {
    const { data, error } = await supabase.from("children").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) throw new Error(t("release.genericError"));
  }, onSuccess: () => cache.invalidateQueries() });
  return <View style={parentStyles.card}>
    <View style={parentStyles.row}><Avatar slug={avatar} size={56} /><View className="flex-1 gap-1"><Text style={[parentStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{name}</Text>{grade !== null ? <Text style={parentStyles.muted}>{t("parent.gradeShort", { grade })}</Text> : null}</View></View>
    <Button variant="secondary" title={t("mintRelease.childSettings")} accessibilityState={{expanded:settingsOpen}} onPress={() => setSettingsOpen(!settingsOpen)} />
    {settingsOpen ? <View style={{gap:12}}><Text style={parentStyles.muted}>{t("unified.childPinHelp")}</Text><Field label={t("parentV5.childPinLabel", { name })} keyboardType="number-pad" secureTextEntry maxLength={4} value={pin} onChangeText={value => setPin(value.replace(/\D/g, ""))} />
    <Button variant="secondary" title={t("parent.savePin")} loading={setChildPin.isPending} disabled={pin.length !== 4 || remove.isPending} onPress={() => setChildPin.mutate()} />
    {setChildPin.isSuccess ? <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{t("unified.pinSaved")}</Text> : null}
    <ErrorText error={setChildPin.error ?? remove.error} />
    <ConfirmAction title={t("releaseReview.deleteChild", { name })} message={t("releaseReview.deleteChildBody", { name })} busy={remove.isPending || setChildPin.isPending} onConfirm={() => remove.mutate()} /></View> : null}
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
    <Text style={parentStyles.copy}>{t("unified.parentPinHelp")}</Text>
    <Field label={t("parentV5.newParentPin")} keyboardType="number-pad" secureTextEntry maxLength={4} value={pin} onChangeText={value => setPin(value.replace(/\D/g, ""))} />
    <Button variant="secondary" title={t("parent.savePin")} loading={savePin.isPending} disabled={pin.length !== 4} onPress={() => savePin.mutate()} />
    {savePin.isSuccess ? <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{t("unified.pinSaved")}</Text> : null}
    <ErrorText error={savePin.error} />
  </View>;
}

/** Menü: aile kurulumu ve yönetim — davet kodu, çocuklar, cihaz eşleştirme, PIN'ler, paketler, çıkış. */
export default function ParentMenuScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{section?:string}>();
  const [section,setSection] = useState(["family","devices","security","account"].includes(params.section ?? "") ? params.section! : "family");
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

  const signOut = useMutation({ mutationFn: async () => {
    await unregisterPush(); const { error } = await supabase.auth.signOut(); if (error) throw error; router.replace("/");
  } });

  const revokeDevice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("revoke_device", { p_device_id: id });
      if (error) throw error;
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });

  return (
    <Screen title={t("unified.settingsTitle")} subtitle={family.data?.name ? `${family.data.name} · ${t("unified.settingsBody")}` : t("unified.settingsBody")} loading={family.isLoading || children.isLoading || devices.isLoading} error={family.error ?? children.error ?? devices.error} onRetry={() => { void family.refetch(); void children.refetch(); void devices.refetch(); }}>
      <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{([
        ["family","familyTab",Users],["devices","devicesTab",Tablet],["security","securityTab",ShieldCheck],["account","accountTab",UserRound],
      ] as const).map(([key,label,Icon])=><Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:section===key}} onPress={()=>setSection(key)} style={{flexBasis:"46%",flexGrow:1,minHeight:60,padding:12,borderRadius:19,borderWidth:1,borderColor:section===key?"#78C7AE":"#E5DEED",backgroundColor:section===key?"#DDF5EB":"#FFF",flexDirection:"row",alignItems:"center",gap:10}}><Icon size={22} color="#6042DE"/><Text style={[parentStyles.copy,{fontFamily:"Nunito_800ExtraBold",flex:1}]}>{t(`unified.${label}`)}</Text></Pressable>)}</View>
      {section === "family" ? <>
      <InfoCard title={t("unified.inviteTitle")} body={t("unified.inviteHelp")}>
        <Text selectable accessibilityLabel={t("parent.inviteCode")} style={{fontFamily:"Nunito_800ExtraBold",fontSize:26,letterSpacing:3,color:"#201951"}}>{family.data?.invite_code ?? "…"}</Text>
      </InfoCard>
      <FormSection title={t("parent.addChild")} initiallyOpen={!children.data?.length}>
        <Text style={parentStyles.muted}>{t("release.firstChildBody")}</Text>
        <Field label={t("parent.childNamePlaceholder")} maxLength={80} value={childName} onChangeText={setChildName} placeholder={t("parent.childNamePlaceholder")} />
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
        <Button title={t("parent.addChild")} loading={addChild.isPending} disabled={!childName.trim()} onPress={() => addChild.mutate(childName.trim())} />
        {addChild.isSuccess ? <Text accessibilityLiveRegion="polite" style={parentStyles.copy}>{t("unified.childAdded")}</Text> : null}
        <ErrorText error={addChild.error} />
      </FormSection>

      <View style={{gap:12}}>
        <Text style={parentStyles.title}>{t("parent.children")}</Text><Text style={parentStyles.muted}>{t("unified.childrenHelp")}</Text>
        {children.data?.map((child) => (
          <ChildRow key={child.id} id={child.id} name={child.name} grade={child.grade} avatar={child.avatar} />
        ))}

      </View>

      <NavigationCard title={t("parent.grades")} body={t("unified.gradesHelp")} icon={<GraduationCap size={23} color="#6042DE"/>} onPress={()=>router.push("/parent/grades")}/>
      <NavigationCard title={t("parent.notes")} body={t("unified.notesHelp")} icon={<NotebookPen size={23} color="#6042DE"/>} onPress={()=>router.push("/parent/notes")}/>
      </> : null}
      {section === "devices" ? <>
      <InfoCard title={t("parent.pairDevice")} body={t("unified.pairIntro")} steps={[t("unified.pairStep1"),t("unified.pairStep2"),t("unified.pairStep3")]} />
      <View style={parentStyles.card}>
        <Field label={t("unified.pairCode")} keyboardType="number-pad" maxLength={6} value={pairCode} onChangeText={value=>{setPairCode(value.replace(/\D/g,""));pairDevice.reset();}} />
        <Button title={t("parent.pairDevice")} loading={pairDevice.isPending} disabled={pairCode.length !== 6} onPress={() => pairDevice.mutate(pairCode)} />
        {pairDevice.isSuccess ? <Text accessibilityLiveRegion="polite" style={parentStyles.copy}>{t("unified.pairSaved")}</Text> : null}
        <ErrorText error={pairDevice.error}/>
      </View>
      <View style={parentStyles.card}><Text style={parentStyles.title}>{t("unified.connectedDevices")}</Text>
        {devices.data?.length ? <Text style={parentStyles.muted}>{t("unified.deviceRemoveHelp")}</Text> : <Text style={parentStyles.copy}>{t("unified.noDevices")}</Text>}
        {devices.data?.map(device=><View key={device.id} style={{gap:10,borderTopWidth:1,borderColor:"#EEE8EF",paddingTop:14}}><Text style={parentStyles.copy}>{device.name}</Text><ConfirmAction title={t("parent.removeDevice")} message={t("unified.deviceRemoveHelp")} busy={revokeDevice.isPending} onConfirm={()=>revokeDevice.mutate(device.id)}/></View>)}
        {revokeDevice.isSuccess ? <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{t("unified.deviceRemoved")}</Text> : null}
      </View>
      <InfoCard title={t("unified.samePhone")} body={t("unified.samePhoneBody")}><Button variant="secondary" title={t("unified.childModeAction")} onPress={()=>router.push("/parent/child-mode")}/></InfoCard>
      </> : null}
      {section === "security" ? <><ParentPinRow/><InfoCard title={t("unified.samePhone")} body={t("unified.samePhoneBody")}><Button title={t("unified.childModeAction")} onPress={()=>router.push("/parent/child-mode")}/></InfoCard></> : null}
      {section === "account" ? <>
      <Text style={parentStyles.copy}>{t("unified.accountHelp")}</Text>
      <NavigationCard title={t("push.menu")} body={t("accountV5.notificationsBody")} icon={<Bell size={22} color="#6042DE"/>} onPress={()=>router.push("/parent/notifications")}/>
      <NavigationCard title={t("share.title")} body={t("unified.shareHelp")} icon={<Share2 size={22} color="#6042DE"/>} onPress={()=>router.push("/parent/share")}/>
      <NavigationCard title={t("parent.subscription")} icon={<Crown size={22} color="#6042DE"/>} onPress={()=>router.push("/parent/subscription")}/>
      <AccountDeletion />
      <Button variant="ghost" title={t("auth.signOut")} loading={signOut.isPending} onPress={() => signOut.mutate()} />
      </> : null}
      <ErrorText error={family.error ?? children.error ?? devices.error ?? addChild.error ?? revokeDevice.error ?? signOut.error} />

    </Screen>
  );
}
