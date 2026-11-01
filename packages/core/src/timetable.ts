export interface Lesson {
  id: string;
  day: number;
  title: string;
  start: string;
  end: string;
}
export interface LessonSettings {
  start: string;
  duration: number;
  break: number;
}
export const DEFAULT_LESSON_SETTINGS: LessonSettings = {
  start: "09:00",
  duration: 40,
  break: 10,
};
export function clockMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m;
}
export function minutesClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function validLessonSettings(s: LessonSettings): boolean {
  return (
    /^([01]\d|2[0-3]):[0-5]\d$/.test(s.start) &&
    Number.isInteger(s.duration) &&
    s.duration >= 5 &&
    s.duration <= 180 &&
    Number.isInteger(s.break) &&
    s.break >= 0 &&
    s.break <= 120
  );
}
export function validateLessons(
  lessons: Lesson[],
): "invalid" | "overlap" | null {
  const ids = new Set<string>();
  if (lessons.length > 112) return "invalid";
  for (const l of lessons) {
    if (
      !/^[a-zA-Z0-9_-]{1,64}$/.test(l.id) ||
      ids.has(l.id) ||
      !Number.isInteger(l.day) ||
      l.day < 1 ||
      l.day > 7 ||
      !l.title.trim() ||
      l.title.trim().length > 120 ||
      ![l.start, l.end].every((v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) ||
      l.end <= l.start
    )
      return "invalid";
    ids.add(l.id);
  }
  return lessons.some((a, i) =>
    lessons
      .slice(i + 1)
      .some((b) => a.day === b.day && a.start < b.end && b.start < a.end),
  )
    ? "overlap"
    : null;
}
export function nextLessonTimes(
  lessons: Lesson[],
  day: number,
  s: LessonSettings,
): { start: string; end: string } | null {
  const end = lessons
    .filter((l) => l.day === day)
    .map((l) => clockMinutes(l.end));
  const start = end.length ? Math.max(...end) + s.break : clockMinutes(s.start);
  return start + s.duration < 1440
    ? { start: minutesClock(start), end: minutesClock(start + s.duration) }
    : null;
}
