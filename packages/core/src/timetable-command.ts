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
