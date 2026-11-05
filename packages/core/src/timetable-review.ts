import {
  clockMinutes,
  type LessonSettings,
  minutesClock,
  validLessonSettings,
} from "./timetable";

/** Source order is meaningful when the photograph contains lesson numbers but no clock. */
export interface TimetableCell {
  id: string;
  day: number | null;
  title: string;
  start: string | null;
  end: string | null;
  included?: boolean;
  note?: string;
  originalTitle?: string;
}
const aliases: Record<string, string> = {
  mat: "Matematik",
  matematik: "Matematik",
  ing: "İngilizce",
  ingilizce: "İngilizce",
  turk: "Türkçe",
  turkce: "Türkçe",
  sos: "Sosyal Bilgiler",
  sosyal: "Sosyal Bilgiler",
  "sosyal bilgiler": "Sosyal Bilgiler",
  fen: "Fen Bilimleri",
  "fen bilimleri": "Fen Bilimleri",
  din: "Din Kültürü ve Ahlak Bilgisi",
  "din kulturu": "Din Kültürü ve Ahlak Bilgisi",
  alm: "Almanca",
  almanca: "Almanca",
  beden: "Beden Eğitimi ve Spor",
  spor: "Beden Eğitimi ve Spor",
  muz: "Müzik",
  muzik: "Müzik",
  resim: "Görsel Sanatlar",
  "gorsel sanatlar": "Görsel Sanatlar",
};
export function normalizeLessonTitle(
  value: string,
): { title: string; matched: boolean } {
  const clean = value.trim().replace(/\s+/g, " ");
  const key = clean.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").normalize(
    "NFD",
  ).replace(/[\u0300-\u036f]/g, "").replace(/\./g, "");
  if (aliases[key]) return { title: aliases[key], matched: true };
  return {
    title: clean.toLocaleLowerCase("tr-TR").split(" ").map((word, i) =>
      i > 0 && ["ve", "ile"].includes(word)
        ? word
        : word.charAt(0).toLocaleUpperCase("tr-TR") + word.slice(1)
    ).join(" "),
    matched: false,
  };
}
export function timetableDay<T extends TimetableCell>(
  rows: T[],
  day: number,
): T[] {
  const list = rows.filter((r) => r.day === day);
  // A partially timed source must retain its original period order until explicitly scheduled.
  return list.every((r) => isClock(r.start) && isClock(r.end))
    ? list.slice().sort((a, b) => a.start!.localeCompare(b.start!))
    : list;
}
export const isClock = (s: string | null): s is string =>
  typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export interface BellPattern extends LessonSettings {
  lunchAfter: number;
  lunchMinutes: number;
}
export function scheduleTimetable<T extends TimetableCell>(
  rows: T[],
  days: number[],
  pattern: BellPattern,
): T[] {
  if (
    !validLessonSettings(pattern) || !Number.isInteger(pattern.lunchAfter) ||
    pattern.lunchAfter < 0 || pattern.lunchAfter > 16 ||
    !Number.isInteger(pattern.lunchMinutes) || pattern.lunchMinutes < 0 ||
    pattern.lunchMinutes > 180
  ) throw Error("invalid");
  const changes = new Map<string, T>();
  for (const day of days) {
    let cursor = clockMinutes(pattern.start);
    for (
      const [i, row] of timetableDay(rows, day).filter((r) =>
        r.included !== false
      ).entries()
    ) {
      const end = cursor + pattern.duration;
      if (end >= 1440) throw Error("dayFull");
      changes.set(row.id, {
        ...row,
        start: minutesClock(cursor),
        end: minutesClock(end),
      });
      cursor = end +
        (pattern.lunchAfter === i + 1 ? pattern.lunchMinutes : pattern.break);
    }
  }
  return rows.map((r) => changes.get(r.id) ?? r);
}
/** Change a gap after one period. All later periods retain their durations and gaps. */
export function changeTimetableBreak<T extends TimetableCell>(
  rows: T[],
  id: string,
  minutes: number,
): T[] {
  const row = rows.find((r) => r.id === id);
  if (
    !row?.day || row.included === false || !isClock(row.end) ||
    !Number.isInteger(minutes) ||
    minutes < 0 || minutes > 180
  ) throw Error("invalid");
  const day = timetableDay(rows, row.day).filter((r) => r.included !== false);
  const index = day.findIndex((r) => r.id === id);
  const next = day[index + 1];
  if (!next || !isClock(next.start)) throw Error("invalid");
  return shiftCells(
    rows,
    new Set(day.slice(index + 1).map((r) => r.id)),
    clockMinutes(row.end) + minutes - clockMinutes(next.start),
  );
}
function shiftCells<T extends TimetableCell>(
  rows: T[],
  ids: Set<string>,
  delta: number,
): T[] {
  return rows.map((r) => {
    if (!ids.has(r.id)) return r;
    if (!isClock(r.start) || !isClock(r.end)) throw Error("invalid");
    const start = clockMinutes(r.start) + delta,
      end = clockMinutes(r.end) + delta;
    if (start < 0 || end >= 1440 || end <= start) throw Error("dayFull");
    return { ...r, start: minutesClock(start), end: minutesClock(end) };
  });
}
export function editTimetableCell<T extends TimetableCell>(
  rows: T[],
  updated: T,
  shiftLater: boolean,
): T[] {
  const before = rows.find((r) => r.id === updated.id);
  let next = rows.map((r) => r.id === updated.id ? updated : r);
  if (
    shiftLater && before?.included !== false && updated.included !== false &&
    before?.day === updated.day && isClock(before.end) && isClock(updated.end)
  ) {
    const day = timetableDay(rows, before!.day!).filter((r) =>
      r.included !== false
    );
    const index = day.findIndex((r) => r.id === updated.id);
    next = shiftCells(
      next,
      new Set(day.slice(index + 1).map((r) => r.id)),
      clockMinutes(updated.end) - clockMinutes(before.end),
    );
  }
  return next;
}
/** Occupied cells exchange lessons while each time slot stays fixed. No lesson is overwritten. */
export function swapTimetableCells<T extends TimetableCell>(
  rows: T[],
  fromId: string,
  toId: string,
): T[] {
  const a = rows.find((r) => r.id === fromId),
    b = rows.find((r) => r.id === toId);
  if (!a || !b || a.included === false || b.included === false) return rows;
  return rows.map((r) =>
    r.id === a.id
      ? { ...b, day: a.day, start: a.start, end: a.end }
      : r.id === b.id
      ? { ...a, day: b.day, start: b.start, end: b.end }
      : r
  );
}

/** Reopening the bell editor derives the existing long break from saved absolute times. */
export function inferBellPattern(
  rows: TimetableCell[],
  day: number,
  settings: LessonSettings,
): BellPattern {
  const list = timetableDay(rows, day).filter((r) => r.included !== false);
  const first = list[0];
  const gaps = list.slice(0, -1).map((r, i) => {
    const next = list[i + 1];
    return next && isClock(r.end) && isClock(next.start)
      ? clockMinutes(next.start) - clockMinutes(r.end)
      : -1;
  });
  const longest = Math.max(settings.break, ...gaps);
  const lunchAfter = longest > settings.break && longest <= 180
    ? gaps.indexOf(longest) + 1
    : 0;
  const duration = first && isClock(first.start) && isClock(first.end)
    ? clockMinutes(first.end) - clockMinutes(first.start)
    : settings.duration;
  return {
    start: first && isClock(first.start) ? first.start : settings.start,
    duration: duration >= 5 && duration <= 180 ? duration : settings.duration,
    break: settings.break,
    lunchAfter,
    lunchMinutes: lunchAfter ? longest : 60,
  };
}
