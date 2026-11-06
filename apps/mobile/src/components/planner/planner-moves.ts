import {
  type AnswerJournalStorage,
  type BellPattern,
  clockMinutes,
  inferBellPattern,
  isClock,
  type Lesson,
  type LessonSettings,
  minutesClock,
  normalizeLessonTitle,
  normalizeSubjectAlias,
  type TimetableCell,
  timetableDay,
} from "@gina/core";

/**
 * U05 pure planner rules. Kept free of React so the same rule is used by tap and drag, and
 * can be checked without a device.
 */

/** Grid id used for an empty target cell: `empty:<day>:<period index>`. */
export const emptyCellId = (day: number, slot: number) => `empty:${day}:${slot}`;
export function readEmptyCellId(id: string): { day: number; slot: number } | null {
  const m = /^empty:([1-7]):(\d{1,2})$/.exec(id);
  return m ? { day: Number(m[1]), slot: Number(m[2]) } : null;
}

/**
 * Moves one lesson to the end of another (or the same) day. No lesson is overwritten.
 * Times come only from the parent's bell pattern for that day; an untimed lesson or an untimed
 * target day stays untimed, because the source never showed a clock (AI must not invent one).
 * Skipped empty periods keep the bell spacing so "period 6" really lands at period 6.
 */
export function moveTimetableCellToDay<T extends TimetableCell>(
  rows: T[],
  id: string,
  day: number,
  settings: LessonSettings,
  slot?: number,
): T[] {
  const row = rows.find((r) => r.id === id);
  if (!row || row.included === false || day < 1 || day > 7) {
    throw Error("invalid");
  }
  const others = rows.filter((r) => r.id !== id);
  const target = timetableDay(others, day).filter((r) => r.included !== false);
  const rowTimed = isClock(row.start) && isClock(row.end);
  const targetTimed = target.every((r) => isClock(r.start) && isClock(r.end));
  let start: string | null = null, end: string | null = null;
  if (rowTimed && targetTimed) {
    const pattern: BellPattern = target.length
      ? inferBellPattern(others, day, settings)
      : { ...settings, lunchAfter: 0, lunchMinutes: 0 };
    const duration = clockMinutes(row.end!) - clockMinutes(row.start!);
    const last = target[target.length - 1];
    const skipped = Math.max(0, Math.min(8, (slot ?? target.length) - target.length));
    let cursor = last
      ? clockMinutes(last.end!) +
        (pattern.lunchAfter === target.length ? pattern.lunchMinutes : pattern.break)
      : clockMinutes(pattern.start);
    cursor += skipped * (pattern.duration + pattern.break);
    if (cursor + duration >= 1440) throw Error("dayFull");
    start = minutesClock(cursor);
    end = minutesClock(cursor + duration);
  }
  return [...others, { ...row, day, start, end }];
}

export type DayCopyPreview = {
  day: number;
  before: Lesson[];
  after: Lesson[];
};
/** Before/after for copying one day onto others. Target days are replaced, never merged. */
export function copyDayPlan(
  lessons: Lesson[],
  from: number,
  targets: number[],
  newKey: () => string,
): { lessons: Lesson[]; preview: DayCopyPreview[] } {
  const source = lessons.filter((l) => l.day === from).sort((a, b) =>
    a.start.localeCompare(b.start)
  );
  const days = [...new Set(targets)].filter((d) => d !== from && d >= 1 && d <= 7)
    .sort();
  const copies = days.flatMap((d) =>
    source.map((l) => ({ ...l, id: newKey(), day: d }))
  );
  return {
    lessons: [...lessons.filter((l) => !days.includes(l.day)), ...copies],
    preview: days.map((d) => ({
      day: d,
      before: lessons.filter((l) => l.day === d).sort((a, b) =>
        a.start.localeCompare(b.start)
      ),
      after: copies.filter((l) => l.day === d),
    })),
  };
}

/** Why a cell needs the parent's eye. Shown on the cell itself, not in a separate list. */
export function cellDoubts(row: TimetableCell): ("time" | "name" | "note")[] {
  const out: ("time" | "name" | "note")[] = [];
  if (row.included === false) return out;
  if (!isClock(row.start) || !isClock(row.end)) out.push("time");
  if (row.originalTitle && !normalizeLessonTitle(row.originalTitle).matched) {
    out.push("name");
  }
  if (row.note?.trim()) out.push("note");
  return out;
}

const DAY = 86400000;
const isoDay = (d: string) => {
  const w = new Date(d + "T12:00:00Z").getUTCDay();
  return w === 0 ? 7 : w;
};
const addDays = (d: string, n: number) =>
  new Date(new Date(d + "T12:00:00Z").getTime() + n * DAY).toISOString()
    .slice(0, 10);

export type Distribution = {
  index: number;
  planned_on: string;
  /** The rolling plan passed the due date; the item is pulled back to its due date. */
  capped: boolean;
  /** Due date is before the start day; nothing is changed for this item. */
  blocked: boolean;
};
/**
 * Spread homework over chosen weekdays from a start date, at most `perDay` a day.
 * Earliest due first; a plan date never goes past its due date.
 */
export function distributePlanDates(
  items: { index: number; due_on: string | null; planned_on: string }[],
  opts: { start: string; weekdays: number[]; perDay: number },
): Distribution[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.start)) return [];
  const weekdays = new Set(opts.weekdays.filter((d) => d >= 1 && d <= 7));
  const perDay = Math.max(1, Math.min(6, Math.floor(opts.perDay)));
  if (!weekdays.size) return [];
  const order = [...items].sort((a, b) =>
    (a.due_on ?? "9999-12-31").localeCompare(b.due_on ?? "9999-12-31") ||
    a.index - b.index
  );
  const out: Distribution[] = [];
  let day = opts.start, used = 0, guard = 0;
  const advance = () => {
    do {
      day = addDays(day, 1);
      guard++;
    } while (!weekdays.has(isoDay(day)) && guard < 800);
    used = 0;
  };
  if (!weekdays.has(isoDay(day))) advance();
  for (const item of order) {
    if (item.due_on && item.due_on < opts.start) {
      out.push({ index: item.index, planned_on: item.planned_on, capped: false, blocked: true });
      continue;
    }
    if (used >= perDay) advance();
    const capped = !!item.due_on && day > item.due_on;
    out.push({
      index: item.index,
      planned_on: capped ? item.due_on! : day,
      capped,
      blocked: false,
    });
    used++;
  }
  return out.sort((a, b) => a.index - b.index);
}

export type BagHint = { kind: "book" | "notebook" | "pe" | "art"; subject: string };
/**
 * Editable suggestions derived only from the lesson names of that day. They are GINA's
 * hints, not a school request; nothing is added until the parent chooses it.
 */
export function bagSuggestions(lessons: { title: string }[]): BagHint[] {
  const seen = new Set<string>(), out: BagHint[] = [];
  for (const l of lessons) {
    const subject = l.title.trim();
    const key = normalizeSubjectAlias(subject);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (/^(beden|spor|physicaleducation)/.test(key)) {
      out.push({ kind: "pe", subject });
    } else if (/^(gorsel|resim|art)/.test(key)) {
      out.push({ kind: "art", subject });
    } else {
      out.push({ kind: "book", subject }, { kind: "notebook", subject });
    }
  }
  return out;
}

export type SubjectBinding = {
  subject_id: string;
  label_tr: string;
  label_en: string;
};
const bindingPrefix = "gina:timetable:subjects:v1:";
/**
 * Parent-confirmed lesson name → catalogue id, per user/family/child on this device.
 * The saved timetable keeps the original lesson name; the server lesson schema does not yet
 * carry a subject id, so the binding cannot be shared across devices.
 */
export function subjectBindingStore(
  store: AnswerJournalStorage,
  user: string,
  family: string,
  child: string,
) {
  const key = bindingPrefix + [user, family, child].map(encodeURIComponent).join(":");
  const read = (): Record<string, SubjectBinding> => {
    if (!user || !family || !child) return {};
    try {
      const raw = store.get(key);
      const value = raw ? JSON.parse(raw) : {};
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  };
  return {
    read,
    bind(title: string, binding: SubjectBinding | null) {
      const name = normalizeSubjectAlias(title);
      if (!name || !user || !family || !child) return read();
      const next = { ...read() };
      if (binding) next[name] = binding;
      else delete next[name];
      store.set(key, JSON.stringify(next));
      return next;
    },
  };
}
export const bindingFor = (
  map: Record<string, SubjectBinding>,
  title: string,
) => map[normalizeSubjectAlias(title)] ?? null;
