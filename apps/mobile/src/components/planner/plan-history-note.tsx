// L04. Used by the calendar day view (`plan_for_day`) and the routine editor's effective-day label;
// the task list and timetable screens adopt it when they switch to `plan_for_day`. It renders the
// honesty note for a day entry:
// known as of a day without a recorded start, unknown before the first recorded version, a closed
// period's snapshot, or settings scheduled for a later day.
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { pausedHoliday, planHistoryNote, type DayPlan, type PlanVersionStatus } from "@gina/core";
import { p } from "./ui";

export type PlanHistoryEntry = {
  status: PlanVersionStatus;
  effective_from: string | null;
  known_since: string | null;
  unknown_before: string | null;
};

export function PlanHistoryNote({ entry, today }: { entry: PlanHistoryEntry; today: string }) {
  const { t, i18n } = useTranslation();
  const note = planHistoryNote(entry, today);
  if (note === "none") return null;
  const day = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long" }).format(new Date(value + "T12:00:00Z"))
      : "";
  const text =
    note === "scheduled" ? t("planHistory.scheduled", { date: day(entry.effective_from) })
    : note === "legacy" ? t("planHistory.legacy", { date: day(entry.known_since) })
    : note === "period_snapshot" ? t("planHistory.periodSnapshot", { date: day(entry.unknown_before) })
    : t("planHistory.unknownBefore", { date: day(entry.unknown_before) });
  return (
    <View accessibilityRole="text" style={[s.box, note === "scheduled" ? s.scheduled : s.muted]}>
      <Text style={s.text}>{text}</Text>
    </View>
  );
}

/**
 * C12: calm note for a day whose lessons are paused by a holiday the parent accepted (`plan_for_day.holiday`).
 * The program is not deleted; routines and other items are shown exactly as the server returns them.
 */
export function HolidayPauseNote({ plan, name }: { plan: Pick<DayPlan, "holiday"> | null | undefined; name?: string | null }) {
  const { t, i18n } = useTranslation();
  const holiday = pausedHoliday(plan);
  if (!holiday) return null;
  const day = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "long" }).format(new Date(value + "T12:00:00Z"));
  const range = holiday.starts_on === holiday.ends_on ? day(holiday.starts_on) : `${day(holiday.starts_on)} – ${day(holiday.ends_on)}`;
  return (
    <View accessibilityRole="text" style={[s.box, s.holiday]}>
      <Text style={[s.text, s.holidayTitle]}>{name ? `${name} · ` : ""}{t("c12.holiday.title")}</Text>
      <Text style={s.text}>{t("c12.holiday.body", { title: holiday.title, range })}</Text>
    </View>
  );
}

/** Label for the effective-day control in an editor: "from today" or "from <date>". */
export function effectiveFromLabel(value: string | null, today: string, t: (key: string, options?: Record<string, string>) => string, locale: string) {
  if (!value || value === today) return t("planHistory.effectiveToday");
  return t("planHistory.effectiveFuture", {
    date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(value + "T12:00:00Z")),
  });
}

const s = StyleSheet.create({
  box: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, minHeight: 48, justifyContent: "center" },
  muted: { backgroundColor: p.cream, borderColor: p.line },
  scheduled: { backgroundColor: p.lilac, borderColor: "#E4DCF4" },
  holiday: { backgroundColor: "#E7F5EE", borderColor: "#BFE5D3", gap: 2 },
  holidayTitle: { color: "#1F5F4E", fontFamily: "Nunito_800ExtraBold" },
  text: { color: p.muted, fontFamily: "Nunito_600SemiBold", fontSize: 14, lineHeight: 20 },
});
