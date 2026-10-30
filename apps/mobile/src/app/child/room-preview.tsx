import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, View } from "react-native";

import { ChildScreen, V5_CHARACTERS, V5_PETS, childStyles } from "@/components/room/child-screen";
import type { CharacterKey, PetKey } from "@/components/room/scene";

/** Presentation preview only; does not persist room preferences. */
export default function RoomPreviewScreen() {
  const { t } = useTranslation();
  const [character, setCharacter] = useState<CharacterKey>("unspecified");
  const [pet, setPet] = useState<PetKey>("cat");
  const [tab, setTab] = useState<"character" | "room" | "pet">("character");
  return <ChildScreen title={t("childV5.customize")} character={character} pet={pet}>
    <View accessibilityRole="tablist" className="flex-row flex-wrap gap-2">
      {(["character", "room", "pet"] as const).map(key => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: key === tab }} aria-selected={key === tab}
        onPress={() => setTab(key)} style={[childStyles.card, { minHeight: 48, paddingVertical: 10, backgroundColor: key === tab ? "#D9F4F2" : "#FFFCF5" }]}>
        <Text style={childStyles.copy}>{t(`childV5.tab.${key}`)}</Text>
      </Pressable>)}
    </View>
    {tab === "character" ? <View accessibilityRole="radiogroup" accessibilityLabel={t("childV5.tab.character")} className="flex-row flex-wrap gap-3">
      {(["unspecified", "girl", "boy"] as const).map(key => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: character === key }} aria-checked={character === key}
        accessibilityLabel={t(`room.character.${key}`)} onPress={() => setCharacter(key)}
        style={[childStyles.card, { flexBasis: 140, flexGrow: 1, alignItems: "center", borderWidth: 2, borderColor: key === character ? "#0B7F7F" : "#E2CFB2", backgroundColor: key === character ? "#E6F7EF" : "#FFFCF5" }]}>
        <Image source={V5_CHARACTERS[key]} style={{ width: 100, height: 120 }} resizeMode="contain" accessible={false} />
        <Text style={childStyles.copy}>{t(`room.character.${key}`)}</Text>
      </Pressable>)}
    </View> : tab === "pet" ? <View accessibilityRole="radiogroup" accessibilityLabel={t("childV5.tab.pet")} className="flex-row flex-wrap gap-3">
      {(["cat", "dog", "monkey", "lion", "none"] as const).map(key => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: pet === key }} aria-checked={pet === key}
        accessibilityLabel={t(`childV5.pet.${key}`)} onPress={() => setPet(key)}
        style={[childStyles.card, { flexBasis: 140, flexGrow: 1, alignItems: "center", borderWidth: 2, borderColor: key === pet ? "#0B7F7F" : "#E2CFB2" }]}>
        {key !== "none" ? <Image source={V5_PETS[key]} style={{ width: 100, height: 80 }} resizeMode="contain" accessible={false} /> : null}
        <Text style={childStyles.copy}>{t(`childV5.pet.${key}`)}</Text>
      </Pressable>)}
    </View> : <View style={childStyles.card}>
      <Image source={require("../../../../../packages/assets/rooms/v2/room-study-v5.webp")} style={{ width: "100%", aspectRatio: 1586 / 992, borderRadius: 12 }} resizeMode="contain" accessible={false} />
      <Text style={childStyles.title}>{t("childV5.currentRoom")}</Text>
      <Text style={childStyles.copy}>{t("childV5.roomThemesNote")}</Text>
    </View>}
    <Text style={childStyles.copy} accessibilityLiveRegion="polite">{t("childV5.previewOnly")}</Text>
  </ChildScreen>;
}
