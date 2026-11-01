import { useId, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Pressable } from "@/components/ui/pressable";
export const p = {
  cream: "#FCFAF6",
  ink: "#201951",
  muted: "#625C85",
  purple: "#6042DE",
  mint: "#C0EFDF",
  line: "#EEE8EF",
  lilac: "#EEE8FA",
};
export function SatinButton({
  title,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
  icon,
  style,
  selected,
}: {
  title: string;
  onPress: () => void;
  selected?: boolean;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy, selected }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        u.button,
        {
          backgroundColor: secondary ? p.lilac : p.purple,
          borderColor: secondary ? "#E4DCF4" : "#5032BE",
          transform: [{ translateY: pressed ? 2 : 0 }],
          opacity: disabled ? 0.5 : 1,
          boxShadow: secondary
            ? "none"
            : pressed
              ? "0 1px 2px #38216B20"
              : "0 5px 12px #38216B20",
        },
        style,
      ]}
    >
      {!secondary && !disabled ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg accessible={false} width="100%" height="100%">
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#8A64FF" />
                <Stop offset="30%" stopColor="#7147ED" />
                <Stop offset="1" stopColor="#5132BD" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" rx="19" fill={`url(#${id})`} />
          </Svg>
        </View>
      ) : null}
      {busy || icon ? (
        <View style={{ position: "relative", zIndex: 1 }}>
          {busy ? (
            <ActivityIndicator color={secondary ? p.purple : "#fff"} />
          ) : (
            icon
          )}
        </View>
      ) : null}
      <Text
        style={[
          u.bold,
          {
            fontSize: 17,
            color: secondary ? p.purple : "#fff",
            textAlign: "center",
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  onPress,
  children,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        u.iconButton,
        { opacity: disabled ? 0.4 : pressed ? 0.65 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}
export function PlannerHero({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={u.hero}>
      <View style={u.heroCopy}>
        <Text accessibilityRole="header" style={u.title}>
          {title}
        </Text>
        <Text style={u.copy}>{subtitle}</Text>
      </View>
      <View accessible={false} pointerEvents="none" style={u.heroArt}>
        <View style={u.blob} />
        <Image
          source={require("../../../../../packages/assets/brand/growing-friend/reading.png")}
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}
export function Tag({
  label,
  selected,
  onPress,
  children,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        u.tag,
        {
          backgroundColor: selected ? p.mint : "#F3EFF5",
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {children}
      <Text style={u.bold}>{label}</Text>
    </Pressable>
  );
}
export const u = StyleSheet.create({
  root: { flex: 1, backgroundColor: p.cream },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  fill: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 10,
  },
  topbar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  logo: { width: 108, height: 44 },
  hero: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  heroCopy: { flex: 1, zIndex: 1, paddingVertical: 12 },
  heroArt: { width: "36%", maxWidth: 175, height: 112, marginLeft: -8 },
  blob: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 12,
    bottom: 8,
    backgroundColor: "#E9E4F6",
    borderRadius: 65,
    transform: [{ rotate: "-8deg" }],
  },
  title: {
    fontFamily: "Nunito_700Bold",
    fontSize: 30,
    lineHeight: 36,
    color: p.ink,
    letterSpacing: -0.6,
  },
  heading: {
    fontFamily: "Nunito_700Bold",
    fontSize: 22,
    lineHeight: 29,
    color: p.ink,
  },
  bold: { fontFamily: "Nunito_700Bold", fontSize: 16, color: p.ink },
  copy: {
    fontFamily: "Nunito_400Regular",
    fontSize: 16,
    lineHeight: 23,
    color: p.muted,
  },
  small: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 13,
    lineHeight: 19,
    color: p.muted,
  },
  card: {
    backgroundColor: "#FFFDFC",
    borderWidth: 1,
    borderColor: p.line,
    borderRadius: 24,
    padding: 16,
    gap: 14,
    boxShadow: "0 4px 16px #442F7020",
  },
  button: {
    minHeight: 54,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0EBFA",
    alignItems: "center",
    justifyContent: "center",
  },
  tag: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 7,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segment: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 28,
    backgroundColor: "#F2EDF5",
    borderWidth: 1,
    borderColor: p.line,
  },
  link: { minHeight: 48, justifyContent: "center", paddingHorizontal: 8 },
  linkText: { fontFamily: "Nunito_700Bold", color: p.purple, fontSize: 15 },
  footer: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 12,
    flexDirection: "row",
    backgroundColor: p.cream,
    borderTopWidth: 1,
    borderColor: p.line,
  },
  error: {
    fontFamily: "Nunito_600SemiBold",
    fontSize: 15,
    lineHeight: 22,
    color: "#AD354B",
  },
});
