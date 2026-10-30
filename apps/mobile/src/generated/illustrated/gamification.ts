// OTOMATİK ÜRETİLDİ: node scripts/generate-illustrated.mjs — elle düzenleme.
// Kaynak: packages/assets/gamification/illustrated-v3/manifest.json (25 slug, 256px WebP).

export const ILLUSTRATED_GAMIFICATION = {
  "star-filled": require("../../../../../packages/assets/generated/illustrated-v3/gamification/star-filled.webp"),
  "star-empty": require("../../../../../packages/assets/generated/illustrated-v3/gamification/star-empty.webp"),
  "star-half": require("../../../../../packages/assets/generated/illustrated-v3/gamification/star-half.webp"),
  "star-jar": require("../../../../../packages/assets/generated/illustrated-v3/gamification/star-jar.webp"),
  "streak-flame": require("../../../../../packages/assets/generated/illustrated-v3/gamification/streak-flame.webp"),
  "streak-3": require("../../../../../packages/assets/generated/illustrated-v3/gamification/streak-3.webp"),
  "streak-7": require("../../../../../packages/assets/generated/illustrated-v3/gamification/streak-7.webp"),
  "streak-30": require("../../../../../packages/assets/generated/illustrated-v3/gamification/streak-30.webp"),
  "badge-bronze": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-bronze.webp"),
  "badge-silver": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-silver.webp"),
  "badge-gold": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-gold.webp"),
  "badge-diamond": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-diamond.webp"),
  "badge-first-task": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-first-task.webp"),
  "badge-bookworm": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-bookworm.webp"),
  "badge-early-bird": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-early-bird.webp"),
  "badge-tidy": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-tidy.webp"),
  "badge-helper": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-helper.webp"),
  "badge-math-star": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-math-star.webp"),
  "badge-week-hero": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-week-hero.webp"),
  "badge-locked": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-locked.webp"),
  "badge-tooth-care": require("../../../../../packages/assets/generated/illustrated-v3/gamification/badge-tooth-care.webp"),
  "stamp-approved": require("../../../../../packages/assets/generated/illustrated-v3/gamification/stamp-approved.webp"),
  "stamp-pending": require("../../../../../packages/assets/generated/illustrated-v3/gamification/stamp-pending.webp"),
  "stamp-returned": require("../../../../../packages/assets/generated/illustrated-v3/gamification/stamp-returned.webp"),
  "loading-star-static": require("../../../../../packages/assets/generated/illustrated-v3/gamification/loading-star-static.webp"),
} as const;

export type IllustratedGamificationSlug = keyof typeof ILLUSTRATED_GAMIFICATION;

export const ILLUSTRATED_GAMIFICATION_SLUGS = Object.keys(ILLUSTRATED_GAMIFICATION) as IllustratedGamificationSlug[];

export function isIllustratedGamificationSlug(slug: string | null | undefined): slug is IllustratedGamificationSlug {
  return !!slug && Object.prototype.hasOwnProperty.call(ILLUSTRATED_GAMIFICATION, slug);
}
