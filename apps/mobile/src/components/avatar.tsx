import { View } from "react-native";

import AvatarAdultBeard from "../../../../packages/assets/avatars/avatar-adult-beard.svg";
import AvatarAdultGlasses from "../../../../packages/assets/avatars/avatar-adult-glasses.svg";
import AvatarAdultLong from "../../../../packages/assets/avatars/avatar-adult-long.svg";
import AvatarAdultShort from "../../../../packages/assets/avatars/avatar-adult-short.svg";
import AvatarAfro from "../../../../packages/assets/avatars/avatar-afro.svg";
import AvatarAstronaut from "../../../../packages/assets/avatars/avatar-astronaut.svg";
import AvatarBeanie from "../../../../packages/assets/avatars/avatar-beanie.svg";
import AvatarBraids from "../../../../packages/assets/avatars/avatar-braids.svg";
import AvatarBun from "../../../../packages/assets/avatars/avatar-bun.svg";
import AvatarCap from "../../../../packages/assets/avatars/avatar-cap.svg";
import AvatarCurly from "../../../../packages/assets/avatars/avatar-curly.svg";
import AvatarDefault from "../../../../packages/assets/avatars/avatar-default.svg";
import AvatarGlasses from "../../../../packages/assets/avatars/avatar-glasses.svg";
import AvatarHeadband from "../../../../packages/assets/avatars/avatar-headband.svg";
import AvatarHearingAid from "../../../../packages/assets/avatars/avatar-hearing-aid.svg";
import AvatarParentDefault from "../../../../packages/assets/avatars/avatar-parent-default.svg";
import AvatarSpiky from "../../../../packages/assets/avatars/avatar-spiky.svg";
import AvatarWavy from "../../../../packages/assets/avatars/avatar-wavy.svg";

const AVATARS = {
  "avatar-curly": AvatarCurly,
  "avatar-glasses": AvatarGlasses,
  "avatar-bun": AvatarBun,
  "avatar-spiky": AvatarSpiky,
  "avatar-braids": AvatarBraids,
  "avatar-cap": AvatarCap,
  "avatar-headband": AvatarHeadband,
  "avatar-wavy": AvatarWavy,
  "avatar-afro": AvatarAfro,
  "avatar-hearing-aid": AvatarHearingAid,
  "avatar-beanie": AvatarBeanie,
  "avatar-astronaut": AvatarAstronaut,
  "avatar-default": AvatarDefault,
  "avatar-parent-default": AvatarParentDefault,
  "avatar-adult-short": AvatarAdultShort,
  "avatar-adult-long": AvatarAdultLong,
  "avatar-adult-glasses": AvatarAdultGlasses,
  "avatar-adult-beard": AvatarAdultBeard,
} as const;

export type AvatarSlug = keyof typeof AVATARS;
export const CHILD_AVATAR_SLUGS = Object.keys(AVATARS).filter(
  (s) => !s.startsWith("avatar-adult") && s !== "avatar-parent-default",
) as AvatarSlug[];

export interface AvatarProps {
  slug: string | null | undefined;
  size?: number;
}

/** Codex avatar setinden bir avatar; bilinmeyen slug varsayılan silueti gösterir. */
export function Avatar({ slug, size = 64 }: AvatarProps) {
  const Svg = AVATARS[(slug ?? "avatar-default") as AvatarSlug] ?? AvatarDefault;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} />
    </View>
  );
}
