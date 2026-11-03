import { z } from "zod";
import { isCalendarDate, isClockTime } from "./form-validation";
import { localDateOf } from "./locale";
import { occurrencesBetween, zonedIso } from "./events";
export const studyPlanDaysSchema = z.array(z.object({
  gun: z.number().int().min(1).max(14),
  konu: z.string().trim().min(1).max(120),
  etkinlik: z.string().trim().min(1).max(1200),
  sure_dk: z.number().int().min(5).max(60),
})).min(1).max(14).refine((days) =>
  new Set(days.map((d) => d.gun)).size === days.length
);
export interface PlanCalendarDraft {
  day: number;
  title: string;
  notes: string;
  date: string;
  time: string;
  minutes: number;
  selected: boolean;
}
export function makePlanCalendarDrafts(
  body: unknown,
  startDate: string,
): PlanCalendarDraft[] {
  const value = body && typeof body === "object" && "gunler" in body
    ? body.gunler
    : null;
  const days = studyPlanDaysSchema.parse(value);
  if (!isCalendarDate(startDate)) throw Error("plan_invalid");
  return days.sort((a, b) => a.gun - b.gun).map((d) => ({
    day: d.gun,
    title: d.konu,
    notes: d.etkinlik,
    date: new Date(Date.parse(startDate) + (d.gun - 1) * 86400000).toISOString()
      .slice(0, 10),
    time: "17:00",
    minutes: d.sure_dk,
    selected: false,
  }));
}
export function planCalendarItems(
  rows: PlanCalendarDraft[],
  timeZone: string,
  today: string,
) {
  const selected = rows.filter((r) => r.selected);
  if (!selected.length) throw Error("plan_empty");
  const maxDate = new Date(Date.parse(today) + 365 * 86400000).toISOString()
    .slice(0, 10);
  const items = selected.map((r) => {
    if (
      !isCalendarDate(r.date) || !isClockTime(r.time) || r.date < today ||
      r.date > maxDate || !r.title.trim() || r.title.trim().length > 120 ||
      !r.notes.trim() || r.notes.trim().length > 1200 ||
      !Number.isInteger(r.minutes) || r.minutes < 5 || r.minutes > 60
    ) throw Error("plan_invalid");
    const starts_at = zonedIso(r.date, r.time, timeZone);
    // A clock time skipped by daylight saving must be corrected explicitly.
    const actual = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(starts_at));
    if (
      actual !== r.time || localDateOf(new Date(starts_at), timeZone) !== r.date
    ) throw Error("plan_invalid");
    return {
      day: r.day,
      title: r.title.trim(),
      notes: r.notes.trim(),
      starts_at,
      minutes: r.minutes,
    };
  });
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!,
        b = items[j]!,
        at = Date.parse(a.starts_at),
        bt = Date.parse(b.starts_at);
      if (at < bt + b.minutes * 60000 && bt < at + a.minutes * 60000) {
        throw Error("plan_overlap");
      }
    }
  }
  return items;
}

/** Review warnings only: concurrent calendar changes can still happen after this snapshot. */
export function studyPlanConflicts(
  items: ReturnType<typeof planCalendarItems>,
  events: readonly (import("./events").CalendarEventLike & { title: string })[],
  timeZone: string,
  cancelled: ReadonlySet<string> = new Set(),
) {
  return items.map((item) => {
    const start = Date.parse(item.starts_at),
      end = start + item.minutes * 60000,
      date = localDateOf(new Date(start), timeZone);
    const previous = new Date(Date.parse(date) - 86400000).toISOString().slice(
      0,
      10,
    );
    const next = localDateOf(new Date(end), timeZone);
    const repeated = occurrencesBetween(
      events.filter((e) => e.rrule),
      previous,
      next,
      timeZone,
      cancelled,
    );
    const singles = events.filter((e) =>
      !e.rrule &&
      !cancelled.has(`${e.id}:${localDateOf(new Date(e.starts_at), timeZone)}`)
    ).map((event) => ({
      event,
      startsAt: new Date(event.starts_at),
      endsAt: event.ends_at ? new Date(event.ends_at) : null,
    }));
    return {
      day: item.day,
      titles: [
        ...new Set(
          [...singles, ...repeated].filter((o) => {
            const a = o.startsAt.getTime(),
              b = o.endsAt?.getTime() ??
                (o.event.all_day ? a + 86400000 : a + 60000);
            return start < b && a < end;
          }).map((o) => o.event.title),
        ),
      ],
    };
  });
}
