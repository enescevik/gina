import type { ReactNode } from "react";
import {
  Image,
  PixelRatio,
  Pressable,
  View,
  type DimensionValue,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { SkinBackground, skinPx as px } from "./skin-background";
import { skinSpec, type SkinSlug } from "./skins";

const pct = (n: number) => `${n * 100}%` as DimensionValue;

/*
 * Gerçek 9-slice kaplama (manifest sözleşmesi, docs/design/room-v2/references/preview-note.md):
 * - Köşeler sabit, kenarlar ve orta esner; `horizontal` kaplamada yükseklik korunur (3 parça).
 * - Dekor katmanı platforma göre ayrılır (skin-background.tsx / .web.tsx):
 *   iOS/Android: dokuz overflow:hidden parça + yüzdeyle kaydırılmış tam PNG (Yoga piksel ızgarasına yuvarlar);
 *   web: tarayıcının yerel 9-slice'ı CSS border-image (kesirli konumda bile parça dikişi yok).
 * - İçerik contentInsets (@3x px → dp: /pixelRatio) içinde native yerleşir.
 */

export interface NineSliceProps {
  skin: SkinSlug;
  /** Tekdüze yoğunluk çarpanı (köşe/cap/iç boşluk birlikte); oran bozulmaz. Varsayılan 1. */
  scale?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
  contentStyle?: StyleProp<ViewStyle>;
  contentClassName?: string;
  children?: ReactNode;
}

/** Esneyen kaplama + contentInsets içinde native içerik. */
export function NineSlice({ skin, scale = 1, style, className, contentStyle, contentClassName, children }: NineSliceProps) {
  const spec = skinSpec(skin);
  const ci = spec.contentInsets;
  const min = spec.minimumLogicalSize;
  const sizing: ViewStyle =
    spec.stretch === "horizontal"
      ? { height: PixelRatio.roundToNearestPixel(spec.height * scale), minWidth: (min?.width ?? 0) * scale }
      : { minWidth: (min?.width ?? 0) * scale, minHeight: (min?.height ?? 0) * scale };
  return (
    <View style={[sizing, style]} className={className}>
      <SkinBackground spec={spec} scale={scale} />
      <View
        style={[
          {
            flexGrow: 1,
            paddingTop: px(ci.top, spec, scale),
            paddingLeft: px(ci.left, spec, scale),
            paddingBottom: px(ci.bottom, spec, scale),
            paddingRight: px(ci.right, spec, scale),
          },
          contentStyle,
        ]}
        className={contentClassName}
      >
        {children}
      </View>
    </View>
  );
}

/** Esnemeyen (stretch:none) kaplama: durum rozetleri, noktalar, gün hücreleri. Tekdüze boyut. */
export function SkinIcon({ skin, size }: { skin: SkinSlug; size?: number }) {
  const spec = skinSpec(skin);
  const w = size ?? spec.width;
  const h = (w / spec.width) * spec.height;
  return (
    <Image
      source={spec.source}
      resizeMode="stretch"
      fadeDuration={0}
      accessible={false}
      importantForAccessibility="no"
      style={{ width: w, height: h }}
    />
  );
}

export interface SkinPressableProps extends Omit<PressableProps, "children" | "style"> {
  skin: SkinSlug;
  pressedSkin?: SkinSlug;
  /** Yalnız görsel; etkileşimi `disabled` ayrıca kapatır. */
  disabledSkin?: SkinSlug;
  scale?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  contentClassName?: string;
  children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
}

/** Basılı/pasif durumda aynı geometrili kaynağa geçen dokunulabilir kaplama (içerik zıplamaz). */
export function SkinPressable({
  skin,
  pressedSkin,
  disabledSkin,
  scale,
  style,
  contentStyle,
  contentClassName,
  children,
  disabled,
  ...rest
}: SkinPressableProps) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{ disabled: !!disabled }} style={[{ minHeight: 48 }, style]} {...rest}>
      {({ pressed }) => (
        <NineSlice
          skin={disabled && disabledSkin ? disabledSkin : pressed && pressedSkin ? pressedSkin : skin}
          scale={scale}
          style={{ flexGrow: 1 }}
          contentStyle={contentStyle}
          contentClassName={contentClassName}
        >
          {typeof children === "function" ? children({ pressed }) : children}
        </NineSlice>
      )}
    </Pressable>
  );
}

/**
 * Hedef ilerlemesi: track kaplaması + dolgu kapsülü native clip ile gerçek yüzdeye kesilir.
 * %0'da dolgu hiç çizilmez; düşük yüzdede minimum kapsül çizilip ilerleme abartılmaz.
 */
export function SkinProgress({ value, scale = 1, style, track = "progress-bar-track", fill = "progress-bar-fill" }: { value: number; scale?: number; style?: StyleProp<ViewStyle>; track?: SkinSlug; fill?: SkinSlug }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={style} accessible={false} importantForAccessibility="no-hide-descendants">
      <NineSlice skin={track} scale={scale} />
      {clamped > 0 ? (
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct(clamped), overflow: "hidden" }}>
          <NineSlice skin={fill} scale={scale} style={{ position: "absolute", left: 0, top: 0, width: pct(1 / clamped) }} />
        </View>
      ) : null}
    </View>
  );
}
