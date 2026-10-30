import { Image, type ImageSourcePropType, type ImageStyle, type StyleProp } from "react-native";

/**
 * Resimli v3 boyut kuralı (docs/design/room-v2/CLAUDE-PROMPT.md):
 * - Resimli nesne en az 64 dp önerilir; ayrıntılı rozet tercihen 96 dp.
 * - Ayrıntılı görsel 48 dp altına asla küçültülmez; küçük gezinme/aksiyon simgesi native SVG kalır.
 */
export const ILLUSTRATED_MIN_DP = 48;
/** `variant="auto"` bu boyuttan itibaren resimli görseli seçer. */
export const ILLUSTRATED_AUTO_DP = 64;

/** İkon bileşenlerinin ortak görünüm seçimi: auto = boyuta göre, svg = her zaman native, illustrated = ≥48 dp ise resim. */
export type IconVariant = "auto" | "svg" | "illustrated";

/**
 * Resim mi SVG mi? `hasSvg` false ise (yalnız resimli kaynağı olan slug) auto modda 48 dp'den itibaren resim seçilir,
 * böylece yeni slug'lar orta boyutta genel simgeye düşmez.
 */
export function shouldUseIllustrated(variant: IconVariant, size: number, hasIllustrated: boolean, hasSvg = true): boolean {
  if (!hasIllustrated || variant === "svg" || size < ILLUSTRATED_MIN_DP) return false;
  if (variant === "illustrated") return true;
  return size >= ILLUSTRATED_AUTO_DP || !hasSvg;
}

export interface IllustratedImageProps {
  source: ImageSourcePropType;
  size: number;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

/** Şeffaf WebP; oran korunur (contain). Etiket yoksa dekoratiftir ve ekran okuyucudan gizlenir. */
export function IllustratedImage({ source, size, style, accessibilityLabel }: IllustratedImageProps) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? "auto" : "no-hide-descendants"}
      style={[{ width: size, height: size }, style]}
    />
  );
}
