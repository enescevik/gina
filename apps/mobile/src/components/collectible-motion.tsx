import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import recipe from "../../../../packages/assets/gamification/illustrated-v3/animations.json";

import { collectibleSource, isCollectible, type CollectibleSlug } from "./collectible";
import { ILLUSTRATED_MIN_DP } from "./illustrated-image";

// animations.json: 6 kutlama + 8 yükleme durumu ayrı kare değil, AYNI taban görselin native scale/rotate/opacity dönüşümüdür.
// Tarif kaynaktan okunur (tek doğruluk kaynağı); Animated + useNativeDriver ile UI thread'de çalışır.

/** "stars/star-filled.webp" → "star-filled"; manifestte yoksa güvenli varsayılan. */
function assetSlug(path: string, fallback: CollectibleSlug): CollectibleSlug {
  const slug = path.split("/").pop()?.replace(/\.webp$/, "");
  return isCollectible(slug) ? slug : fallback;
}

/** Sistem "hareketi azalt" ayarı; açıkken animasyon yerine sabit görsel gösterilir. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Decorative motion stops when its route is hidden or the app goes to background. */
function useMotionActive() {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => sub.remove();
  }, []);
  return focused && active;
}

const clampSize = (size: number) => Math.max(ILLUSTRATED_MIN_DP, size);

const burst = recipe.star_burst;
const burstOffsets = burst.frames.map((f) => f.offset);
const BURST_SLUG = assetSlug(burst.asset, "star-filled");

export interface CelebrationBurstProps {
  /** dp (en az 48; önerilen 96–128). */
  size?: number;
  /** Taban görsel; varsayılan tarifteki dolu yıldız. */
  slug?: CollectibleSlug;
  /** Tek seferlik oynatma bitince (reduced motion'da aynı süre sonra) çağrılır. */
  onFinish?: () => void;
  accessibilityLabel?: string;
}

/** Kutlama: star_burst tarifi (scale 0.7→1.12→1, opacity 0→1→0) + 8 native parıltı. Döngü yok, tek sefer. */
export function CelebrationBurst({ size = 120, slug = BURST_SLUG, onFinish, accessibilityLabel }: CelebrationBurstProps) {
  const s = clampSize(size);
  const reduced = useReducedMotion();
  const motionActive = useMotionActive();
  // useState: Animated.Value tek kez oluşur ve render sırasında okunabilir (ref değil).
  const [progress] = useState(() => new Animated.Value(0));
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (!motionActive) return;
    if (reduced) {
      // Hareket yok: sabit görsel gösterilir, akış aynı sürede devam eder.
      const timer = setTimeout(() => finishRef.current?.(), burst.duration_ms);
      return () => clearTimeout(timer);
    }
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: burst.duration_ms,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => finished && finishRef.current?.());
    return () => anim.stop();
  }, [reduced, progress, motionActive]);

  const image = <Animated.Image source={collectibleSource(slug)} resizeMode="contain" style={{ width: s, height: s }} />;

  if (reduced) {
    return (
      <View style={{ width: s, height: s }} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel} pointerEvents="none">
        {image}
      </View>
    );
  }

  const scale = progress.interpolate({ inputRange: burstOffsets, outputRange: burst.frames.map((f) => f.scale) });
  const opacity = progress.interpolate({ inputRange: burstOffsets, outputRange: burst.frames.map((f) => f.opacity) });
  const [r0, r1] = burst.sparkles.radius_dp;
  const sparkleOpacity = progress.interpolate({
    inputRange: burst.sparkles.opacity.map((_, i, a) => i / (a.length - 1)),
    outputRange: burst.sparkles.opacity,
  });
  const radius = progress.interpolate({ inputRange: [0, 1], outputRange: [r0, r1] });
  const sparkle = Math.max(8, Math.round(s * 0.12));
  const box = s + r1 * 2;

  return (
    <View
      style={{ width: box, height: box, alignItems: "center", justifyContent: "center" }}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      pointerEvents="none"
    >
      <Animated.View style={{ opacity, transform: [{ scale }] }}>{image}</Animated.View>
      {Array.from({ length: burst.sparkles.count }, (_, i) => {
        const angle = (i / burst.sparkles.count) * Math.PI * 2;
        // Parıltı, görselin kenarından dışa doğru radius_dp kadar açılır.
        const edge = s / 2;
        return (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              opacity: sparkleOpacity,
              transform: [
                { translateX: Animated.multiply(Animated.add(radius, edge), Math.cos(angle)) },
                { translateY: Animated.multiply(Animated.add(radius, edge), Math.sin(angle)) },
              ],
            }}
          >
            <Svg width={sparkle} height={sparkle} viewBox="0 0 24 24">
              <Path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill={burst.sparkles.color} />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
}

const loading = recipe.loading;
const LOADING_SLUG = assetSlug(loading.asset, "loading-star-static");
const REDUCED_SLUG = assetSlug(recipe.reduced_motion, "loading-star-static");

export interface LoadingStarProps {
  size?: number;
  /** Ekran okuyucu için i18n metni (ör. t("common.loading")). */
  accessibilityLabel?: string;
}

/**
 * Yükleme: 8 durum (0°→315°, 45° adım) aynı görselin 1200 ms'de 360° dönüşü. Yalnız görünürken ve uygulama
 * ön plandayken döner (stop_when_hidden); bileşen kalkınca durur. Dekor değil, işlevsel bekleme göstergesi.
 * Reduced motion: sabit yıldız.
 */
export function LoadingStar({ size = 64, accessibilityLabel }: LoadingStarProps) {
  const s = clampSize(size);
  const reduced = useReducedMotion();
  const motionActive = useMotionActive();
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced || !motionActive) return;
    spin.setValue(0);
    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: loading.duration_ms, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [reduced, motionActive, spin]);

  const a11y = {
    accessible: true,
    accessibilityRole: "progressbar" as const,
    accessibilityLabel,
    accessibilityState: { busy: true },
  };

  if (reduced) {
    return (
      <View {...a11y}>
        <Animated.Image source={collectibleSource(REDUCED_SLUG)} resizeMode="contain" style={{ width: s, height: s }} />
      </View>
    );
  }

  const offsets = [...loading.frames.map((f) => f.offset), 1];
  const rotate = spin.interpolate({
    inputRange: offsets,
    outputRange: [...loading.frames.map((f) => `${f.rotate}deg`), `${loading.end_rotate}deg`],
  });

  return (
    <View {...a11y}>
      <Animated.Image
        source={collectibleSource(LOADING_SLUG)}
        resizeMode="contain"
        style={{ width: s, height: s, transform: [{ rotate }] }}
      />
    </View>
  );
}
