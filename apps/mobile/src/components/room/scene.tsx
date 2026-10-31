import { PetMotion } from "./pet-motion";
import { useTranslation } from "react-i18next";
import { useRoomAudio } from "@/lib/use-room-audio";
import { AtmosphereControls } from "./atmosphere-controls";
import { useRoomAtmosphere } from "@/lib/use-room-atmosphere";
import { AtmosphereBackdrop } from "./atmosphere-backdrop";
import type { ReactNode } from "react";
import { Image, Pressable, View, useWindowDimensions, type ImageSourcePropType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import roomsManifest from "../../../../../packages/assets/rooms/v2/manifest.json";

import { CHARACTER_PLACEMENT, PET_PLACEMENT, sceneFrame, zoneRect, type SceneRect, type Zone } from "./layout";

// Üretim kaynakları (packages/assets/rooms/v2): pano/bilet/takvim/dolap tabana gömülü değil, kaplama olarak ayrı yerleşir.

const CHARACTERS = {
  unspecified: require("../../../../../packages/assets/rooms/v2/character-unspecified-v5.webp"),
  girl: require("../../../../../packages/assets/rooms/v2/character-girl-v5.webp"),
  boy: require("../../../../../packages/assets/rooms/v2/character-boy-v5.webp"),
} as const;
export type CharacterKey = keyof typeof CHARACTERS;

/** child_room_preferences.pet_key değerleri (20261030160000_room_pet.sql). */
export type PetKey = "none" | "cat" | "dog" | "monkey" | "lion";

// BRIEF 13 evcil hayvan katmanları; petsiz seçimde dekor çizilmez.
const PETS: Partial<Record<Exclude<PetKey, "none">, ImageSourcePropType>> = {
  cat: require("../../../../../packages/assets/rooms/v2/pet-cat.webp"),
  dog: require("../../../../../packages/assets/rooms/v2/pet-dog.webp"),
  monkey: require("../../../../../packages/assets/rooms/v2/pet-monkey.webp"),
  lion: require("../../../../../packages/assets/rooms/v2/pet-lion.webp"),
};

function petSource(pet: string | null | undefined): ImageSourcePropType | null {
  if (!pet || pet === "none") return null;
  return PETS[pet as Exclude<PetKey, "none">] ?? null;
}

interface CharacterEntry {
  slug: string;
  width?: number;
  height?: number;
  contentBounds?: number[];
}

/** Manifestteki alfa içerik sınırları: [x0, y0, x1, y1] kaynak pikseli. */
function contentBoundsOf(key: CharacterKey) {
  const entry = (roomsManifest as CharacterEntry[]).find((e) => e.slug === `character-${key}-v5`);
  const size = entry?.width ?? 1254;
  const [x0, y0, x1, y1] = entry?.contentBounds ?? [0, 0, size, size];
  return { size, x0: x0 ?? 0, y0: y0 ?? 0, x1: x1 ?? size, y1: y1 ?? size };
}

/**
 * Karakter dikdörtgeni: üç karakter aynı ölçekle çizilir ve kare tuvalin değil içerik sınırının
 * altı aynı ayak çizgisine, içerik merkezi aynı x'e hizalanır (preview-note "Oda ve karakterler").
 */
function characterRect(key: CharacterKey, frame: SceneRect): SceneRect {
  const b = contentBoundsOf(key);
  // Sahne pikseli / kaynak pikseli: referans içerik yüksekliği (normalize) ↔ kız karakterinin içerik yüksekliği.
  const ref = contentBoundsOf("girl");
  const scale = (CHARACTER_PLACEMENT.contentHeight * frame.height) / (ref.y1 - ref.y0);
  const footY = frame.top + CHARACTER_PLACEMENT.footY * frame.height;
  const centerX = frame.left + CHARACTER_PLACEMENT.centerX * frame.width;
  return {
    left: centerX - ((b.x0 + b.x1) / 2) * scale,
    top: footY - b.y1 * scale,
    width: b.size * scale,
    height: b.size * scale,
  };
}

export interface RoomSceneProps {
  character: CharacterKey;
  /** Odadaki evcil hayvan (child_room_preferences.pet_key); görseli yoksa çizilmez. */
  pet?: string | null;
  /** Bölge adı → gerçek RN içeriği; dekor erişilebilirlik ağacına girmez, içerik girer. */
  children: (helpers: { rect: (zone: Zone) => SceneRect; frame: SceneRect; night: boolean }) => ReactNode;
}

/**
 * Katmanlı oda sahnesi: oda tabanı → evcil hayvan → karakter → kaplamalar + gerçek metin/kontroller (children).
 * Sanat Image olarak contain-fit ile çizilir; hiçbir buton görselin içine gömülmez.
 * Özel gün dekoru gelecekte taban ile karakter arasına ayrı katman olarak eklenir.
 */
export function RoomScene({ character, pet, children }: RoomSceneProps) {
  const atmosphere = useRoomAtmosphere();
  const audio = useRoomAudio(atmosphere);
  const {t} = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const containerWidth = width - insets.left - insets.right;
  const containerHeight = height - insets.top - insets.bottom;
  const frame = sceneFrame(containerWidth, containerHeight);
  const compact = height < 600;
  const charRect = characterRect(character, frame);
  if (compact) charRect.left += containerWidth * .62 - (frame.left + CHARACTER_PLACEMENT.centerX * frame.width);
  const petImage = petSource(pet);
  const petSize = PET_PLACEMENT.height * frame.height;

  return (
    <View
      className="bg-cream"
      style={{ flex: 1, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: insets.bottom }}
    >
      <View style={{ flex: 1 }}>
        <AtmosphereBackdrop frame={frame} atmosphere={atmosphere} />
        {petImage ? <PetMotion pet={pet as Exclude<PetKey, "none">} centerX={compact ? containerWidth * .49 : frame.left + PET_PLACEMENT.centerX * frame.width} floor={frame.top + PET_PLACEMENT.footY * frame.height} restHeight={petSize} atmosphere={atmosphere} /> : null}
        <Image
          source={CHARACTERS[character]}
          resizeMode="contain"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", left: charRect.left, top: charRect.top, width: charRect.width, height: charRect.height }}
        />
        {pet === "cat" && audio.listening ? <Pressable accessibilityRole="button" accessibilityLabel={t("atmosphere.petCat")} accessibilityHint={t("atmosphere.petCatHint")} onPress={audio.petCat} style={{position:"absolute",left:frame.left+PET_PLACEMENT.centerX*frame.width-Math.max(60,petSize),top:frame.top+PET_PLACEMENT.footY*frame.height-Math.max(48,petSize),width:Math.max(120,petSize*2),height:Math.max(48,petSize)}} /> : null}
        {children({ rect: (zone) => zoneRect(zone, frame), frame, night: (atmosphere.sun?.daylight ?? 1) < .55 })}
        <View style={{position:"absolute",left:compact ? containerWidth*.45 : frame.left+frame.width*.025,bottom:4,maxWidth:frame.width*.36}}><AtmosphereControls atmosphere={atmosphere} audio={audio}/></View>
      </View>
    </View>
  );
}
