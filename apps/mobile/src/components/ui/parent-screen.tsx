import Wordmark from "../../../../../packages/assets/brand/yan-yana/logo-wordmark.svg";
import { useState, type ReactNode } from "react";
import { router } from "expo-router";
import { ArrowLeft, Menu, Plus, ChevronDown, ChevronUp } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
/** Approved v5 paper surface. Text stays native; only the window vignette is raster art. */
export function ParentScreen({ title, subtitle, children, home = false, navigation = true, loading, error, onRetry }: ParentScreenProps) {
  const { t } = useTranslation();
  return <SafeAreaView style={styles.root}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.fill} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        <View style={styles.topbar}>
          {navigation && !home ? <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => router.canGoBack() ? router.back() : router.replace("/parent")} style={styles.back}><ArrowLeft size={24} color="#284E4B" /></Pressable> : <Wordmark width={112} height={48} accessibilityLabel={t("app.name")} />}
          {navigation ? <Pressable accessibilityRole="button" accessibilityLabel={t("parent.menu")} onPress={() => router.push("/parent/menu")} style={styles.menu}><Menu size={22} color="#284E4B"/><Text style={styles.menuLabel}>{t("parent.menu")}</Text></Pressable> : null}
        </View>
        <View style={[styles.header, home && styles.homeHeader]}>
          {home ? <Image source={require("../../../../../packages/assets/rooms/v2/parent-header-v5.webp")} accessible={false} pointerEvents="none" resizeMode="contain" style={styles.art} /> : null}
          <Text accessibilityRole="header" style={[styles.title, home && {maxWidth:"70%"}]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, home && {maxWidth:"64%"}]}>{subtitle}</Text> : null}
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
  const options = allLabel ? [{ id: null, name: allLabel, avatar: null }, ...profiles] : profiles;
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {options.map(child => <Pressable key={child.id ?? "all"} accessibilityRole="button" accessibilityState={{ selected: selected === child.id }} aria-pressed={selected === child.id}
      onPress={() => onSelect(child.id)} style={({ pressed }) => ({ minHeight: 52, paddingLeft: child.id ? 4 : 16, paddingRight: 16, paddingVertical: 4, borderRadius: 28, borderWidth: 1,
        borderColor: selected === child.id ? "#0B7F7F" : "#D7CDBB", backgroundColor: selected === child.id ? "#0B7F7F" : "#FFFCF6", flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? .8 : 1 })}>
      {child.id ? <Avatar slug={child.avatar} size={40} /> : null}<Text style={{ fontFamily: "Nunito_700Bold", fontSize: 17, color: selected === child.id ? "#FFFFFF" : "#294A48" }}>{child.name}</Text>
    </Pressable>)}
  </View>;
}

export const parentStyles = StyleSheet.create({
  card: { backgroundColor: "#FFFCF6", borderColor: "#E4DAC8", borderWidth: 1, borderRadius: 22, padding: 20, gap: 16 },
  form: { backgroundColor: "#E6F3ED", borderColor: "#C4DCD0", borderWidth: 1, borderRadius: 22, padding: 18, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  title: { fontFamily: "Baloo2_700Bold", fontSize: 24, lineHeight: 30, color: "#294A48" },
  copy: { fontFamily: "Nunito_400Regular", fontSize: 17, lineHeight: 25, color: "#294A48" },
  muted: { fontFamily: "Nunito_400Regular", fontSize: 15, lineHeight: 22, color: "#63736B" },
});
/** Forms stay one deliberate action away; draft state belongs to the screen. */
export function FormSection({title,children,initiallyOpen=false}: {title:string;children:ReactNode;initiallyOpen?:boolean}) {
  const [open,setOpen]=useState(initiallyOpen);
  const Icon=open?ChevronUp:ChevronDown;
  return <View style={parentStyles.form}>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={{minHeight:52,flexDirection:"row",alignItems:"center",gap:12}}>
      <View style={{width:40,height:40,borderRadius:14,backgroundColor:"#0B7F7F",alignItems:"center",justifyContent:"center"}}><Plus size={23} color="#FFFFFF"/></View>
      <Text style={[parentStyles.title,{flex:1,fontSize:21}]}>{title}</Text><Icon size={22} color="#284E4B"/>
    </Pressable>
    {open?<View style={{gap:18,paddingTop:12,borderTopWidth:1,borderTopColor:"#C4DCD0"}}>{children}</View>:null}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFF8EF" }, fill: { flex: 1 },
  page: { width: "100%", maxWidth: 780, alignSelf: "center", paddingBottom: 36 },
  topbar: {flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:22,paddingTop:8,paddingBottom:8},
  header: {paddingHorizontal:24,paddingTop:8,paddingBottom:24,gap:8},
  homeHeader:{minHeight:138,justifyContent:"center",overflow:"hidden"},
  art: {position:"absolute",width:240,height:162,right:-62,bottom:0},
  back:{width:48,height:48,alignItems:"center",justifyContent:"center",borderRadius:16,backgroundColor:"#E1F2EB"},
  menu:{minHeight:48,flexDirection:"row",alignItems:"center",gap:8,paddingHorizontal:14,borderRadius:18,backgroundColor:"#E1F2EB"},
  menuLabel:{fontFamily:"Nunito_700Bold",fontSize:16,color:"#284E4B"},
  title:{fontFamily:"Baloo2_700Bold",fontSize:34,lineHeight:42,color:"#284E4B"},
  subtitle:{fontFamily:"Nunito_400Regular",fontSize:17,lineHeight:25,color:"#425E58"},
  body:{paddingHorizontal:20,gap:22},
  state:{alignItems:"center",gap:12,borderRadius:24,backgroundColor:"#FFFCF6",padding:24},
  sectionTitle:{fontFamily:"Baloo2_700Bold",fontSize:24,lineHeight:31,color:"#284E4B",textAlign:"center"},
  copy:{fontFamily:"Nunito_400Regular",fontSize:17,lineHeight:25,color:"#425E58"},
});
