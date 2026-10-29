import { TZDate } from "@date-fns/tz";

import type { IsoWeekday } from "./domain";
import { DEFAULT_TIMEZONE, localDateOf } from "./locale";
import { isoWeekdayOf } from "./recurrence";

/**
 * Takvim etkinlikleri için RRULE alt kümesi: FREQ=DAILY|WEEKLY, BYDAY, INTERVAL (yalnız 1), UNTIL (YYYYMMDD).
 * Ders programı = FREQ=WEEKLY;BYDAY=MO,WE biçiminde tekrarlayan "school" etkinliğidir.
 */
export interface ParsedRrule {
  freq: "DAILY" | "WEEKLY";
  byDay: IsoWeekday[];
  until: string | null; // YYYY-MM-DD
}

const DAY_CODES: Record<string, IsoWeekday> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 };
const DAY_NAMES: Record<IsoWeekday, string> = { 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA", 7: "SU" };

export function parseRrule(rrule: string | null | undefined): ParsedRrule | null {
  if (!rrule) return null;
  const parts = Object.fromEntries(
    rrule
      .replace(/^RRULE:/i, "")
      .split(";")
      .map((kv) => kv.split("=") as [string, string])
      .map(([k, v]) => [k.toUpperCase(), (v ?? "").toUpperCase()]),
  ) as Record<string, string>;
  const freq = parts.FREQ;
  if (freq !== "DAILY" && freq !== "WEEKLY") return null;
  const byDay = (parts.BYDAY ?? "")
    .split(",")
    .map((d) => DAY_CODES[d.trim()])
    .filter((d): d is IsoWeekday => d !== undefined);
  const until = parts.UNTIL ? `${parts.UNTIL.slice(0, 4)}-${parts.UNTIL.slice(4, 6)}-${parts.UNTIL.slice(6, 8)}` : null;
  return { freq, byDay, until };
}

export function weeklyRrule(days: readonly IsoWeekday[], until?: string | null): string {
  const byDay = [...days].sort().map((d) => DAY_NAMES[d]).join(",");
  const untilPart = until ? `;UNTIL=${until.replace(/-/g, "")}` : "";
  return `FREQ=WEEKLY;BYDAY=${byDay}${untilPart}`;
}

export interface CalendarEventLike {
  id: string;
  starts_at: string; // ISO zaman damgası
  ends_at: string | null;
  all_day: boolean;
  rrule: string | null;
}

export interface Occurrence<T extends CalendarEventLike> {
  event: T;
  /** Ailenin saat dilimindeki yerel tarih (YYYY-MM-DD). */
  date: string;
  startsAt: Date;
  endsAt: Date | null;
}

function* datesBetween(from: string, to: string): Generator<string> {
  const [y, m, d] = from.split("-").map(Number) as [number, number, number];
  const cursor = new Date(Date.UTC(y, m - 1, d));
  for (;;) {
    const iso = cursor.toISOString().slice(0, 10);
    if (iso > to) return;
    yield iso;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

/** Bir anın saat dilimindeki saat ve dakikasını döndürür. */
function localTimeOf(instant: Date, timeZone: string): { hours: number; minutes: number } {
  const z = new TZDate(instant, timeZone);
  return { hours: z.getHours(), minutes: z.getMinutes() };
}

/**
 * [from, to] yerel tarih aralığındaki tüm oluşumları (tek seferlik + tekrarlayan) üretir.
 * `cancelled` = "eventId:YYYY-MM-DD" anahtarlarıyla iptal edilen oluşumlar (event_exceptions).
 */
export function occurrencesBetween<T extends CalendarEventLike>(
  events: readonly T[],
  from: string,
  to: string,
  timeZone: string = DEFAULT_TIMEZONE,
  cancelled: ReadonlySet<string> = new Set(),
): Occurrence<T>[] {
  const out: Occurrence<T>[] = [];
  for (const event of events) {
    const start = new Date(event.starts_at);
    const end = event.ends_at ? new Date(event.ends_at) : null;
    const durationMs = end ? end.getTime() - start.getTime() : 0;
    const firstDate = localDateOf(start, timeZone);
    const rule = parseRrule(event.rrule);

    if (!rule) {
      if (firstDate >= from && firstDate <= to && !cancelled.has(`${event.id}:${firstDate}`)) {
        out.push({ event, date: firstDate, startsAt: start, endsAt: end });
      }
      continue;
    }

    const byDay = rule.byDay.length > 0 ? rule.byDay : [isoWeekdayOf(firstDate)];
    const { hours, minutes } = localTimeOf(start, timeZone);
    for (const date of datesBetween(from, to)) {
      if (date < firstDate) continue;
      if (rule.until && date > rule.until) break;
      if (rule.freq === "WEEKLY" && !byDay.includes(isoWeekdayOf(date))) continue;
      if (cancelled.has(`${event.id}:${date}`)) continue;
      const [y, m, d] = date.split("-").map(Number) as [number, number, number];
      const startsAt = new Date(new TZDate(y, m - 1, d, hours, minutes, timeZone).getTime());
      out.push({
        event,
        date,
        startsAt,
        endsAt: end ? new Date(startsAt.getTime() + durationMs) : null,
      });
    }
  }
  return out.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Yerel tarih + saat (HH:MM) → ailenin saat diliminde UTC ISO zaman damgası. */
export function zonedIso(date: string, time: string, timeZone: string = DEFAULT_TIMEZONE): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  return new Date(new TZDate(y, m - 1, d, hh, mm, timeZone).getTime()).toISOString();
}
