import { useId } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View, type PressableProps } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Pressable } from "@/components/ui/pressable";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const colors = {
  primary: { backgroundColor: "#6042DE", borderColor: "#4D32BB", color: "#FFFFFF" },
  secondary: { backgroundColor: "#EEEAFE", borderColor: "#A89BD4", color: "#201951" },
  ghost: { backgroundColor: "transparent", borderColor: "transparent", color: "#6042DE" },
  danger: { backgroundColor: "#FFE9E9", borderColor: "#E4B4AF", color: "#A43135" },
};
export interface ButtonProps extends Omit<PressableProps, "children"> {
  title: string; variant?: Variant; loading?: boolean; size?: "default" | "child";
}
export function Button({ title, variant = "primary", loading = false, size = "default", disabled, className, style, accessibilityState, ...rest }: ButtonProps) {
  const id = useId().replace(/:/g, "");
  const isDisabled = !!disabled || loading;
  const palette = isDisabled ? { backgroundColor: "#E7E2EF", borderColor: "#C7BED7", color: "#625C85" } : colors[variant];
  return <Pressable {...rest} accessibilityRole="button" accessibilityLabel={rest.accessibilityLabel ?? title}
    accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: loading }} disabled={isDisabled} className={className}
    style={state => [{ alignSelf: variant === "ghost" ? "center" : "stretch", minWidth: 48, minHeight: size === "child" ? 60 : 52, borderRadius: 19, borderWidth: 1,
      paddingVertical: 13, paddingHorizontal: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
      backgroundColor: palette.backgroundColor, borderColor: palette.borderColor,
      overflow: "hidden", boxShadow: variant === "primary" && !isDisabled && !state.pressed ? "0 4px 10px #38216B20" : "none",
      opacity: state.pressed && !isDisabled ? .85 : 1,
    }, typeof style === "function" ? style(state) : style]}>
    {variant === "primary" && !isDisabled ? <View pointerEvents="none" style={StyleSheet.absoluteFill}><Svg accessible={Platform.OS === "web" ? undefined : false} aria-hidden width="100%" height="100%"><Defs><LinearGradient id={id} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#8A64FF"/><Stop offset="30%" stopColor="#7147ED"/><Stop offset="1" stopColor="#5132BD"/></LinearGradient></Defs><Rect width="100%" height="100%" rx={18} fill={`url(#${id})`}/></Svg></View> : null}
    {loading ? <ActivityIndicator size="small" color={palette.color} /> : null}
    <Text style={{ flexShrink: 1, minWidth: 0, textAlign: "center", fontFamily: "Nunito_800ExtraBold", fontSize: size === "child" ? 20 : 17, lineHeight: size === "child" ? 27 : 23, color: palette.color }}>{title}</Text>
  </Pressable>;
}
