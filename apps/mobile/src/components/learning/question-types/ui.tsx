import type { ReactNode } from "react";
import { Text, View, type AccessibilityRole, type AccessibilityState } from "react-native";
import { Check, Eye, Minus, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable } from "@/components/ui/pressable";
import type { ItemMark } from "./model";

/** Onaylı palet (tailwind teal = mor, cream, ink, mist). Renk tek başına anlam taşımaz: her durumda simge + metin. */
export const qt = {
  purple: "#6042DE",
  purpleDark: "#4D32BB",
  lilac: "#EEEAFE",
  mint: "#C0EFDF",
  mintDark: "#1F7A5C",
  cream: "#FCFAF6",
  ink: "#201951",
  muted: "#625C85",
  line: "#D9D1E6",
  warm: "#FFF1D6",
  warmLine: "#E9C77E",
};

/** 48dp+ dokunma hedefli seçenek kartı. `selected` görünür çerçeve + simgeyle belirtilir. */
export function Option({
  label,
  selected = false,
  muted = false,
  disabled,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  role = "button",
  state,
  testID,
  left,
  right,
  compact = false,
}: {
  label: string;
  selected?: boolean;
  muted?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  role?: AccessibilityRole;
  state?: AccessibilityState;
  testID?: string;
  left?: ReactNode;
  right?: ReactNode;
  compact?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, selected, ...state }}
      aria-checked={role === "radio" || role === "checkbox" ? !!state?.checked : undefined}
      aria-selected={role === "radio" || role === "checkbox" ? undefined : selected}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 48,
        minWidth: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: compact ? 12 : 14,
        paddingVertical: 10,
        borderRadius: 18,
        borderWidth: selected ? 3 : 2,
        borderColor: selected ? qt.purpleDark : qt.line,
        backgroundColor: selected ? qt.lilac : muted ? "#F4F1F7" : "#FFFFFF",
        opacity: disabled && !selected ? 0.6 : 1,
      }}
    >
      {left}
      <Text
        style={{
          flexShrink: 1,
          fontFamily: selected ? "Nunito_800ExtraBold" : "Nunito_700Bold",
          fontSize: 17,
          lineHeight: 24,
          color: muted ? qt.muted : qt.ink,
        }}
      >
        {label}
      </Text>
      {right}
      {selected ? <Check size={20} color={qt.purpleDark} accessible={false} /> : null}
    </Pressable>
  );
}

export function Help({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 16, lineHeight: 23, color: qt.muted }}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 17, lineHeight: 24, color: qt.ink }}>
      {children}
    </Text>
  );
}

/** Canlı bölge: dokun-yerleştir adımında çocuğa (ve ekran okuyucuya) bir sonraki adımı söyler. */
export function StepNote({ children, testID }: { children: ReactNode; testID?: string }) {
  if (!children) return null;
  return (
    <View testID={testID} accessibilityLiveRegion="polite" style={{ borderRadius: 16, backgroundColor: qt.lilac, paddingHorizontal: 14, paddingVertical: 10 }}>
      <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 16, lineHeight: 23, color: qt.ink }}>{children}</Text>
    </View>
  );
}

/** Yalnız veli incelemesi: doğru / yanlış / boş işareti (simge + metin). */
export function MarkBadge({ mark }: { mark: ItemMark }) {
  const { t } = useTranslation();
  if (mark === "unknown") return null;
  const look = {
    correct: { bg: qt.mint, fg: qt.mintDark, icon: <Check size={16} color={qt.mintDark} accessible={false} /> },
    incorrect: { bg: "#FFE9E9", fg: "#A43135", icon: <X size={16} color="#A43135" accessible={false} /> },
    blank: { bg: "#F1EEF5", fg: qt.muted, icon: <Minus size={16} color={qt.muted} accessible={false} /> },
    review: { bg: qt.warm, fg: qt.ink, icon: <Eye size={16} color={qt.ink} accessible={false} /> },
  }[mark];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: 999, backgroundColor: look.bg, paddingHorizontal: 10, paddingVertical: 3 }}>
      {look.icon}
      <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 14, lineHeight: 20, color: look.fg }}>{t(`prova.qt.review.mark.${mark}`)}</Text>
    </View>
  );
}
