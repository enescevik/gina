import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "@/components/ui/pressable";
import { Collectible } from "@/components/collectible";
import { c } from "@/components/child-home/theme";
import { useActiveChild } from "@/lib/active-child";
import type { CharacterKey, PetKey } from "./scene";

export const V5_CHARACTERS = {
  girl: require("../../../../../packages/assets/rooms/v2/character-girl-v5.webp"),
  boy: require("../../../../../packages/assets/rooms/v2/character-boy-v5.webp"),
  unspecified: require("../../../../../packages/assets/rooms/v2/character-unspecified-v5.webp"),
};
export const V5_PETS = {
  cat: require("../../../../../packages/assets/rooms/v2/pet-cat.webp"),
  dog: require("../../../../../packages/assets/rooms/v2/pet-dog.webp"),
  monkey: require("../../../../../packages/assets/rooms/v2/pet-monkey.webp"),
  lion: require("../../../../../packages/assets/rooms/v2/pet-lion.webp"),
};


export interface ChildScreenProps {
  title?: string; subtitle?: string; children: ReactNode; tone?: "child"; scroll?: boolean;
  loading?: boolean; character?: CharacterKey; pet?: PetKey; surface?: "board" | "desk" | "collection" | "access";
}

/** Subpages share the approved brand without repeating the home scene behind each task. */
export function ChildScreen({ title, subtitle, children, loading = false, surface = "board", scroll = true }: ChildScreenProps) {
  const { t } = useTranslation();
  const { path } = useActiveChild();
  const { width, height, fontScale } = useWindowDimensions();
  const art = surface === "access"
    ? require("../../../../../packages/assets/brand/growing-friend/contextual/device.png")
    : surface === "collection"
    ? require("../../../../../packages/assets/brand/growing-friend/contextual/reward.png")
    : surface === "desk"
      ? require("../../../../../packages/assets/brand/growing-friend/reading.png")
      : require("../../../../../packages/assets/brand/growing-friend/contextual/planner.png");
  const body = <>
    <View style={styles.hero}>
      <View style={{flex:1,minWidth:0,gap:8}}>
        {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {height >= 600 && fontScale < 1.4 ? <Image source={art} accessible={false} resizeMode="contain" style={{width:width>=800?120:80,height:width>=800?108:76}}/> : null}
    </View>
    {loading ? <View style={styles.loading} accessibilityLiveRegion="polite"><ActivityIndicator size="large" color={c.purple}/><Text style={styles.subtitle}>{t("childV5.loading")}</Text></View> : children}
  </>;
  return <SafeAreaView style={styles.root}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={[styles.heading, surface === "access" && {maxWidth:680}, height < 520 && {paddingVertical:6}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("childMint.world")} onPress={() => router.navigate(path("today"))} style={styles.back}><ArrowLeft size={24} color={c.purple}/></Pressable>
      <Image source={require("../../../../../packages/assets/brand/growing-friend/logo.png")} accessibilityLabel={t("app.name")} style={{width:96,height:40}} resizeMode="contain"/>
    </View>
    {scroll ? <ScrollView style={styles.fill} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content,surface==="access"&&{maxWidth:680}]}>{body}</ScrollView>
      : <View style={[styles.content,styles.fill]}>{body}</View>}
  </KeyboardAvoidingView></SafeAreaView>;
}

export const childStyles = StyleSheet.create({
  card: { backgroundColor: c.white, borderColor: c.line, borderWidth: 1, borderRadius: 24, padding: 20, gap: 12 },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: "Nunito_800ExtraBold", fontSize: 24, lineHeight: 29, color: c.ink },
  copy: { fontFamily: "Nunito_600SemiBold", fontSize: 16, lineHeight: 24, color: c.muted },
  shelf: { borderWidth: 1, borderColor:c.line, backgroundColor:c.white, borderRadius:20, padding:16, alignItems:"center", gap:8, flexGrow:1, flexBasis:180 },
});
const styles = StyleSheet.create({
  root: {flex:1,backgroundColor:c.cream}, fill:{flex:1,minHeight:0,minWidth:0},
  heading:{width:'100%',maxWidth:1000,alignSelf:'center',flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:20,paddingVertical:10},
  hero:{flexDirection:'row',alignItems:'center',gap:12,marginBottom:8},
  back:{width:48,height:48,alignItems:'center',justifyContent:'center',backgroundColor:'#EEEAFE',borderRadius:24},
  title:{fontFamily:'Nunito_800ExtraBold',fontSize:30,lineHeight:38,color:c.ink},
  subtitle:{fontFamily:'Nunito_400Regular',fontSize:16,lineHeight:23,color:c.muted},
  content:{width:'100%',maxWidth:1000,alignSelf:'center',padding:20,paddingBottom:32,gap:20,flexGrow:1},
  loading:{minHeight:220,alignItems:'center',justifyContent:'center',gap:16},
});

export function ChildColumns({rail,children}:{rail:ReactNode;children:ReactNode}) {
  const {width,height,fontScale}=useWindowDimensions();
  const wide=width>=1000 && height>=600 && fontScale<1.3;
  return <View style={{flexDirection:wide?'row':'column',gap:16,alignItems:'stretch'}}>
    <View style={wide?{flex:1,minWidth:0}:undefined}>{rail}</View><View style={{flex:1,minWidth:0,gap:12}}>{children}</View>
  </View>;
}

/** Clear next-step context without turning an empty state into another navigation menu. */
export function ChildEmptyState({title, body, kind = "task"}: {title: string; body: string; kind?: "task" | "study" | "collection"}) {
  return <View style={[childStyles.card, {alignItems: "center", paddingVertical: 24}]}>
    <Collectible slug={kind === "study" ? "reward-book" : kind === "collection" ? "display-first-task" : "star-jar"} size={96}/>
    <Text style={[childStyles.title, {textAlign: "center"}]}>{title}</Text>
    <Text style={[childStyles.copy, {textAlign: "center", maxWidth: 420}]}>{body}</Text>
  </View>;
}
