import { z } from "zod";
import { validateLessons, validLessonSettings } from "./timetable";
export const timetableCommandSchema = z.object({
  p_request_id: z.uuid(),
  p_child_id: z.uuid(),
  p_revision: z.number().int().nonnegative(),
  p_lessons: z.array(
    z.object({
      id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
      day: z.number().int().min(1).max(7),
      title: z.string().min(1).max(120),
      start: z.string(),
      end: z.string(),
      // C02: server-stamped catalogue id; the server rejects a value the parent did not confirm.
      subject_id: z.string().regex(/^subject-[a-z0-9-]+$/).nullable().optional(),
    }).strict(),
  ).max(112).refine((lessons) => !validateLessons(lessons)),
  p_settings: z.object({
    start: z.string(),
    duration: z.number().int(),
    break: z.number().int(),
  }).strict().refine(validLessonSettings),
}).strict();
export type TimetableCommand = z.infer<typeof timetableCommandSchema>;
export function readTimetableReceipt(
  value: unknown,
  command: TimetableCommand,
) {
  const result = z.object({
    request: z.uuid(),
    child_id: z.uuid(),
    revision: z.number().int().positive(),
    // 20261106090000_dated_plan_history adds the applied date to the receipt.
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  }).strict().parse(value);
  if (
    result.request !== command.p_request_id ||
    result.child_id !== command.p_child_id ||
    result.revision !== command.p_revision + 1
  ) {
    throw Error("timetable_receipt_invalid");
  }
  return result;
}

/**
 * C02: lessons as sent to `save_school_timetable_request`. Only the five editable fields travel; the
 * subject id is the server's (parent-confirmed link, stamped on save), so a renamed lesson can never
 * carry a stale id and old receipts keep matching.
 */
export function lessonsForSave<T extends { id: string; day: number; title: string; start: string; end: string }>(
  lessons: readonly T[],
): { id: string; day: number; title: string; start: string; end: string }[] {
  return lessons.map(({ id, day, title, start, end }) => ({ id, day, title, start, end }));
}
