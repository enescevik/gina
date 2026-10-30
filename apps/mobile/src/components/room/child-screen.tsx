import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import manifest from "../../../../../packages/assets/rooms/v2/manifest.json";
import { useActiveChild } from "@/lib/active-child";
import { useChildRoomPrefs } from "@/lib/use-child-room-prefs";
import { NineSlice } from "./nine-slice";
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
const ROOM = require("../../../../../packages/assets/rooms/v2/room-study-v5.webp");

// All sprites align their visible content, not transparent square canvases, to one floor line.
function spriteRect(slug: string, centerX: number, floor: number, fitWidth: number, fitHeight: number) {
  const asset = manifest.find((item) => item.slug === slug)!;
  const { width = 1, height = 1, contentBounds = [0, 0, width, height] } = asset;
  const [x0 = 0, y0 = 0, x1 = width, y1 = height] = contentBounds;
  const scale = Math.min(fitWidth / (x1 - x0), fitHeight / (y1 - y0));
  return { left: centerX - (x0 + x1) / 2 * scale, top: floor - y1 * scale, width: width * scale, height: height * scale };
}

function RoomArt({ width, height, character, pet }: { width: number; height: number; character: CharacterKey; pet: PetKey }) {
  const w = Math.max(width, height * 1586 / 992);
  const h = w * 992 / 1586;
  return <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <Image source={ROOM} resizeMode="stretch" style={{ position: "absolute", width: w, height: h, right: 0, bottom: 0 }} />
    <Image source={V5_CHARACTERS[character]} style={{ position: "absolute", ...spriteRect(`character-${character}-v5`, width * .82, height * .92, width * .27, height * .53) }} resizeMode="contain" />
    {pet !== "none" ? <Image source={V5_PETS[pet]} resizeMode="contain" style={{ position: "absolute", ...spriteRect(`pet-${pet}`, width * .665, height * .93, width * .15, height * .13) }} /> : null}
  </View>;
}

export interface ChildScreenProps {
  title?: string;
  children: ReactNode;
  tone?: "child";
  scroll?: boolean;
  loading?: boolean;
  character?: CharacterKey;
  pet?: PetKey;
  surface?: "board" | "desk" | "collection";
}

/** Shared child surface; explicit preview props override the saved room preferences. */
export function ChildScreen({ title, children, loading = false, character: previewCharacter, pet: previewPet, surface = "board" }: ChildScreenProps) {
  const { t } = useTranslation();
  const { childId } = useActiveChild();
  const prefs = useChildRoomPrefs(childId);
  const character = previewCharacter ?? (prefs.data?.characterKey === "girl" || prefs.data?.characterKey === "boy" ? prefs.data.characterKey : "unspecified");
  const pet = previewPet ?? (prefs.data?.petKey as PetKey | undefined) ?? "cat";
  const { width, height, fontScale } = useWindowDimensions();
  const wide = width >= 900 && height >= 600 && fontScale <= 1.2;
  const skin = surface === "desk" ? "child-notebook-v5" : surface === "collection" ? "child-cabinet-v5" : "child-board-v5";
  const header = <View style={styles.heading}>
    <Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {surface !== "collection" ? <Text style={styles.subtitle}>{t(surface === "desk" ? "childV5.deskSubtitle" : "childV5.subtitle")}</Text> : null}
  </View>;
  const body = loading ? <View style={styles.loading} accessibilityLiveRegion="polite">
    <ActivityIndicator color="#0B7F7F" size="large" /><Text style={styles.subtitle}>{t("childV5.loading")}</Text>
  </View> : children;
  return <SafeAreaView style={styles.root}>
    {wide ? <View style={styles.fill}>
      <RoomArt width={width} height={height} character={character} pet={pet} />
      {surface === "collection" ? <View style={[styles.board, { top: "2%", height: "96%" }]}>
        {header}
        <ScrollView style={styles.fill} contentContainerStyle={styles.content}>{body}</ScrollView>
      </View> : <NineSlice skin={skin} style={styles.board} contentStyle={styles.fill}>
        {header}
        <ScrollView style={styles.fill} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {body}
        </ScrollView>
      </NineSlice>}
    </View> : <ScrollView style={styles.fill} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ height: Math.max(226 * fontScale, width * .59), overflow: "hidden" }}>
        <RoomArt width={width} height={Math.max(226 * fontScale, width * .59)} character={character} pet={pet} />
        <NineSlice skin="child-board-v5" scale={.55} style={{ position: "absolute", left: 6, top: 4, width: width * .65, bottom: 58 }} contentStyle={{ justifyContent: "center" }}>{header}</NineSlice>
      </View>
      {surface === "board" ? <View style={styles.content}>{body}</View> :
        <NineSlice skin={skin} scale={.6} style={{ marginHorizontal: 6 }} contentStyle={{ minWidth: 0 }}>
          <View style={styles.content}>{body}</View>
        </NineSlice>}
    </ScrollView>}
  </SafeAreaView>;
}

export const childStyles = StyleSheet.create({
  card: { backgroundColor: "#FFFCF5", borderColor: "#E2CFB2", borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontFamily: "Baloo2_700Bold", fontSize: 22, lineHeight: 29, color: "#284E4B" },
  copy: { fontFamily: "Nunito_600SemiBold", fontSize: 16, lineHeight: 24, color: "#425E58" },
  shelf: { borderBottomWidth: 9, borderBottomColor: "#B77B39", backgroundColor: "#EED1A1", borderRadius: 8, padding: 16, alignItems: "center", gap: 8, flexGrow: 1, flexBasis: 180 },
});
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFF8EF" }, fill: { flex: 1, minHeight: 0 },
  board: { position: "absolute", left: "1.5%", top: "5%", width: "64%", height: "82%", borderRadius: 20, overflow: "hidden" },
  heading: { gap: 2, paddingHorizontal: 8, paddingVertical: 8 },
  title: { fontFamily: "Baloo2_700Bold", color: "#284E4B", fontSize: 30, lineHeight: 38 },
  subtitle: { fontFamily: "Nunito_600SemiBold", color: "#52685D", fontSize: 15, lineHeight: 22 },
  content: { gap: 16, padding: 12 },
  loading: { alignItems: "center", justifyContent: "center", minHeight: 180, gap: 18 },
});

/** Calendar rail beside the content on landscape tablets; the same nodes reflow on phones. */
export function ChildColumns({ rail, children }: { rail: ReactNode; children: ReactNode }) {
  const { width, height, fontScale } = useWindowDimensions();
  const sideBySide = width >= 1200 && height >= 600 && fontScale <= 1.2;
  return <View style={{ flexDirection: sideBySide ? "row" : "column", alignItems: "stretch", gap: 16 }}>
    <View style={sideBySide ? { width: 360 } : undefined}>{rail}</View>
    <View style={{ flex: 1, minWidth: 0, gap: 12 }}>{children}</View>
  </View>;
}
