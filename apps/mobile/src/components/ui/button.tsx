import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const colors = {
  primary: { backgroundColor: "#0B7F7F", borderColor: "#086461", color: "#FFFFFF" },
  secondary: { backgroundColor: "#E1F2EB", borderColor: "#527E72", color: "#284E4B" },
  ghost: { backgroundColor: "#FFFCF6", borderColor: "#527E72", color: "#284E4B" },
  danger: { backgroundColor: "#FFE9E9", borderColor: "#E4B4AF", color: "#A43135" },
};
export interface ButtonProps extends Omit<PressableProps, "children"> {
  title: string; variant?: Variant; loading?: boolean; size?: "default" | "child";
}
export function Button({ title, variant = "primary", loading = false, size = "default", disabled, className, style, accessibilityState, ...rest }: ButtonProps) {
  const isDisabled = !!disabled || loading;
  const palette = isDisabled ? { backgroundColor: "#D8E4DF", borderColor: "#9CAB9F", color: "#425E58" } : colors[variant];
  return <Pressable {...rest} accessibilityRole="button" accessibilityLabel={rest.accessibilityLabel ?? title}
    accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: loading }} disabled={isDisabled} className={className}
    style={state => [{ minWidth: 48, minHeight: size === "child" ? 60 : 50, borderRadius: 18, borderWidth: 1.5,
      paddingVertical: 13, paddingHorizontal: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
      backgroundColor: palette.backgroundColor, borderColor: palette.borderColor,
      opacity: state.pressed && !isDisabled ? .85 : 1,
    }, typeof style === "function" ? style(state) : style]}>
    {loading ? <ActivityIndicator size="small" color={palette.color} /> : null}
    <Text style={{ flexShrink: 1, minWidth: 0, textAlign: "center", fontFamily: "Nunito_700Bold", fontSize: size === "child" ? 20 : 17, lineHeight: size === "child" ? 27 : 23, color: palette.color }}>{title}</Text>
  </Pressable>;
}
