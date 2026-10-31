import { useEffect, useId } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Line,
  Path,
  Rect,
} from "react-native-svg";
import { useReducedMotion } from "../collectible-motion";
import type { RoomAtmosphere } from "@/lib/use-room-atmosphere";
import type { SceneRect } from "./layout";

const PLATES = {
  home: {
    day: require("../../../../../packages/assets/rooms/v2/room-home-v5.webp"),
    overcast: require("../../../../../packages/assets/rooms/v2/atmosphere/room-overcast.webp"),
    night: require("../../../../../packages/assets/rooms/v2/atmosphere/room-night.webp"),
    golden: require("../../../../../packages/assets/rooms/v2/atmosphere/room-golden.webp"),
  },
  study: {
    day: require("../../../../../packages/assets/rooms/v2/room-study-v5.webp"),
    overcast: require("../../../../../packages/assets/rooms/v2/atmosphere/study-overcast.webp"),
    night: require("../../../../../packages/assets/rooms/v2/atmosphere/study-night.webp"),
    golden: require("../../../../../packages/assets/rooms/v2/atmosphere/study-golden.webp"),
  },
};
const CLOUD = require("../../../../../packages/assets/rooms/v2/atmosphere/cloud-bank.webp");
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedSvgImage = Animated.createAnimatedComponent(SvgImage);
// Clip paths are runtime scene geometry, not deliverable SVG image assets. Bookshelf and curtains occlude weather.
const WINDOWS = {
  home: {
    path: "M720 25L855 45V342H836V384H720Z",
    x: 720,
    y: 25,
    width: 135,
    height: 359,
  },
  study: {
    path: "M1102 0H1266V397H1102Z",
    x: 1102,
    y: 0,
    width: 164,
    height: 397,
  },
};
type Pane = typeof WINDOWS.home;
function Drop({
  clock,
  index,
  pane,
  snow,
  wind,
}: {
  clock: SharedValue<number>;
  index: number;
  pane: Pane;
  snow: boolean;
  wind: number;
}) {
  const duration = snow ? [8, 10, 12][index % 3]! : [1, 1.5, 2][index % 3]!;
  const phase = ((index * 73) % 101) / 101;
  const seed = ((index * 47) % 113) / 113;
  const radius = 1.3 + (index % 3) * 0.65;
  const props = useAnimatedProps<{
    cx?: number;
    cy?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }>(() => {
    const progress = (clock.value / duration + phase) % 1;
    const y = pane.y - 24 + progress * (pane.height + 48);
    const drift =
      wind * progress + (snow ? Math.sin(clock.value * 0.8 + index) * 5 : 0);
    const x =
      pane.x -
      24 +
      ((seed * (pane.width + 48) + drift + 500) % (pane.width + 48));
    return snow
      ? { cx: x, cy: y }
      : { x1: x, y1: y, x2: x + wind / 20, y2: y + 10 + (index % 7) };
  });
  return snow ? (
    <AnimatedCircle
      animatedProps={props}
      r={radius}
      fill="#F8FBFF"
      opacity={0.4 + (index % 4) * 0.13}
    />
  ) : (
    <AnimatedLine
      animatedProps={props}
      stroke="#E4F5FE"
      strokeWidth={0.7 + (index % 3) * 0.3}
      strokeLinecap="round"
      opacity={0.25 + (index % 4) * 0.1}
    />
  );
}
function Cloud({
  clock,
  pane,
  opacity,
  wind,
  tile,
}: {
  clock: SharedValue<number>;
  pane: Pane;
  opacity: number;
  wind: number;
  tile: number;
}) {
  const props = useAnimatedProps(() => ({
    // Two adjacent copies make the clock wrap visually seamless in either wind direction.
    x: pane.x - (wind < 0 ? 0 : 400) + tile * 400 + clock.value / 120 * 400 * (wind < 0 ? -1 : 1),
  }));
  return (
    <AnimatedSvgImage
      href={CLOUD}
      animatedProps={props}
      y={pane.y + 8}
      width={400}
      height={130}
      opacity={opacity}
    />
  );
}
/** Native UI-thread motion; one shared clock, no React state updates per frame. */
export function AtmosphereBackdrop({
  frame,
  mode = "home",
  atmosphere,
  quiet = false,
}: {
  frame: SceneRect;
  mode?: keyof typeof PLATES;
  atmosphere: RoomAtmosphere;
  quiet?: boolean;
}) {
  const reduced = useReducedMotion();
  const { sun, weather, active, settings } = atmosphere;
  const moving =
    active && !quiet && !reduced && settings.data?.motion_enabled !== false;
  const clock = useSharedValue(0);
  const night = useSharedValue(0),
    golden = useSharedValue(0),
    daylight = useSharedValue(0);
  const hour = weather.hour;
  const pane = WINDOWS[mode];
  const clip = `window-${useId().replace(/:/g, "")}`;
  const wind = hour
    ? -Math.sin((hour.windFrom * Math.PI) / 180) *
      Math.min(60, hour.windSpeed * 5)
    : 0;
  const snow = hour?.kind === "snow",
    sleet = hour?.kind === "sleet";
  const wet = hour && ["rain", "sleet", "thunder"].includes(hour.kind);
  const count =
    snow || sleet
      ? 26
      : wet
        ? Math.min(40, 18 + Math.round(hour.precipitation * 3))
        : 0;
  const nightTarget = sun ? 1 - sun.daylight : 0;
  const goldenTarget = sun ? sun.golden * (1 - (hour?.cloud ?? 0.3) * 0.65) : 0;
  // A chosen city with missing weather still has known solar time; cloud/rain/snow remain unknown.
  const dayTarget = hour
    ? (1 - hour.cloud) * (sun?.daylight ?? 1)
    : sun
      ? 0
      : 1;
  useEffect(() => {
    if (!moving) {
      cancelAnimation(clock);
      return;
    }
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(120, { duration: 120000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(clock);
  }, [clock, moving]);
  useEffect(() => {
    const duration = moving ? 2400 : 0;
    night.value = withTiming(nightTarget, { duration });
    golden.value = withTiming(goldenTarget, { duration });
    daylight.value = withTiming(dayTarget, { duration });
    return () => {
      cancelAnimation(night);
      cancelAnimation(golden);
      cancelAnimation(daylight);
    };
  }, [night, golden, daylight, nightTarget, goldenTarget, dayTarget, moving]);
  const nightStyle = useAnimatedStyle(() => ({ opacity: night.value }));
  const goldenStyle = useAnimatedStyle(() => ({ opacity: golden.value }));
  const dayStyle = useAnimatedStyle(() => ({ opacity: daylight.value }));
  return (
    <View
      testID={`atmosphere-${mode}`}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", ...frame }}
    >
      <Image
        source={PLATES[mode].overcast}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
        resizeMode="stretch"
      />
      <Animated.Image
        source={PLATES[mode].day}
        style={[
          StyleSheet.absoluteFill,
          { width: "100%", height: "100%" },
          dayStyle,
        ]}
        resizeMode="stretch"
      />
      <Animated.Image
        source={PLATES[mode].golden}
        style={[
          StyleSheet.absoluteFill,
          { width: "100%", height: "100%" },
          goldenStyle,
        ]}
        resizeMode="stretch"
      />
      <Animated.Image
        source={PLATES[mode].night}
        style={[
          StyleSheet.absoluteFill,
          { width: "100%", height: "100%" },
          nightStyle,
        ]}
        resizeMode="stretch"
      />
      {hour ? (
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 1586 992"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <ClipPath id={clip}>
              <Path d={pane.path} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clip})`}>
            {hour.cloud > 0.1 ? (
              <G>{[0, 1].map(tile => (
                <Cloud key={tile} tile={tile} clock={clock} pane={pane} wind={wind}
                  opacity={hour.cloud * 0.4 * (1 - nightTarget * 0.8)} />
              ))}</G>
            ) : null}
            {hour.kind === "fog" ? (
              <Rect
                x={pane.x}
                y={pane.y}
                width={pane.width}
                height={pane.height}
                fill="#DEE9E7"
                opacity={0.48}
              />
            ) : null}
            {Array.from({ length: count }, (_, index) => (
              <Drop
                key={index}
                clock={clock}
                index={index}
                pane={pane}
                snow={snow || (sleet && index % 2 === 0)}
                wind={wind}
              />
            ))}
          </G>
        </Svg>
      ) : null}
    </View>
  );
}
