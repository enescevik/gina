// OTOMATİK ÜRETİLDİ: node scripts/generate-illustrated.mjs — elle düzenleme.
// Kaynak: packages/assets/avatars/illustrated-v3/manifest.json (20 slug, 256px WebP).

export const ILLUSTRATED_AVATARS = {
  "avatar-spiky": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-spiky.webp"),
  "avatar-adult-beard": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-adult-beard.webp"),
  "avatar-adult-glasses": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-adult-glasses.webp"),
  "avatar-adult-long": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-adult-long.webp"),
  "avatar-adult-short": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-adult-short.webp"),
  "avatar-afro": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-afro.webp"),
  "avatar-astronaut": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-astronaut.webp"),
  "avatar-beanie": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-beanie.webp"),
  "avatar-braids": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-braids.webp"),
  "avatar-bun": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-bun.webp"),
  "avatar-cap": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-cap.webp"),
  "avatar-curly": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-curly.webp"),
  "avatar-default": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-default.webp"),
  "avatar-glasses": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-glasses.webp"),
  "avatar-headband": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-headband.webp"),
  "avatar-hearing-aid": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-hearing-aid.webp"),
  "avatar-parent-default": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-parent-default.webp"),
  "avatar-reference-boy": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-reference-boy.webp"),
  "avatar-reference-girl": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-reference-girl.webp"),
  "avatar-wavy": require("../../../../../packages/assets/generated/illustrated-v3/avatars/avatar-wavy.webp"),
} as const;

export type IllustratedAvatarsSlug = keyof typeof ILLUSTRATED_AVATARS;

export const ILLUSTRATED_AVATARS_SLUGS = Object.keys(ILLUSTRATED_AVATARS) as IllustratedAvatarsSlug[];

export function isIllustratedAvatarsSlug(slug: string | null | undefined): slug is IllustratedAvatarsSlug {
  return !!slug && Object.prototype.hasOwnProperty.call(ILLUSTRATED_AVATARS, slug);
}
