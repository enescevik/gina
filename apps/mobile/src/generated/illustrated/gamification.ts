// OTOMATİK ÜRETİLDİ: node scripts/generate-illustrated.mjs — elle düzenleme.
// Kaynak: packages/assets/gamification/illustrated-v3/manifest.json (54 slug, 256px WebP).

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
  "reward-book": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-book.webp"),
  "reward-choose-dinner": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-choose-dinner.webp"),
  "reward-ice-cream": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-ice-cream.webp"),
  "reward-late-bedtime": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-late-bedtime.webp"),
  "reward-movie-night-left": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-movie-night-left.webp"),
  "reward-movie-night-right": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-movie-night-right.webp"),
  "reward-mystery-box": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-mystery-box.webp"),
  "reward-park": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-park.webp"),
  "reward-pizza": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-pizza.webp"),
  "reward-pocket-money": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-pocket-money.webp"),
  "reward-screen-time": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-screen-time.webp"),
  "reward-sleepover": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-sleepover.webp"),
  "reward-toy": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-toy.webp"),
  "display-bookworm": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-bookworm.webp"),
  "display-bronze": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-bronze.webp"),
  "display-diamond": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-diamond.webp"),
  "display-early-bird": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-early-bird.webp"),
  "display-first-task": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-first-task.webp"),
  "display-gold": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-gold.webp"),
  "display-math-star": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-math-star.webp"),
  "display-silver": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-silver.webp"),
  "reward-bike-ride": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-bike-ride.webp"),
  "reward-game-with-parent": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-game-with-parent.webp"),
  "reward-sticker": require("../../../../../packages/assets/generated/illustrated-v3/gamification/reward-sticker.webp"),
  "display-helper": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-helper.webp"),
  "display-locked": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-locked.webp"),
  "display-tidy": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-tidy.webp"),
  "display-tooth-care": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-tooth-care.webp"),
  "display-week-hero": require("../../../../../packages/assets/generated/illustrated-v3/gamification/display-week-hero.webp"),
} as const;

export type IllustratedGamificationSlug = keyof typeof ILLUSTRATED_GAMIFICATION;

export const ILLUSTRATED_GAMIFICATION_SLUGS = Object.keys(ILLUSTRATED_GAMIFICATION) as IllustratedGamificationSlug[];

export function isIllustratedGamificationSlug(slug: string | null | undefined): slug is IllustratedGamificationSlug {
  return !!slug && Object.prototype.hasOwnProperty.call(ILLUSTRATED_GAMIFICATION, slug);
}
