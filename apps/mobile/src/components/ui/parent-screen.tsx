import { useEffect, useState, type ReactNode } from "react";
import { router, usePathname } from "expo-router";
import { ArrowLeft, Menu, Home, Plus, ChevronDown, ChevronUp, ChevronRight, Info } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/avatar";
import { Collectible } from "@/components/collectible";
import { LoadingStar } from "@/components/collectible-motion";
import { Button } from "./button";
import { ErrorText } from "./screen";

export interface ParentScreenProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  home?: boolean;
  navigation?: boolean;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}
/** Shared cream, mint and purple shell; actions and form state stay with each screen. */
export function ParentScreen({ title, subtitle, children, home = false, navigation = true, loading, error, onRetry }: ParentScreenProps) {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const spacious = width >= 800 && fontScale < 1.4;
  const path = usePathname();
  const inMenu = path === "/parent/menu";
  const art = path.includes('prova') ? require('../../../../../packages/assets/brand/growing-friend/reading.png')
    : /device|pin|reset-password/.test(path) ? require('../../../../../packages/assets/brand/growing-friend/contextual/device.png')
    : /reward|goal|collection|subscription/.test(path) ? require('../../../../../packages/assets/brand/growing-friend/contextual/reward.png')
    : /calendar|task|approval|plan|notification/.test(path) ? require('../../../../../packages/assets/brand/growing-friend/contextual/planner.png')
    : /famil|sign-in|menu|share/.test(path) ? require('../../../../../packages/assets/brand/growing-friend/contextual/family.png') : null;
  const MenuIcon = inMenu ? Home : Menu;
  const pageWidth = !navigation ? 680 : /famil|pin|notification|share|subscription|room-credits|notes|grades/.test(path) ? 820 : 1000;
  return <SafeAreaView style={styles.root}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.topbar, {maxWidth:pageWidth}]}>
        <View style={styles.brand}>
          {navigation && !home ? <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => router.canGoBack() ? router.back() : router.replace("/parent")} style={styles.back}><ArrowLeft size={24} color="#201951" /></Pressable> : <Image source={require("../../../../../packages/assets/brand/growing-friend/logo.png")} style={{width:124,height:48}} resizeMode="contain" accessibilityLabel={t("app.name")} />}
          {navigation && !home ? <Image source={require("../../../../../packages/assets/brand/growing-friend/logo.png")} style={{width:96,height:40}} resizeMode="contain" accessibilityLabel={t("app.name")} /> : null}
        </View>
          {navigation ? <Pressable accessibilityRole="button" accessibilityLabel={t(inMenu ? "parent.home" : "parent.menu")} onPress={() => router.push(inMenu ? "/parent" : "/parent/menu")} style={styles.menu}><MenuIcon size={22} color="#201951"/><Text style={styles.menuLabel}>{t(inMenu ? "parent.home" : "parent.menu")}</Text></Pressable> : null}
        </View>
      <ScrollView style={styles.fill} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, {maxWidth:pageWidth}]}>
        <View style={styles.header}>
          <View style={{flex:1,gap:8,minWidth:0}}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {art && fontScale < 1.4 ? <Image source={art} accessible={false} pointerEvents="none" resizeMode="contain" style={{width:spacious?132:88,height:spacious?120:84}} /> : null}
        </View>
        <View style={styles.body}>
          {loading ? <View style={styles.state} accessibilityLiveRegion="polite"><LoadingStar size={64} accessibilityLabel={t("release.loading")} /><Text style={styles.copy}>{t("release.loading")}</Text></View>
            : error ? <View style={styles.state}><Collectible slug="display-bookworm" size={96} /><Text style={styles.sectionTitle}>{t("release.loadError")}</Text><ErrorText error={error} />{onRetry ? <Button title={t("common.retry")} onPress={onRetry} /> : null}</View>
              : children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function EmptyCard({ title, body, slug = "display-first-task", children }: { title: string; body?: string; slug?: string; children?: ReactNode }) {
  return <View style={styles.state}><Collectible slug={slug} size={96} /><Text style={styles.sectionTitle}>{title}</Text>{body ? <Text style={[styles.copy, { textAlign: "center" }]}>{body}</Text> : null}{children}</View>;
}

export function ChildPicker({ profiles, selected, onSelect, allLabel }: {
  profiles: { id: string; name: string; avatar?: string | null }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  allLabel?: string;
}) {
  const soleId = profiles.length === 1 && !allLabel ? profiles[0].id : null;
  useEffect(() => { if (soleId && selected !== soleId) onSelect(soleId); }, [soleId, selected, onSelect]);
  if (soleId) return <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Avatar slug={profiles[0].avatar} size={40}/><Text style={parentStyles.copy}>{profiles[0].name}</Text></View>;
  const options = allLabel ? [{ id: null, name: allLabel, avatar: null }, ...profiles] : profiles;
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {options.map(child => <Pressable key={child.id ?? "all"} accessibilityRole="button" accessibilityState={{ selected: selected === child.id }} aria-pressed={selected === child.id}
      onPress={() => onSelect(child.id)} style={({ pressed }) => ({ minHeight: 52, paddingLeft: child.id ? 4 : 16, paddingRight: 16, paddingVertical: 4, borderRadius: 28, borderWidth: 1,
        borderColor: selected === child.id ? "#78C7AE" : "#E5DEED", backgroundColor: selected === child.id ? "#DDF5EB" : "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? .8 : 1 })}>
      {child.id ? <Avatar slug={child.avatar} size={40} /> : null}<Text style={{ fontFamily: "Nunito_700Bold", fontSize: 17, color: "#201951" }}>{child.name}</Text>
    </Pressable>)}
  </View>;
}

export const parentStyles = StyleSheet.create({
  card: { backgroundColor: "#FFFFFF", borderColor: "#EAE5EE", borderWidth: 1, borderRadius: 26, padding: 22, gap: 16, boxShadow: "0 4px 16px #35255706" },
  form: { backgroundColor: "#F5F1FC", borderColor: "#E4DCF1", borderWidth: 1, borderRadius: 26, padding: 22, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 24, lineHeight: 30, color: "#201951" },
  copy: { fontFamily: "Nunito_400Regular", fontSize: 17, lineHeight: 25, color: "#201951" },
  muted: { fontFamily: "Nunito_400Regular", fontSize: 15, lineHeight: 22, color: "#625C85" },
});
/** Forms stay one deliberate action away; draft state belongs to the screen. */
export function FormSection({title,children,initiallyOpen=false}: {title:string;children:ReactNode;initiallyOpen?:boolean}) {
  const [open,setOpen]=useState(initiallyOpen);
  const Icon=open?ChevronUp:ChevronDown;
  return <View style={parentStyles.form}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={{minHeight:52,flexDirection:"row",alignItems:"center",gap:12}}>
      <View style={{width:40,height:40,borderRadius:14,backgroundColor:"#6042DE",alignItems:"center",justifyContent:"center"}}><Plus size={23} color="#FFFFFF"/></View>
      <Text style={[parentStyles.title,{flex:1,fontSize:21}]}>{title}</Text><Icon size={22} color="#201951"/>
    </Pressable>
    {open?<View style={{gap:18,paddingTop:12,borderTopWidth:1,borderTopColor:"#DDD5F4"}}>{children}</View>:null}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FCFAF6" }, fill: { flex: 1 },
  page: { width: "100%", maxWidth: 1000, alignSelf: "center", paddingBottom: 36 },
  topbar: {width:"100%",alignSelf:"center",flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,paddingHorizontal:20,paddingVertical:10},
  brand: {flexDirection:"row",alignItems:"center",gap:12,flexShrink:1},
  header: {marginHorizontal:20,marginTop:12,marginBottom:24,gap:12,flexDirection:"row",alignItems:"center"},
  back:{width:48,height:48,alignItems:"center",justifyContent:"center",borderRadius:24,backgroundColor:"#EEEAFE"},
  menu:{flexShrink:1,minHeight:48,flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:14,borderRadius:18,backgroundColor:"#EEEAFE"},
  menuLabel:{flexShrink:1,fontFamily:"Nunito_700Bold",fontSize:16,color:"#201951"},
  title:{fontFamily:"Nunito_800ExtraBold",fontSize:30,lineHeight:38,color:"#201951"},
  subtitle:{fontFamily:"Nunito_400Regular",fontSize:17,lineHeight:25,color:"#625C85"},
  body:{paddingHorizontal:20,gap:22},
  state:{alignItems:"center",gap:12,borderRadius:24,backgroundColor:"#FFFFFF",padding:24},
  sectionTitle:{fontFamily:"Nunito_700Bold",fontSize:24,lineHeight:31,color:"#201951",textAlign:"center"},
  copy:{fontFamily:"Nunito_400Regular",fontSize:17,lineHeight:25,color:"#625C85"},
});

export function InfoCard({title,body,steps,children}:{title:string;body?:string;steps?:string[];children?:ReactNode}) {
  return <View style={{backgroundColor:"#EDF7F1",borderColor:"#D4E9DD",borderWidth:1,borderRadius:24,padding:20,gap:12}}>
    <View style={{flexDirection:"row",alignItems:"center",gap:10}}><Info size={21} color="#287460"/><Text accessibilityRole="header" style={[parentStyles.copy,{flex:1,fontFamily:"Nunito_800ExtraBold"}]}>{title}</Text></View>
    {body ? <Text style={parentStyles.muted}>{body}</Text> : null}
    {steps?.map((step,index)=><View key={step} style={{flexDirection:"row",gap:10,alignItems:"flex-start"}}><View style={{width:26,height:26,borderRadius:13,backgroundColor:"#D0EBDC",alignItems:"center",justifyContent:"center"}}><Text style={{fontFamily:"Nunito_800ExtraBold",color:"#275D4E"}}>{index+1}</Text></View><Text style={[parentStyles.muted,{flex:1}]}>{step}</Text></View>)}
    {children}
  </View>;
}
export function NavigationCard({title,body,icon,onPress}:{title:string;body?:string;icon?:ReactNode;onPress:()=>void}) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>[parentStyles.card,{minHeight:82,flexDirection:"row",alignItems:"center",gap:14,backgroundColor:pressed?"#F1ECFA":"#FFFFFF"}]}>
    {icon ? <View style={{width:44,height:44,borderRadius:15,backgroundColor:"#EEE8FA",alignItems:"center",justifyContent:"center"}}>{icon}</View>:null}
    <View style={{flex:1,gap:4}}><Text style={[parentStyles.copy,{fontFamily:"Nunito_800ExtraBold"}]}>{title}</Text>{body?<Text style={parentStyles.muted}>{body}</Text>:null}</View><ChevronRight size={20} color="#756397"/>
  </Pressable>;
}
