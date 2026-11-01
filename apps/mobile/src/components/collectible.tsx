import { View, type ImageStyle, type StyleProp } from "react-native";

import { ILLUSTRATED_GAMIFICATION, isIllustratedGamificationSlug, type IllustratedGamificationSlug } from "@/generated/illustrated/gamification";

import SvgStarEmpty from "../../../../packages/assets/gamification/stars/star-empty.svg";
import SvgStarFilled from "../../../../packages/assets/gamification/stars/star-filled.svg";
import SvgStarHalf from "../../../../packages/assets/gamification/stars/star-half.svg";
import SvgStarJar from "../../../../packages/assets/gamification/stars/star-jar.svg";
import SvgStreak3 from "../../../../packages/assets/gamification/streaks/streak-3.svg";
import SvgStreak30 from "../../../../packages/assets/gamification/streaks/streak-30.svg";
import SvgStreak7 from "../../../../packages/assets/gamification/streaks/streak-7.svg";
import SvgStreakFlame from "../../../../packages/assets/gamification/streaks/streak-flame.svg";
import SvgBadgeBookworm from "../../../../packages/assets/gamification/badges/badge-bookworm.svg";
import SvgBadgeBronze from "../../../../packages/assets/gamification/badges/badge-bronze.svg";
import SvgBadgeDiamond from "../../../../packages/assets/gamification/badges/badge-diamond.svg";
import SvgBadgeEarlyBird from "../../../../packages/assets/gamification/badges/badge-early-bird.svg";
import SvgBadgeFirstTask from "../../../../packages/assets/gamification/badges/badge-first-task.svg";
import SvgBadgeGold from "../../../../packages/assets/gamification/badges/badge-gold.svg";
import SvgBadgeHelper from "../../../../packages/assets/gamification/badges/badge-helper.svg";
import SvgBadgeLocked from "../../../../packages/assets/gamification/badges/badge-locked.svg";
import SvgBadgeMathStar from "../../../../packages/assets/gamification/badges/badge-math-star.svg";
import SvgBadgeSilver from "../../../../packages/assets/gamification/badges/badge-silver.svg";
import SvgBadgeTidy from "../../../../packages/assets/gamification/badges/badge-tidy.svg";
import SvgBadgeWeekHero from "../../../../packages/assets/gamification/badges/badge-week-hero.svg";
import SvgStampApproved from "../../../../packages/assets/gamification/stamps/stamp-approved.svg";
import SvgStampPending from "../../../../packages/assets/gamification/stamps/stamp-pending.svg";
import SvgStampReturned from "../../../../packages/assets/gamification/stamps/stamp-returned.svg";
import SvgLoadingStarStatic from "../../../../packages/assets/gamification/loading/loading-star-static.svg";

import { IllustratedImage } from "./illustrated-image";

// Resimli v3 koleksiyon görselleri: scripts/generate-illustrated.mjs ile 256px üretilir
// (packages/assets/generated/illustrated-v3/gamification). Statik require eşlemesi: src/generated/illustrated/gamification.ts.
// 48 dp altı (ör. sayaç yanındaki yıldız) ayrıntılı görsel küçültülmez; eski native SVG gösterilir.
const SMALL_SVGS: Partial<Record<IllustratedGamificationSlug, typeof SvgStarFilled>> = {
  "star-empty": SvgStarEmpty,
  "star-filled": SvgStarFilled,
  "star-half": SvgStarHalf,
  "star-jar": SvgStarJar,
  "streak-3": SvgStreak3,
  "streak-30": SvgStreak30,
  "streak-7": SvgStreak7,
  "streak-flame": SvgStreakFlame,
  "badge-bookworm": SvgBadgeBookworm,
  "badge-bronze": SvgBadgeBronze,
  "badge-diamond": SvgBadgeDiamond,
  "badge-early-bird": SvgBadgeEarlyBird,
  "badge-first-task": SvgBadgeFirstTask,
  "badge-gold": SvgBadgeGold,
  "badge-helper": SvgBadgeHelper,
  "badge-locked": SvgBadgeLocked,
  "badge-math-star": SvgBadgeMathStar,
  "badge-silver": SvgBadgeSilver,
  "badge-tidy": SvgBadgeTidy,
  "badge-week-hero": SvgBadgeWeekHero,
  "stamp-approved": SvgStampApproved,
  "stamp-pending": SvgStampPending,
  "stamp-returned": SvgStampReturned,
  "loading-star-static": SvgLoadingStarStatic,
  // Diş bakımı rozetinin eski SVG'si yok; ilk görev rozeti küçük simge olarak kullanılır.
  "badge-tooth-care": SvgBadgeFirstTask,
};

export type CollectibleSlug = IllustratedGamificationSlug;

export function isCollectible(slug: string | null | undefined): slug is CollectibleSlug {
  return isIllustratedGamificationSlug(slug);
}

/** Kaynak görsel (animasyon bileşenleri aynı taban görseli kullanır). */
export function collectibleSource(slug: CollectibleSlug) {
  return ILLUSTRATED_GAMIFICATION[slug];
}

export interface CollectibleProps {
  slug: string | null | undefined;
  /** dp; varsayılan 64. Rozet için tercihen 96; premium raster artwork remains consistent at small sizes. */
  size?: number;
  variant?: "illustrated" | "symbol";
  /** Kilitli rozet: badge-locked görseli gösterilir. */
  locked?: boolean;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

/** Koleksiyon nesnesi (rozet, yıldız, seri, mühür). Bilinmeyen slug star-filled'a düşer. */
export function Collectible({ slug, size = 64, variant = "illustrated", locked, style, accessibilityLabel }: CollectibleProps) {
  // Ticket rewards may have paired art instead of a standalone icon (e.g. movie night).
  const paired = `${slug}-left`;
  const key: CollectibleSlug = locked ? "badge-locked" : isCollectible(slug) ? slug : isCollectible(paired) ? paired : "star-filled";
  if (variant === "symbol") {
    const Svg = SMALL_SVGS[key] ?? SvgStarFilled;
    return (
      <View
        style={[{ width: size, height: size }, style as StyleProp<ImageStyle>]}
        accessible={!!accessibilityLabel}
        accessibilityLabel={accessibilityLabel}
        importantForAccessibility={accessibilityLabel ? "auto" : "no-hide-descendants"}
      >
        <Svg width={size} height={size} />
      </View>
    );
  }
  return <IllustratedImage source={ILLUSTRATED_GAMIFICATION[key]} size={size} style={style} accessibilityLabel={accessibilityLabel} />;
}
