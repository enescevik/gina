import { setNumeric, type AnswerOf, type NumericPayload } from "@gina/core";
import { useTranslation } from "react-i18next";
import { Text, TextInput, View } from "react-native";
import { NotebookPen } from "lucide-react-native";
import { Pressable } from "@/components/ui/pressable";
import { cleanNumericInput, numericHint } from "./model";
import { Help, Option, SectionTitle, qt } from "./ui";

const EMPTY: AnswerOf<"numeric"> = { type: "numeric", v: 1 };

/**
 * QT13 — Sayısal kısa cevap. Sayı klavyesi (decimal-pad) + kesir/virgül için yardımcı tuşlar
 * (bazı sayı klavyelerinde "/" yok). Sayı olarak okunamayan girişte nazik ipucu; "yanlış" denmez.
 * Birim seçimi yalnız `unit_required` iken. İşlem alanı isteğe bağlı deftere açılır.
 */
export function NumericQuestion({
  payload,
  answer,
  onChange,
  disabled,
  onOpenWorkArea,
  hasWork,
}: {
  payload: NumericPayload;
  answer: AnswerOf<"numeric"> | undefined;
  onChange: (a: AnswerOf<"numeric">, typed?: boolean) => void;
  disabled: boolean;
  onOpenWorkArea?: () => void;
  hasWork?: boolean;
}) {
  const { t } = useTranslation();
  const current = answer ?? EMPTY;
  const value = current.value ?? "";
  const hint = numericHint(value);
  const setValue = (next: string) => onChange(setNumeric(current, { value: cleanNumericInput(next) || null }), true);
  return (
    <View style={{ gap: 14 }}>
      <Help>{t("prova.qt.child.num.formats")}</Help>
      <View style={{ gap: 8 }}>
        <SectionTitle>{t("prova.qt.child.num.label")}</SectionTitle>
        <TextInput
          testID="qt-numeric-value"
          accessibilityLabel={t("prova.qt.child.num.label")}
          accessibilityHint={t("prova.qt.child.num.formats")}
          value={value}
          editable={!disabled}
          keyboardType="decimal-pad"
          inputMode="decimal"
          maxLength={40}
          autoCorrect={false}
          placeholder={t("prova.qt.child.num.placeholder")}
          placeholderTextColor={qt.muted}
          onChangeText={setValue}
          style={{ minHeight: 60, borderRadius: 18, borderWidth: 2, borderColor: value ? qt.purple : qt.line, backgroundColor: "#FFFFFF", paddingHorizontal: 16, fontFamily: "Nunito_800ExtraBold", fontSize: 26, color: qt.ink }}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {([
            [",", "prova.qt.child.num.keyComma"],
            ["/", "prova.qt.child.num.keySlash"],
            [" ", "prova.qt.child.num.keySpace"],
          ] as const).map(([ch, label]) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={t(label)}
              disabled={disabled}
              onPress={() => setValue(value + ch)}
              style={{ minHeight: 48, minWidth: 56, alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 2, borderColor: qt.line, backgroundColor: qt.cream, paddingHorizontal: 12 }}
            >
              <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 20, color: qt.ink }}>{ch === " " ? t("prova.qt.child.num.spaceShort") : ch}</Text>
            </Pressable>
          ))}
        </View>
        {hint ? (
          <Text testID="qt-numeric-hint" accessibilityLiveRegion="polite" style={{ fontFamily: "Nunito_700Bold", fontSize: 16, lineHeight: 23, color: qt.ink, backgroundColor: qt.warm, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
            {t("prova.qt.child.num.hint")}
          </Text>
        ) : null}
      </View>
      {payload.unit_required ? (
        <View style={{ gap: 8 }}>
          <SectionTitle>{t("prova.qt.child.num.unit")}</SectionTitle>
          <View accessibilityRole="radiogroup" accessibilityLabel={t("prova.qt.child.num.unit")} style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {payload.units.map((u) => {
              const selected = current.unit === u.id;
              return (
                <Option
                  key={u.id}
                  testID={`qt-unit-${u.id}`}
                  role="radio"
                  label={u.text}
                  accessibilityLabel={t("prova.qt.child.num.unitA11y", { unit: u.text })}
                  state={{ checked: selected }}
                  selected={selected}
                  disabled={disabled}
                  compact
                  onPress={() => onChange(setNumeric(current, { unit: selected ? null : u.id }))}
                />
              );
            })}
          </View>
        </View>
      ) : null}
      {payload.work_area && onOpenWorkArea ? (
        <Pressable
          testID="qt-numeric-work"
          accessibilityRole="button"
          accessibilityLabel={t(hasWork ? "prova.qt.child.num.workAreaHas" : "prova.qt.child.num.workArea")}
          disabled={disabled}
          onPress={onOpenWorkArea}
          style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "flex-start", borderRadius: 18, borderWidth: 2, borderColor: qt.purple, backgroundColor: qt.lilac, paddingHorizontal: 16 }}
        >
          <NotebookPen size={22} color={qt.purpleDark} />
          <Text style={{ flexShrink: 1, fontFamily: "Nunito_800ExtraBold", fontSize: 17, color: qt.ink }}>{t(hasWork ? "prova.qt.child.num.workAreaHas" : "prova.qt.child.num.workArea")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
