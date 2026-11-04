import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react-native";
import { Field } from "./field";
import { Pressable } from "./pressable";
import { IconButton, p, SatinButton, u } from "@/components/planner/ui";
/** Presets and a stepper keep common choices one tap away. Custom typing is opt-in. */
export function NumberChoice({
  label,
  value,
  onChange,
  min = 1,
  max = 180,
  step = 5,
  presets = [10, 15, 20, 30, 45, 60],
  unit = "",
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  presets?: number[];
  unit?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false),
    [input, setInput] = useState("");
  const valid = /^\d+$/.test(input) && Number(input) >= min &&
    Number(input) <= max;
  return (
    <View style={{ gap: 12 }}>
      <Text style={u.bold}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <IconButton
          label={t("guidedInput.less", { label })}
          disabled={disabled || value <= min}
          onPress={() => onChange(Math.max(min, value - step))}
        >
          <Minus color={p.purple} />
        </IconButton>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("guidedInput.editNumber", {
            label,
            value,
            unit,
          })}
          disabled={disabled}
          onPress={() => {
            setInput(String(value));
            setEditing(!editing);
          }}
          style={{
            flex: 1,
            minHeight: 56,
            alignItems: "center",
            justifyContent: "center",
            padding: 10,
            borderRadius: 18,
            backgroundColor: p.lilac,
          }}
        >
          <Text style={[u.bold, { fontSize: 24 }]}>{value} {unit}</Text>
        </Pressable>
        <IconButton
          label={t("guidedInput.more", { label })}
          disabled={disabled || value >= max}
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Plus color={p.purple} />
        </IconButton>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {presets.filter((v) => v >= min && v <= max).map((v) => (
          <Pressable
            key={v}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === v, disabled }}
            disabled={disabled}
            onPress={() => {
              onChange(v);
              setEditing(false);
            }}
            style={{
              minHeight: 48,
              minWidth: 56,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 16,
              backgroundColor: value === v ? p.purple : p.lilac,
            }}
          >
            <Text
              style={[u.bold, { color: value === v ? "#FFFFFF" : p.purple }]}
            >
              {v}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={u.small}>{t("guidedInput.numberHint")}</Text>
      {editing
        ? (
          <View style={{ gap: 10 }}>
            <Field
              label={t("guidedInput.customNumber")}
              value={input}
              keyboardType="number-pad"
              maxLength={String(max).length}
              onChangeText={setInput}
              editable={!disabled}
              hint={t("guidedInput.range", { min, max })}
            />
            <SatinButton
              title={t("guidedInput.useNumber")}
              disabled={disabled || !valid}
              onPress={() => {
                onChange(Number(input));
                setEditing(false);
              }}
            />
          </View>
        )
        : null}
    </View>
  );
}
export function PromptExamples(
  { value, onChange, examples, maxLength = 1500 }: {
    value: string;
    onChange: (s: string) => void;
    examples: string[];
    maxLength?: number;
  },
) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 8 }}>
      <Text style={u.small}>{t("guidedInput.examples")}</Text>
      {examples.map((example) => (
        <Pressable
          key={example}
          accessibilityRole="button"
          disabled={value.includes(example) ||
            (value.length + example.length + 1) > maxLength}
          onPress={() =>
            onChange(value.trim() ? `${value.trim()}\n${example}` : example)}
          style={{
            minHeight: 48,
            padding: 12,
            borderRadius: 16,
            backgroundColor: p.lilac,
          }}
        >
          <Text style={[u.small, { color: p.purple }]}>{example}</Text>
        </Pressable>
      ))}
    </View>
  );
}
