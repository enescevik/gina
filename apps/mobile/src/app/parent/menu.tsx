import { IconButton } from "@/components/planner/ui";
import { ChildSetup, type SetupChild } from "@/components/setup/child-setup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View, useWindowDimensions } from "react-native";
import { Pressable } from "@/components/ui/pressable";

import { CircleHelp, Users, Tablet, ShieldCheck, UserRound, Settings2, Pencil, Bell, Share2, Crown, NotebookPen, GraduationCap, TriangleAlert, BookOpen, Inbox } from "lucide-react-native";
import type { DeletionPreview } from "@gina/core";
import { Avatar } from "@/components/avatar";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { AccountDeletion } from "@/components/account-deletion";
import { DeletionPreviewSheet } from "@/components/deletion-preview-sheet";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PinSetup } from "@/components/ui/pin-setup";
import { ErrorText } from "@/components/ui/screen";
import { ParentScreen as Screen, parentStyles, FormSection, InfoCard, NavigationCard } from "@/components/ui/parent-screen";
import { useSession } from "@/lib/session";
import { unregisterPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";

/** Çocuk satırı: ad, sınıf ve 4 haneli PIN belirleme (set_child_pin RPC). */
function ChildRow({ id, name, grade, avatar, onEdit }: { id: string; name: string; grade: number | null; avatar: string | null; onEdit: () => void }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setChildPin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("set_child_pin", { p_child_id: id, p_pin: pin });
      if (error) throw error;
    },
    onSuccess: () => setPin(""),
  });
  return <View style={parentStyles.card}>
    <View style={parentStyles.row}><Pressable accessibilityRole="button" accessibilityLabel={t("betaUx.editChild")} onPress={onEdit} style={[parentStyles.row, {flex:1}]}><Avatar slug={avatar} size={56}/><View style={{flex:1,gap:3}}><Text style={[parentStyles.copy,{fontFamily:"Nunito_700Bold"}]}>{name}</Text>{grade !== null && <Text style={parentStyles.muted}>{t("parent.gradeShort",{grade})}</Text>}</View><Pencil size={18} color="#6042DE"/></Pressable><IconButton label={t("mintRelease.childSettings")} onPress={() => setSettingsOpen(!settingsOpen)}><Settings2 size={23} color="#6042DE"/></IconButton></View>
    <NavigationCard title={t("education.manage")} body={t("education.manageBody")} icon={<GraduationCap size={23} color="#6042DE"/>} onPress={()=>router.push({pathname:"/parent/education",params:{childId:id}})}/>
    {settingsOpen ? <View style={{gap:12}}><Text style={parentStyles.muted}>{t("unified.childPinHelp")}</Text><Field label={t("parentV5.childPinLabel", { name })} keyboardType="number-pad" secureTextEntry maxLength={4} value={pin} onChangeText={value => setPin(value.replace(/\D/g, ""))} />
    <Button variant="secondary" title={t("parent.savePin")} loading={setChildPin.isPending} disabled={pin.length !== 4} onPress={() => setChildPin.mutate()} />
    {setChildPin.isSuccess ? <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{t("unified.pinSaved")}</Text> : null}
    <ErrorText error={setChildPin.error} /></View> : null}
  </View>;
}

/** Kalıcı silme PIN/profil kartından ayrı durur; önce etki önizlemesi ve arşiv seçeneği gösterilir (L03). */
function DangerZone({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return <View style={{ backgroundColor: "#FFF6F4", borderColor: "#EBC9C3", borderWidth: 1, borderRadius: 26, padding: 22, gap: 12 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><TriangleAlert size={22} color="#A43135" /><Text accessibilityRole="header" style={[parentStyles.title, { flex: 1, fontSize: 21 }]}>{t("deletionPreview.dangerTitle")}</Text></View>
    <Text style={parentStyles.muted}>{t("deletionPreview.dangerBody")}</Text>
    {children}
  </View>;
}

// The generated database types predate L03's RPCs.
const rpc = supabase.rpc.bind(supabase) as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Server-side delete bound to the reviewed preview; the same request id replays the receipt. */
async function confirmChildDeletion(preview: DeletionPreview, requestId: string) {
  if (preview.kind !== "child") throw new Error("deletion_target_invalid");
  const { data, error } = await rpc("confirm_child_deletion", { p_request_id: requestId, p_child_id: preview.child.id, p_preview_token: preview.preview_token });
  if (error) throw new Error(error.message);
  if ((data as { deleted?: boolean } | null)?.deleted !== true) throw new Error("deletion_failed");
  return data;
}

/** Veli PIN'i: telefonda çocuk modundan çıkış için; ortak PinEntry + onay alanı (set_parent_pin RPC). */
function ParentPinRow() {
  const { t } = useTranslation();
  return <View testID="parent-pin-setup" style={parentStyles.card}>
    <Text style={parentStyles.title}>{t("parent.parentPin")}</Text>
    <PinSetup />
    <Text style={parentStyles.muted}>{t("u02.pinRecovery.lock")}</Text>
  </View>;
}

/** Menü: aile kurulumu ve yönetim — davet kodu, çocuklar, cihaz eşleştirme, PIN'ler, paketler, çıkış. */
export default function ParentMenuScreen() {
  const { t } = useTranslation();
  const { claims } = useSession();
  const familyId = claims?.family_id ?? "";
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{section?:string;setup?:string}>();
  const {width,fontScale}=useWindowDimensions();
  const wide=width>=850&&fontScale<1.4;
  // U03 groups: account / family / devices / learning / help. Older links keep working ("security" now lives under devices).
  const requested = params.section === "security" ? "devices" : params.section ?? "";
  const [section,setSection] = useState(["family","devices","learning","account","help"].includes(requested) ? requested : "family");
  const [setup, setSetup] = useState<SetupChild | "new" | null>(params.setup === "new" ? "new" : null);
  const [savedChild, setSavedChild] = useState<"new" | "edit" | null>(null);
  const [deleting, setDeleting] = useState<{ childId: string; name: string } | null>(null);
  const [deletedName, setDeletedName] = useState<string | null>(null);

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
    queryKey: ["children_setup", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("children").select("id, name, grade, avatar, birth_year, gender, interests").is("archived_at", null).order("sort_order");
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
      <View accessibilityRole="tablist" style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{([
        ["family","menuFamily",Users],["devices","menuDevices",Tablet],["learning","menuLearning",BookOpen],["account","menuAccount",UserRound],["help","menuHelp",CircleHelp],
      ] as const).map(([key,label,Icon])=><Pressable key={key} accessibilityRole="tab" accessibilityState={{selected:section===key}} aria-selected={section===key} onPress={()=>setSection(key)} style={{flexBasis:wide?"18%":"30%",flexGrow:1,minHeight:56,paddingHorizontal:10,paddingVertical:10,borderRadius:19,borderWidth:1,borderColor:section===key?"#78C7AE":"#E5DEED",backgroundColor:section===key?"#DDF5EB":"#FFF",flexDirection:"row",alignItems:"center",gap:8}}><Icon size={20} color="#6042DE" style={{flexShrink:0}}/><Text style={[parentStyles.copy,{fontFamily:"Nunito_800ExtraBold",flex:1}]}>{t(`parentToday.${label}`)}</Text></Pressable>)}</View>
      {section === "family" ? <>
      <NavigationCard title={t("parent.addChild")} body={t("betaUx.addChildBody")} icon={<Users size={24} color="#6042DE"/>} onPress={() => { setSavedChild(null); setSetup("new"); }}/>
      {setup && <ChildSetup child={setup === "new" ? undefined : setup} onClose={() => setSetup(null)} onSaved={() => { setSavedChild(setup === "new" ? "new" : "edit"); setSetup(null); }}/>}
      {savedChild ? <View accessibilityLiveRegion="polite"><InfoCard title={t("common.saved")} body={savedChild === "new" ? t("unified.childAdded") : undefined}>
        {savedChild === "new" ? <Button variant="secondary" title={t("unified.devicesTab")} onPress={() => { setSavedChild(null); setSection("devices"); }}/> : null}
        <Button variant="ghost" title={t("parent.home")} onPress={() => router.replace("/parent")}/>
      </InfoCard></View> : null}


      <View style={{gap:12}}>
        <Text style={parentStyles.title}>{t("parent.children")}</Text><Text style={parentStyles.muted}>{t("unified.childrenHelp")}</Text>
        {children.data?.map((child) => (
          <ChildRow key={child.id} id={child.id} name={child.name} grade={child.grade} avatar={child.avatar} onEdit={() => { setSavedChild(null); setSetup(child); }} />
        ))}

      </View>

      <NavigationCard title={t("childArchive.title")} body={t("childArchive.archiveMenuBody")} onPress={()=>router.push("/parent/profile-archive")}/>
      <FormSection title={t("unified.inviteTitle")}><Text style={parentStyles.muted}>{t("unified.inviteHelp")}</Text><Text selectable accessibilityLabel={t("parent.inviteCode")} style={{fontFamily:"Nunito_800ExtraBold",fontSize:26,letterSpacing:3,color:"#201951"}}>{family.data?.invite_code ?? "…"}</Text><NavigationCard title={t("experience.family.title")} body={t("experience.family.short")} onPress={()=>router.push("/parent/families")}/></FormSection>
      <DangerZone>
        {deletedName ? <Text accessibilityLiveRegion="polite" style={[parentStyles.copy, { fontFamily: "Nunito_700Bold" }]}>{t("deletionPreview.done", { name: deletedName })}</Text> : null}
        {children.data?.map((child) => <Button key={child.id} variant="danger" title={t("deletionPreview.open", { name: child.name })} onPress={() => { setDeletedName(null); setDeleting({ childId: child.id, name: child.name }); }} />)}
      </DangerZone>
      {deleting ? <DeletionPreviewSheet target={{ kind: "child", ...deleting }} perform={confirmChildDeletion}
        onClose={() => setDeleting(null)}
        onDone={(preview) => { setDeleting(null); setDeletedName(preview.kind === "child" ? preview.child.name : deleting.name); void queryClient.invalidateQueries(); }} /> : null}
      </> : null}
      {section === "devices" ? <>
      <Text style={parentStyles.copy}>{t("parentToday.menuDevicesBody")}</Text>
      {/* Child mode's "set a parent PIN first" link still opens ?section=security: show the PIN first then. */}
      {params.section === "security" ? <ParentPinRow/> : null}
      {/* C06: one pairing path. Typed code, QR link and post-sign-in hand-off all use /parent/pair-device (preview, then confirm). */}
      <NavigationCard title={t("parent.pairDevice")} body={t("unified.pairIntro")} icon={<Tablet size={23} color="#6042DE"/>} onPress={()=>router.push("/parent/pair-device")}/>
      <View style={parentStyles.card}><Text style={parentStyles.title}>{t("unified.connectedDevices")}</Text>
        {devices.data?.length ? <Text style={parentStyles.muted}>{t("unified.deviceRemoveHelp")}</Text> : <Text style={parentStyles.copy}>{t("unified.noDevices")}</Text>}
        {devices.data?.map(device=><View key={device.id} style={{gap:10,borderTopWidth:1,borderColor:"#EEE8EF",paddingTop:14}}><NavigationCard title={device.name} body={t("experience.device.manage")} onPress={()=>router.push({pathname:"/parent/device-access",params:{deviceId:device.id}})}/><ConfirmAction title={t("parent.removeDevice")} message={t("unified.deviceRemoveHelp")} busy={revokeDevice.isPending} onConfirm={()=>revokeDevice.mutate(device.id)}/></View>)}
        {revokeDevice.isSuccess ? <Text accessibilityLiveRegion="polite" style={parentStyles.muted}>{t("unified.deviceRemoved")}</Text> : null}
      </View>
      {/* Q00-A1-16: the same-phone child mode card lives in one place, next to the parent PIN that exits it. */}
      <View style={parentStyles.card}><View style={{flexDirection:"row",alignItems:"center",gap:10}}><ShieldCheck size={22} color="#6042DE"/><Text style={[parentStyles.title,{flex:1}]}>{t("unified.samePhone")}</Text></View>
        <Text style={parentStyles.copy}>{t("unified.samePhoneBody")}</Text><Button variant="secondary" title={t("unified.childModeAction")} onPress={()=>router.push("/parent/child-mode")}/></View>
      {params.section !== "security" ? <ParentPinRow/> : null}
      </> : null}
      {section === "learning" ? <>
      <Text style={parentStyles.copy}>{t("parentToday.menuLearningBody")}</Text>
      <NavigationCard title={t("parent.grades")} body={t("unified.gradesHelp")} icon={<GraduationCap size={23} color="#6042DE"/>} onPress={()=>router.push("/parent/grades")}/>
      <NavigationCard title={t("parent.notes")} body={t("unified.notesHelp")} icon={<NotebookPen size={23} color="#6042DE"/>} onPress={()=>router.push("/parent/notes")}/>
      <NavigationCard title={t("share.title")} body={t("unified.shareHelp")} icon={<Share2 size={22} color="#6042DE"/>} onPress={()=>router.push("/parent/share")}/>
      </> : null}
      {section === "help" ? <>
      <Text style={parentStyles.copy}>{t("parentToday.menuHelpBody")}</Text>
      <NavigationCard title={t("help.title")} body={t("help.subtitle")} icon={<CircleHelp size={22} color="#6042DE"/>} onPress={()=>router.push("/parent/help")}/>
      </> : null}
      {section === "account" ? <>
      <Text style={parentStyles.copy}>{t("parentToday.menuAccountBody")}</Text>
      <NavigationCard title={t("inbox.title")} body={t("inbox.subtitle")} icon={<Inbox size={22} color="#6042DE"/>} onPress={()=>router.push("/parent/inbox")}/>
      <NavigationCard title={t("inbox.preferences")} body={t("accountV5.notificationsBody")} icon={<Bell size={22} color="#6042DE"/>} onPress={()=>router.push("/parent/notifications")}/>
      <NavigationCard title={t("parent.subscription")} icon={<Crown size={22} color="#6042DE"/>} onPress={()=>router.push("/parent/subscription")}/>
      <DangerZone><AccountDeletion /></DangerZone>
      <Button variant="ghost" title={t("auth.signOut")} loading={signOut.isPending} onPress={() => signOut.mutate()} />
      </> : null}
      <ErrorText error={family.error ?? children.error ?? devices.error ?? revokeDevice.error ?? signOut.error} />

    </Screen>
  );
}
