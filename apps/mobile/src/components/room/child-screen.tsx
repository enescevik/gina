import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "@/components/ui/pressable";
import { ApprovedScene } from "@/components/child-home/approved-scene";
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
  loading?: boolean; character?: CharacterKey; pet?: PetKey; surface?: "board" | "desk" | "collection";
}

/** Fixed approved scene; no old room, pet or atmosphere is substituted on subpages. */
export function ChildScreen({ title, subtitle, children, loading = false, surface = "board" }: ChildScreenProps) {
  const { t } = useTranslation();
  const { path } = useActiveChild();
  const { width, height, fontScale } = useWindowDimensions();
  const wide = width >= 1000 && width > height && fontScale < 1.4;
  const heading = <View style={styles.heading}>
    <Pressable accessibilityRole="button" accessibilityLabel={t("child.today")} onPress={() => router.navigate(path("today"))} style={styles.back}><ArrowLeft size={24} color={c.purple} /></Pressable>
    <View style={{flex:1,gap:4}}><Text accessibilityRole="header" style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>
    <Image source={require("../../../../../packages/assets/brand/growing-friend/logo.png")} accessible={false} style={{width:80,height:36}} resizeMode="contain" />
  </View>;
  return <SafeAreaView style={styles.root}><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={[styles.fill,{flexDirection:'row'}]}>
      {wide && surface !== "desk" ? <ApprovedScene style={{width:Math.min(360,width*.28)}} /> : null}
      <View style={[styles.fill,wide && surface !== "desk" && {marginLeft:-22,borderTopLeftRadius:28,borderBottomLeftRadius:28,backgroundColor:c.cream,overflow:'hidden'}]}>
        {heading}
        <ScrollView style={styles.fill} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {loading ? <View style={styles.loading} accessibilityLiveRegion="polite"><ActivityIndicator size="large" color={c.purple}/><Text style={styles.subtitle}>{t("childV5.loading")}</Text></View> : children}
        </ScrollView>
      </View>
    </View>
  </KeyboardAvoidingView></SafeAreaView>;
}

export const childStyles = StyleSheet.create({
  card: { backgroundColor: c.white, borderColor: c.line, borderWidth: 1, borderRadius: 24, padding: 20, gap: 12 },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: "Nunito_700Bold", fontSize: 22, lineHeight: 29, color: c.ink },
  copy: { fontFamily: "Nunito_600SemiBold", fontSize: 16, lineHeight: 24, color: c.muted },
  shelf: { borderWidth: 1, borderColor:c.line, backgroundColor:c.white, borderRadius:20, padding:16, alignItems:"center", gap:8, flexGrow:1, flexBasis:180 },
});
const styles = StyleSheet.create({
  root: {flex:1,backgroundColor:c.cream}, fill:{flex:1,minHeight:0,minWidth:0},
  heading:{flexDirection:'row',alignItems:'center',gap:12,padding:18,borderBottomWidth:1,borderColor:c.line},
  back:{width:48,height:48,alignItems:'center',justifyContent:'center',backgroundColor:'#EEEAFE',borderRadius:16},
  title:{fontFamily:'Nunito_800ExtraBold',fontSize:26,lineHeight:33,color:c.ink},
  subtitle:{fontFamily:'Nunito_400Regular',fontSize:16,lineHeight:23,color:c.muted},
  content:{width:'100%',maxWidth:1000,alignSelf:'center',padding:18,paddingBottom:32,gap:16,flexGrow:1},
  loading:{minHeight:220,alignItems:'center',justifyContent:'center',gap:16},
});

export function ChildColumns({rail,children}:{rail:ReactNode;children:ReactNode}) {
  const {width,height,fontScale}=useWindowDimensions();
  const wide=width>=1280 && height>=600 && fontScale<1.3;
  return <View style={{flexDirection:wide?'row':'column',gap:16,alignItems:'stretch'}}>
    <View style={wide?{width:280}:undefined}>{rail}</View><View style={{flex:1,minWidth:0,gap:12}}>{children}</View>
  </View>;
}
