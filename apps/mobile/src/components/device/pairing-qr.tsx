import { useMemo } from "react";
import { Platform, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { encodeQr } from "@/lib/qr-code";

/** Renders a QR code; the payload must already be free of personal data (pairing link only). */
export function PairingQr({ value, size = 220, label, dimmed = false }: { value: string; size?: number; label: string; dimmed?: boolean }) {
  const matrix = useMemo(() => encodeQr(value), [value]);
  const quiet = 4;
  const count = matrix.length + quiet * 2;
  const path = useMemo(() => {
    let d = "";
    matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x + quiet} ${y + quiet}h1v1h-1z`; }));
    return d;
  }, [matrix]);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID="pairing-qr"
      style={{ width: size, height: size, borderRadius: 22, overflow: "hidden", backgroundColor: "#FFFFFF", opacity: dimmed ? 0.15 : 1 }}
    >
      <Svg accessible={Platform.OS === "web" ? undefined : false} aria-hidden width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
        <Rect width={count} height={count} fill="#FFFFFF" />
        <Path d={path} fill="#201951" />
      </Svg>
    </View>
  );
}
