import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, Text, View } from "react-native";

import { ChildScreen, V5_CHARACTERS, V5_PETS, childStyles } from "@/components/room/child-screen";
import { useActiveChild } from "@/lib/active-child";
import { useChildRoomPrefs } from "@/lib/use-child-room-prefs";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { ErrorText } from "@/components/ui/screen";
import type { CharacterKey, PetKey } from "@/components/room/scene";

/** Preview before saving. Character and pet have independent server-side preferences. */
export default function RoomPreviewScreen() {
  const { t } = useTranslation();
  const [draftCharacter, setCharacter] = useState<CharacterKey>();
  const [draftPet, setPet] = useState<PetKey>();
  const [tab, setTab] = useState<"character" | "room" | "pet">("character");
  const { childId, actingAsParent } = useActiveChild();
  const prefs = useChildRoomPrefs(childId);
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const savedCharacter = prefs.data?.characterKey;
  const character = draftCharacter ?? (savedCharacter === "girl" || savedCharacter === "boy" ? savedCharacter : "unspecified");
  const pet = draftPet ?? (prefs.data?.petKey as PetKey | undefined) ?? "cat";
  const save = useMutation({
    mutationFn: async () => {
      const args = { p_acting_child_id: actingAsParent ? childId : undefined };
      const result = tab === "pet"
        ? await supabase.rpc("set_room_pet", { ...args, p_pet: pet })
        : await supabase.rpc("set_room_preference", { ...args, p_character: character, p_theme: "default" });
      if (result.error) throw result.error;
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["child_room_prefs", childId] }); setSaved(true); if (tab === "pet") setPet(undefined); else setCharacter(undefined); },
  });
  const dirty = tab === "pet" ? pet !== (prefs.data?.petKey ?? "cat") : character !== (prefs.data?.characterKey ?? "unspecified");
  return <ChildScreen loading={prefs.isLoading} title={t("childV5.customize")} character={character} pet={pet}>
    <View accessibilityRole="tablist" className="flex-row flex-wrap gap-2">
      {(["character", "room", "pet"] as const).map(key => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: key === tab }} aria-selected={key === tab}
        disabled={save.isPending} onPress={() => { setTab(key); setSaved(false); }} style={[childStyles.card, { minHeight: 48, paddingVertical: 10, backgroundColor: key === tab ? "#D9F4F2" : "#FFFCF5" }]}>
        <Text style={childStyles.copy}>{t(`childV5.tab.${key}`)}</Text>
      </Pressable>)}
    </View>
    {tab === "character" ? <View accessibilityRole="radiogroup" accessibilityLabel={t("childV5.tab.character")} className="flex-row flex-wrap gap-3">
      {(["unspecified", "girl", "boy"] as const).map(key => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: character === key }} aria-checked={character === key}
        accessibilityLabel={t(`room.character.${key}`)} disabled={save.isPending || !prefs.isSuccess} onPress={() => { setCharacter(key); setSaved(false); }}
        style={[childStyles.card, { flexBasis: 140, flexGrow: 1, alignItems: "center", borderWidth: 2, borderColor: key === character ? "#0B7F7F" : "#E2CFB2", backgroundColor: key === character ? "#E6F7EF" : "#FFFCF5" }]}>
        <Image source={V5_CHARACTERS[key]} style={{ width: 100, height: 120 }} resizeMode="contain" accessible={false} />
        <Text style={childStyles.copy}>{t(`room.character.${key}`)}</Text>
      </Pressable>)}
    </View> : tab === "pet" ? <View accessibilityRole="radiogroup" accessibilityLabel={t("childV5.tab.pet")} className="flex-row flex-wrap gap-3">
      {(["cat", "dog", "monkey", "lion", "none"] as const).map(key => <Pressable key={key} accessibilityRole="radio" accessibilityState={{ checked: pet === key }} aria-checked={pet === key}
        accessibilityLabel={t(`childV5.pet.${key}`)} disabled={save.isPending || !prefs.isSuccess} onPress={() => { setPet(key); setSaved(false); }}
        style={[childStyles.card, { flexBasis: 140, flexGrow: 1, alignItems: "center", borderWidth: 2, borderColor: key === pet ? "#0B7F7F" : "#E2CFB2" }]}>
        {key !== "none" ? <Image source={V5_PETS[key]} style={{ width: 100, height: 80 }} resizeMode="contain" accessible={false} /> : null}
        <Text style={childStyles.copy}>{t(`childV5.pet.${key}`)}</Text>
      </Pressable>)}
    </View> : <View style={childStyles.card}>
      <Image source={require("../../../../../packages/assets/rooms/v2/room-study-v5.webp")} style={{ width: "100%", aspectRatio: 1586 / 992, borderRadius: 12 }} resizeMode="contain" accessible={false} />
      <Text style={childStyles.title}>{t("childV5.currentRoom")}</Text>
      <Text style={childStyles.copy}>{t("childV5.roomThemesNote")}</Text>
    </View>}
    <ErrorText error={prefs.error ?? save.error} />
    {tab !== "room" ? <Button title={t("common.save")} loading={save.isPending} disabled={!childId || !prefs.isSuccess || !dirty} onPress={() => save.mutate()} /> : null}
    {saved ? <Text style={childStyles.copy} accessibilityLiveRegion="polite">{t("release.roomSaved")}</Text> : null}
  </ChildScreen>;
}
