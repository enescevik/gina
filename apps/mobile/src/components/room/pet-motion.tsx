import { Image } from "expo-image";
import { useState } from "react";
import { useReducedMotion } from "../collectible-motion";
import type { RoomAtmosphere } from "@/lib/use-room-atmosphere";
import manifest from "../../../../../packages/assets/rooms/v2/motion/manifest.json";

const sources = {
  cat: [require("../../../../../packages/assets/rooms/v2/motion/pet-cat-rest.webp"), require("../../../../../packages/assets/rooms/v2/motion/pet-cat-rest-poster.webp")],
  dog: [require("../../../../../packages/assets/rooms/v2/motion/pet-dog-rest.webp"), require("../../../../../packages/assets/rooms/v2/motion/pet-dog-rest-poster.webp")],
  monkey: [require("../../../../../packages/assets/rooms/v2/motion/pet-monkey-rest.webp"), require("../../../../../packages/assets/rooms/v2/motion/pet-monkey-rest-poster.webp")],
  lion: [require("../../../../../packages/assets/rooms/v2/motion/pet-lion-rest.webp"), require("../../../../../packages/assets/rooms/v2/motion/pet-lion-rest-poster.webp")],
};
/** The animation itself moves; the floor anchor and scale never animate. */
export function PetMotion({ pet, centerX, floor, restHeight, atmosphere, quiet = false }: {
  pet: keyof typeof sources; centerX: number; floor: number; restHeight: number;
  atmosphere: RoomAtmosphere; quiet?: boolean;
}) {
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState<string | null>(null);
  const moving = atmosphere.active && !quiet && !reduced && atmosphere.settings.data?.motion_enabled !== false && failed !== pet;
  const spec = manifest[pet];
  const scale = restHeight / spec.restHeight;
  return <Image key={`${pet}-${moving}`} source={sources[pet][moving ? 0 : 1]} contentFit="contain"
    autoplay={moving} useAppleWebpCodec={false} cachePolicy="disk" transition={0}
    onError={() => setFailed(pet)} accessible={false} pointerEvents="none"
    style={{ position: "absolute", left: centerX - spec.anchor[0]! * scale, top: floor - spec.anchor[1]! * scale, width: spec.width * scale, height: spec.height * scale }} />;
}
