import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CalendarRange, Undo2 } from "lucide-react-native";
import { DateChoice } from "@/components/ui/date-time-choice";
import { Pressable } from "@/components/ui/pressable";
import { distributePlanDates } from "./planner-moves";
import { p, SatinButton, Tag, u } from "./ui";

type Item = {
  index: number;
  title: string;
  due_on: string | null;
  planned_on: string;
};
/** Bulk homework spreading: preview first, apply to the draft, undo before saving. */
export function PlanDistribute(
  { items, start: initialStart, today, disabled, onApply, onUndo }: {
    items: Item[];
    start: string;
    today?: string;
    disabled: boolean;
    onApply: (dates: Record<number, string>) => void;
    onUndo: (() => void) | null;
  },
) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(initialStart);
  const [weekdays, setWeekdays] = useState([1, 2, 3, 4, 5]);
  const [perDay, setPerDay] = useState(1);
  const [notice, setNotice] = useState("");
  if (items.length < 2 && !onUndo) return null;
  const plan = distributePlanDates(items, { start, weekdays, perDay });
  const changed = plan.filter((x) =>
    !x.blocked && items.find((i) => i.index === x.index)?.planned_on !== x.planned_on
  );
  const dateText = (d: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(d + "T12:00:00Z"));
  return (
    <View style={[u.card, { gap: 12, backgroundColor: p.lilac }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={[u.row, { minHeight: 48 }]}
      >
        <CalendarRange color={p.purple} />
        <Text style={[u.bold, u.fill]}>{t("u05.distributeTitle")}</Text>
      </Pressable>
      {notice
        ? (
          <Text accessibilityLiveRegion="polite" style={[u.small, { color: "#197465" }]}>
            {notice}
          </Text>
        )
        : null}
      {onUndo
        ? (
          <SatinButton
            secondary
            title={t("u05.distributeUndo")}
            icon={<Undo2 size={18} color={p.purple} />}
            disabled={disabled}
            onPress={() => {
              onUndo();
              setNotice("");
            }}
          />
        )
        : null}
      {open
        ? (
          <>
            <Text style={u.small}>{t("u05.distributeHelp")}</Text>
            <DateChoice
              label={t("u05.distributeStart")}
              value={start}
              onChange={setStart}
              today={today}
              disabled={disabled}
            />
            <View style={[u.row, { flexWrap: "wrap", gap: 6 }]}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <Tag
                  key={d}
                  label={t("weekday." + d)}
                  selected={weekdays.includes(d)}
                  onPress={() =>
                    setWeekdays(
                      weekdays.includes(d)
                        ? weekdays.filter((x) => x !== d)
                        : [...weekdays, d],
                    )}
                />
              ))}
            </View>
            <Text style={u.bold}>{t("u05.perDay")}</Text>
            <View style={[u.row, { flexWrap: "wrap", gap: 6 }]}>
              {[1, 2, 3].map((n) => (
                <Tag
                  key={n}
                  label={String(n)}
                  selected={perDay === n}
                  onPress={() => setPerDay(n)}
                />
              ))}
            </View>
            {!weekdays.length
              ? <Text style={u.error}>{t("u05.distributeNoDays")}</Text>
              : (
                <View style={{ gap: 6 }}>
                  {plan.map((x) => {
                    const item = items.find((i) => i.index === x.index)!;
                    return (
                      <Text key={x.index} style={u.small}>
                        {t("u05.distributeRow", {
                          title: item.title,
                          date: dateText(x.planned_on),
                        })}
                        {x.capped ? ` · ${t("u05.distributeCapped")}` : ""}
                        {x.blocked ? ` · ${t("u05.distributeBlocked")}` : ""}
                      </Text>
                    );
                  })}
                </View>
              )}
            <SatinButton
              title={t("u05.distributeApply")}
              disabled={disabled || !changed.length}
              onPress={() => {
                onApply(
                  Object.fromEntries(changed.map((x) => [x.index, x.planned_on])),
                );
                setNotice(t("u05.distributeApplied", { count: changed.length }));
                setOpen(false);
              }}
            />
          </>
        )
        : null}
    </View>
  );
}
