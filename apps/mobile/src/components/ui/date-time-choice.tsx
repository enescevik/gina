import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Minus,
  Plus,
} from "lucide-react-native";
import {
  clockMinutes,
  isCalendarDate,
  isClock,
  localDateOf,
  minutesClock,
} from "@gina/core";
import { IconButton, p, SatinButton, Tag, u } from "@/components/planner/ui";
import { Field } from "./field";
import { Pressable } from "./pressable";

/** Date-only values stay date-only: a device timezone must not move the chosen day. */
export function DateChoice(
  {
    label,
    value,
    onChange,
    today = localDateOf(
      new Date(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
    disabled = false,
    hint,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    today?: string;
    disabled?: boolean;
    hint?: string;
  },
) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false),
    [manual, setManual] = useState(false),
    [input, setInput] = useState("");
  const [month, setMonth] = useState(
    (isCalendarDate(value) ? value : today).slice(0, 7),
  );
  const format = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(i18n.language, { ...options, timeZone: "UTC" })
      .format(new Date(day + "T12:00:00Z"));
  const start = new Date(month + "-01T12:00:00Z");
  const offset = (start.getUTCDay() + 6) % 7;
  const count = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const shift = (delta: number) =>
    setMonth(
      new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + delta, 1))
        .toISOString().slice(0, 7),
    );
  const choose = (day: string) => {
    onChange(day);
    setExpanded(false);
    setManual(false);
  };
  return (
    <View style={{ gap: 8, minWidth: 0 }}>
      <Text style={u.bold}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded, disabled }}
        accessibilityLabel={`${label}: ${
          isCalendarDate(value) ? format(value, { dateStyle: "long" }) : value
        }`}
        disabled={disabled}
        onPress={() => {
          setMonth((isCalendarDate(value) ? value : today).slice(0, 7));
          setExpanded(!expanded);
          setManual(false);
        }}
        style={{
          minHeight: 54,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 14,
          backgroundColor: "#fff",
          borderWidth: 1,
          borderColor: p.line,
          borderRadius: 17,
        }}
      >
        <CalendarDays color={p.purple} size={22} />
        <Text style={[u.bold, { flex: 1 }]}>
          {isCalendarDate(value)
            ? format(value, { dateStyle: "long" })
            : t("experience.chooseDate")}
        </Text>
        <ChevronDown color={p.purple} size={20} />
      </Pressable>
      {hint ? <Text style={u.small}>{hint}</Text> : null}
      {expanded && !disabled
        ? (
          <View style={{ gap: 12, paddingVertical: 8 }}>
            <View style={[u.row, { flexWrap: "wrap" }]}>
              {[0, 1, 7].map((n) => {
                const day = new Date(
                  Date.parse(today + "T12:00:00Z") + n * 86400000,
                ).toISOString().slice(0, 10);
                return (
                  <Tag
                    key={n}
                    label={t(`learningPlan.dayChoices.${n}`)}
                    selected={value === day}
                    onPress={() => choose(day)}
                  />
                );
              })}
            </View>
            <View style={u.row}>
              <IconButton
                label={t("experience.previousMonth")}
                onPress={() => shift(-1)}
              >
                <ChevronLeft color={p.purple} />
              </IconButton>
              <Text style={[u.bold, { flex: 1, textAlign: "center" }]}>
                {format(month + "-01", { month: "long", year: "numeric" })}
              </Text>
              <IconButton
                label={t("experience.nextMonth")}
                onPress={() => shift(1)}
              >
                <ChevronRight color={p.purple} />
              </IconButton>
            </View>
            <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
              <View style={{ flex: 1, minWidth: 336 }}>
                <View style={u.row}>
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <Text
                      key={day}
                      style={[u.small, { flex: 1, textAlign: "center" }]}
                    >
                      {t(`weekday.${day}`)}
                    </Text>
                  ))}
                </View>
                {Array.from(
                  { length: Math.ceil((offset + count) / 7) },
                  (_, week) => (
                    <View key={week} style={{ flexDirection: "row" }}>
                      {Array.from({ length: 7 }, (_, col) => {
                        const d = week * 7 + col - offset + 1,
                          day = `${month}-${String(d).padStart(2, "0")}`;
                        return d < 1 || d > count
                          ? <View key={col} style={{ flex: 1, minWidth: 48 }} />
                          : (
                            <Pressable
                              key={col}
                              accessibilityRole="button"
                              accessibilityLabel={format(day, {
                                dateStyle: "full",
                              })}
                              accessibilityState={{ selected: value === day }}
                              onPress={() => choose(day)}
                              style={{
                                flex: 1,
                                minWidth: 48,
                                minHeight: 48,
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 16,
                                backgroundColor: value === day
                                  ? p.purple
                                  : day === today
                                  ? p.mint
                                  : "transparent",
                              }}
                            >
                              <Text
                                style={[u.bold, {
                                  color: value === day ? "#fff" : p.ink,
                                }]}
                              >
                                {d}
                              </Text>
                            </Pressable>
                          );
                      })}
                    </View>
                  ),
                )}
              </View>
            </ScrollView>
            <Tag
              label={t("experience.enterDate")}
              selected={manual}
              onPress={() => {
                setManual(!manual);
                setInput(value);
              }}
            />
            {manual
              ? (
                <>
                  <Field
                    label={t("experience.dateFormat")}
                    value={input}
                    onChangeText={setInput}
                    maxLength={10}
                    placeholder="2026-11-05"
                    keyboardType="numbers-and-punctuation"
                  />
                  <SatinButton
                    secondary
                    disabled={!isCalendarDate(input)}
                    title={t("experience.useDate")}
                    onPress={() => choose(input)}
                  />
                </>
              )
              : null}
          </View>
        )
        : null}
    </View>
  );
}

export function TimeChoice({ label, value, onChange, disabled = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false),
    [manual, setManual] = useState(false),
    [input, setInput] = useState("");
  const valid = isClock(value), total = valid ? clockMinutes(value) : 540;
  const hour = Math.floor(total / 60), minute = total % 60;
  const change = (delta: number) =>
    onChange(minutesClock(Math.max(0, Math.min(1439, total + delta))));
  return (
    <View style={{ gap: 8, flex: 1, minWidth: 140 }}>
      <Text style={u.bold}>{label}</Text>
      <Pressable
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || t("experience.chooseTime")}`}
        accessibilityState={{ expanded, disabled }}
        onPress={() => {
          setExpanded(!expanded);
          setManual(false);
        }}
        style={{
          minHeight: 54,
          padding: 14,
          borderRadius: 17,
          backgroundColor: "#fff",
          borderWidth: 1,
          borderColor: p.line,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Clock3 color={p.purple} size={20} />
        <Text style={[u.bold, { flex: 1, fontSize: 22 }]}>
          {valid ? value : "—"}
        </Text>
        <ChevronDown color={p.purple} size={18} />
      </Pressable>
      {expanded && !disabled
        ? (
          <View style={{ gap: 12 }}>
            <Text style={u.small}>{t("experience.timeHelp")}</Text>
            {[["hour", hour, 60], ["minute", minute, 5]].map((
              [unit, number, delta],
            ) => (
              <View key={unit} style={{ gap: 6 }}>
                <Text style={u.small}>{t(`experience.${unit}`)}</Text>
                <View style={u.row}>
                  <IconButton
                    disabled={disabled || total < Number(delta)}
                    label={t("guidedInput.less", {
                      label: t(`experience.${unit}`),
                    })}
                    onPress={() => change(-Number(delta))}
                  >
                    <Minus color={p.purple} />
                  </IconButton>
                  <Text
                    style={[u.bold, {
                      flex: 1,
                      textAlign: "center",
                      fontSize: 24,
                    }]}
                  >
                    {String(number).padStart(2, "0")}
                  </Text>
                  <IconButton
                    disabled={disabled || total + Number(delta) > 1439}
                    label={t("guidedInput.more", {
                      label: t(`experience.${unit}`),
                    })}
                    onPress={() => change(Number(delta))}
                  >
                    <Plus color={p.purple} />
                  </IconButton>
                </View>
              </View>
            ))}
            <View style={[u.row, { flexWrap: "wrap" }]}>
              {[0, 15, 30, 45].map((m) => (
                <Tag
                  key={m}
                  label={`:${String(m).padStart(2, "0")}`}
                  selected={valid && minute === m}
                  onPress={() => onChange(minutesClock(hour * 60 + m))}
                />
              ))}
            </View>
            <Tag
              label={t("experience.enterTime")}
              selected={manual}
              onPress={() => {
                setManual(!manual);
                setInput(valid ? value : "09:00");
              }}
            />
            {manual
              ? (
                <>
                  <Field
                    label={t("experience.timeFormat")}
                    value={input}
                    onChangeText={setInput}
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                  />
                  <SatinButton
                    secondary
                    title={t("experience.useTime")}
                    disabled={!isClock(input)}
                    onPress={() => {
                      onChange(input);
                      setManual(false);
                      setExpanded(false);
                    }}
                  />
                </>
              )
              : (
                <SatinButton
                  secondary
                  title={t("experience.timeDone")}
                  disabled={!valid}
                  onPress={() => setExpanded(false)}
                />
              )}
          </View>
        )
        : null}
    </View>
  );
}
