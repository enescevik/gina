import type { IsoWeekday } from "./domain";

/**
 * "Bugün hangi görevler düşer" sorusunun cevabı istemcide ve sunucuda aynı saf fonksiyonla verilir;
 * görev örnekleri (task instances) tabloya yazılmaz, gece cron'u yoktur.
 */
export interface RecurringTemplate {
  id: string;
  days_of_week: number[];
  starts_on: string; // YYYY-MM-DD
  ends_on: string | null; // YYYY-MM-DD
  active: boolean;
}

/** YYYY-MM-DD biçimindeki yerel tarihin ISO haftanın gününü döndürür (1 = Pazartesi … 7 = Pazar). */
export function isoWeekdayOf(localDate: string): IsoWeekday {
  const [y, m, d] = localDate.split("-").map(Number) as [number, number, number];
  // Date.UTC ile saat dilimi kaymasını önleriz; getUTCDay 0 = Pazar.
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (day === 0 ? 7 : day) as IsoWeekday;
}

/** Verilen yerel tarihte düşen görev şablonlarını döndürür. */
export function templatesDueOn<T extends RecurringTemplate>(templates: readonly T[], localDate: string): T[] {
  const weekday = isoWeekdayOf(localDate);
  return templates.filter(
    (t) =>
      t.active &&
      t.starts_on <= localDate &&
      (t.ends_on === null || t.ends_on >= localDate) &&
      t.days_of_week.includes(weekday),
  );
}

/** Verilen tarihi içeren ISO haftasının (Pazartesi–Pazar) günlerini YYYY-MM-DD olarak döndürür. */
export function weekDatesOf(localDate: string): string[] {
  const [y, m, d] = localDate.split("-").map(Number) as [number, number, number];
  const start = new Date(Date.UTC(y, m - 1, d));
  start.setUTCDate(start.getUTCDate() - (isoWeekdayOf(localDate) - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}
