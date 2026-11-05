import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";

/** The whole labelled row is a 52dp switch target, including on web. The track is drawn, so no hidden native control joins the tab order. */
export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value, disabled: !!disabled }} aria-checked={value} aria-disabled={!!disabled}
    disabled={disabled} onPress={() => onChange(!value)} style={{ minHeight: 52, minWidth: 48, flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1 }}>
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" aria-hidden style={{ width: 51, height: 31, borderRadius: 16, padding: 2, backgroundColor: value ? "#6042DE" : "#D9D3E6", opacity: disabled ? 0.6 : 1, justifyContent: "center" }}>
      <View style={{ width: 27, height: 27, borderRadius: 14, backgroundColor: "#FFFFFF", alignSelf: value ? "flex-end" : "flex-start", boxShadow: "0 2px 4px #20195133" }} />
    </View>
    <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 17, color: "#201951", flexShrink: 1 }}>{label}</Text>
  </Pressable>;
}
