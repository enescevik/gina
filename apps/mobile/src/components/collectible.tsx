import { Image, type ImageStyle, type StyleProp } from "react-native";

// Resimli v3 koleksiyon görselleri (scripts/generate-collectibles.mjs ile 256px üretildi).
// Statik require: Metro yalnız referans verilen görselleri paketler.
const COLLECTIBLES = {
  "star-filled": require("../../assets/collectibles/star-filled.webp"),
  "star-empty": require("../../assets/collectibles/star-empty.webp"),
  "star-half": require("../../assets/collectibles/star-half.webp"),
  "star-jar": require("../../assets/collectibles/star-jar.webp"),
  "streak-flame": require("../../assets/collectibles/streak-flame.webp"),
  "streak-3": require("../../assets/collectibles/streak-3.webp"),
  "streak-7": require("../../assets/collectibles/streak-7.webp"),
  "streak-30": require("../../assets/collectibles/streak-30.webp"),
  "badge-bronze": require("../../assets/collectibles/badge-bronze.webp"),
  "badge-silver": require("../../assets/collectibles/badge-silver.webp"),
  "badge-gold": require("../../assets/collectibles/badge-gold.webp"),
  "badge-diamond": require("../../assets/collectibles/badge-diamond.webp"),
  "badge-first-task": require("../../assets/collectibles/badge-first-task.webp"),
  "badge-bookworm": require("../../assets/collectibles/badge-bookworm.webp"),
  "badge-early-bird": require("../../assets/collectibles/badge-early-bird.webp"),
  "badge-tidy": require("../../assets/collectibles/badge-tidy.webp"),
  "badge-helper": require("../../assets/collectibles/badge-helper.webp"),
  "badge-math-star": require("../../assets/collectibles/badge-math-star.webp"),
  "badge-week-hero": require("../../assets/collectibles/badge-week-hero.webp"),
  "badge-locked": require("../../assets/collectibles/badge-locked.webp"),
  "badge-tooth-care": require("../../assets/collectibles/badge-tooth-care.webp"),
  "stamp-approved": require("../../assets/collectibles/stamp-approved.webp"),
  "stamp-pending": require("../../assets/collectibles/stamp-pending.webp"),
  "stamp-returned": require("../../assets/collectibles/stamp-returned.webp"),
  "loading-star-static": require("../../assets/collectibles/loading-star-static.webp"),
} as const;

export type CollectibleSlug = keyof typeof COLLECTIBLES;

export function isCollectible(slug: string | null | undefined): slug is CollectibleSlug {
  return !!slug && slug in COLLECTIBLES;
}

export interface CollectibleProps {
  slug: string | null | undefined;
  size?: number;
  /** Kilitli rozet: badge-locked görseli gösterilir. */
  locked?: boolean;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

/** Koleksiyon nesnesi (rozet, yıldız, seri, mühür). 24 px simge olarak kullanılmaz (README); en az 48 dp. */
export function Collectible({ slug, size = 64, locked, style, accessibilityLabel }: CollectibleProps) {
  const key: CollectibleSlug = locked ? "badge-locked" : isCollectible(slug) ? slug : "star-filled";
  return (
    <Image
      source={COLLECTIBLES[key]}
      resizeMode="contain"
      accessibilityLabel={accessibilityLabel}
      accessible={!!accessibilityLabel}
      style={[{ width: size, height: size }, style]}
    />
  );
}
