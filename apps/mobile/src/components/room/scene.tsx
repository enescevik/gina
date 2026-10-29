import type { ReactNode } from "react";
import { Image, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { sceneFrame, zoneRect, type SceneRect, type Zone } from "./layout";

const ROOM_BASE = require("../../../assets/room/room-base.webp");
const CHARACTERS = {
  unspecified: require("../../../assets/room/character-unspecified.webp"),
  girl: require("../../../assets/room/character-girl.webp"),
  boy: require("../../../assets/room/character-boy.webp"),
} as const;
export type CharacterKey = keyof typeof CHARACTERS;

export interface RoomSceneProps {
  character: CharacterKey;
  /** Bölge adı → gerçek RN içeriği; dekor erişilebilirlik ağacına girmez, içerik girer. */
  children: (helpers: { rect: (zone: Zone) => SceneRect }) => ReactNode;
}

/**
 * Katmanlı oda sahnesi: oda tabanı → karakter → gerçek metin/kontroller (children).
 * Sanat Image olarak contain-fit ile çizilir; hiçbir buton görselin içine gömülmez.
 */
export function RoomScene({ character, children }: RoomSceneProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const containerWidth = width - insets.left - insets.right;
  const containerHeight = height - insets.top - insets.bottom;
  const frame = sceneFrame(containerWidth, containerHeight);
  const characterRect = zoneRect([0.36, 0.45, 0.23, 0.4], frame);

  return (
    <View style={{ flex: 1, marginTop: insets.top, marginLeft: insets.left, marginRight: insets.right, marginBottom: insets.bottom }}>
      <Image
        source={ROOM_BASE}
        resizeMode="contain"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ position: "absolute", left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
      />
      <Image
        source={CHARACTERS[character]}
        resizeMode="contain"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ position: "absolute", left: characterRect.left, top: characterRect.top, width: characterRect.width, height: characterRect.height }}
      />
      {children({ rect: (zone) => zoneRect(zone, frame) })}
    </View>
  );
}
