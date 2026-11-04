import { z } from "zod";
import { isCalendarDate } from "./form-validation";
const id = z.uuid();
const day = z.string().refine(isCalendarDate);
const items = z.array(
  z.object({
    id,
    label: z.string().min(1).max(80).refine((v) =>
      v.trim() === v && v.length > 0
    ),
    checked: z.boolean(),
    catalog_id: z.string().regex(/^[a-z][a-z0-9_-]{2,79}$/).nullable().optional(),
  }).strict(),
).max(30).refine((a) =>
  new Set(a.map((x) => x.id)).size === a.length &&
  new Set(a.map((x) => x.label)).size === a.length
);
export const schoolBagSourceSchema = z.object({
  child_id: id,
  day,
  today: day,
  timezone: z.string(),
  editable: z.boolean(),
  revision: z.number().int().nonnegative(),
  program_revision: z.number().int().nonnegative(),
  saved_program_revision: z.number().int().nonnegative().nullable(),
  items,
  lessons: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      start: z.string(),
      end: z.string(),
    }),
  ),
});
export type SchoolBagSource = z.infer<typeof schoolBagSourceSchema>;
export type SchoolBagItem = SchoolBagSource["items"][number];
export const schoolBagCommandSchema = z.object({
  p_request_id: id,
  p_child_id: id,
  p_day: day,
  p_revision: z.number().int().nonnegative(),
  p_program_revision: z.number().int().nonnegative(),
  p_items: items,
}).strict();
export type SchoolBagCommand = z.infer<typeof schoolBagCommandSchema>;
export function readSchoolBagReceipt(value: unknown, c: SchoolBagCommand) {
  const r = z.object({
    request: id,
    child_id: id,
    day,
    revision: z.number().int().positive(),
  }).strict().parse(value);
  if (
    r.request !== c.p_request_id || r.child_id !== c.p_child_id ||
    r.day !== c.p_day || r.revision !== c.p_revision + 1
  ) throw Error("bag_receipt_invalid");
  return r;
}
export function schoolBagDayAvailable(value: string, today: string) {
  if (!isCalendarDate(value) || !isCalendarDate(today)) return false;
  const offset = (Date.parse(value) - Date.parse(today)) / 86400000;
  return offset >= -30 && offset <= 7;
}
