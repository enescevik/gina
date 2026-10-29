import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const container: Record<Variant, string> = {
  primary: "bg-teal active:bg-teal-dark",
  secondary: "bg-teal-light active:bg-mist",
  ghost: "bg-transparent active:bg-mist",
  danger: "bg-coral-light active:bg-coral",
};

const label: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-teal-dark",
  ghost: "text-teal-dark",
  danger: "text-danger",
};

export interface ButtonProps extends Omit<PressableProps, "children"> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  /** Çocuk alanı: daha büyük dokunma hedefi ve yazı. */
  size?: "default" | "child";
}

export function Button({ title, variant = "primary", loading, size = "default", disabled, className, ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={`${container[variant]} ${size === "child" ? "min-h-16 rounded-child px-6" : "min-h-12 rounded-button px-4"} items-center justify-center ${isDisabled ? "opacity-50" : ""} ${className ?? ""}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : "#0B7F7F"} />
      ) : (
        <Text className={`${label[variant]} ${size === "child" ? "text-xl" : "text-base"} font-semibold`}>{title}</Text>
      )}
    </Pressable>
  );
}
