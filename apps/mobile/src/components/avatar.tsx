import { Image, View } from "react-native";
import { ILLUSTRATED_AVATARS } from "@/generated/illustrated/avatars";
export type AvatarSlug = keyof typeof ILLUSTRATED_AVATARS;
export const CHILD_AVATAR_SLUGS = Object.keys(ILLUSTRATED_AVATARS).filter(s => !s.startsWith("avatar-adult") && s !== "avatar-parent-default") as AvatarSlug[];
export interface AvatarProps { slug: string | null | undefined; size?: number }
/** Painted portraits use the same approved family as the room characters. */
export function Avatar({ slug, size = 64 }: AvatarProps) {
  const source = ILLUSTRATED_AVATARS[(slug ?? "avatar-default") as AvatarSlug] ?? ILLUSTRATED_AVATARS["avatar-default"];
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#F4EBD9", overflow: "hidden" }}>
    <Image source={source} resizeMode="contain" accessible={false} style={{ width: size, height: size }} />
  </View>;
}
