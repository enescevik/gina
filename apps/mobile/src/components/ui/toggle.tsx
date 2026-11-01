import { Switch, Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

/** The whole labelled row is a 52dp switch target, including on web. */
export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled: !!disabled }} aria-checked={value} aria-disabled={!!disabled}
    disabled={disabled} onPress={() => onChange(!value)} style={{ minHeight: 52, minWidth: 48, flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" aria-hidden>
      <Switch accessible={false} focusable={false} value={value} trackColor={{ false: "#D9D3E6", true: "#6042DE" }} thumbColor="#FFFFFF" />
    </View>
    <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 17, color: "#201951", flexShrink: 1 }}>{label}</Text>
  </Pressable>;
}
