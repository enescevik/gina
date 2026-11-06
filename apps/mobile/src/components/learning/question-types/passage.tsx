import { Text, View } from "react-native";
import { Pressable } from "@/components/ui/pressable";
import type { Segment } from "./phase2a-model";
import { qt } from "./ui";

/**
 * Metin işaretleme / hata bulma için parça çizimi. Cevap parça KİMLİĞİNE bağlıdır; metin hiç
 * bölünmez (Türkçe harf, emoji ve birleşik karakterler aynen kalır), satır kırılımı yalnız görünümü
 * değiştirir. Kelime biriminde parçalar satır içinde akar; cümle biriminde her cümle ayrı satırdır.
 */
export function Passage({
  segments,
  unit,
  selected,
  disabled,
  onToggle,
  a11y,
  decorate,
  testPrefix,
}: {
  segments: Segment[];
  unit: "word" | "sentence";
  selected: (id: string) => boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
  a11y: (text: string, on: boolean) => string;
  decorate?: (id: string) => string | null;
  testPrefix: string;
}) {
  const sentence = unit === "sentence";
  return (
    <View
      testID={`${testPrefix}-passage`}
      style={{ flexDirection: sentence ? "column" : "row", flexWrap: sentence ? "nowrap" : "wrap", alignItems: sentence ? "stretch" : "center", columnGap: 4, rowGap: 8, borderRadius: 20, backgroundColor: "#FFFFFF", padding: 14 }}
    >
      {segments.map((s, i) => {
        if (!s.id) {
          const plain = s.text.trim();
          return plain ? <Text key={`t${i}`} style={{ fontFamily: "Nunito_700Bold", fontSize: 19, lineHeight: 28, color: qt.ink }}>{plain}</Text> : null;
        }
        const on = selected(s.id);
        const extra = decorate?.(s.id) ?? null;
        return (
          <Pressable
            key={s.id}
            testID={`${testPrefix}-seg-${s.id}`}
            accessibilityRole="checkbox"
            accessibilityLabel={a11y(s.text, on)}
            accessibilityState={{ checked: on, disabled }}
            aria-checked={on}
            disabled={disabled}
            onPress={() => onToggle(s.id!)}
            style={{
              minHeight: 48,
              minWidth: sentence ? undefined : 44,
              justifyContent: "center",
              paddingHorizontal: sentence ? 12 : 8,
              paddingVertical: 6,
              borderRadius: 12,
              borderWidth: on ? 3 : 1,
              borderStyle: on ? "solid" : "dashed",
              borderColor: on ? qt.purpleDark : qt.line,
              backgroundColor: on ? qt.lilac : "#FFFFFF",
            }}
          >
            <Text style={{ fontFamily: on ? "Nunito_800ExtraBold" : "Nunito_700Bold", fontSize: 19, lineHeight: 28, color: qt.ink, textDecorationLine: on ? "underline" : "none" }}>{s.text}</Text>
            {extra ? <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 14, lineHeight: 19, color: qt.purpleDark }}>{extra}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
