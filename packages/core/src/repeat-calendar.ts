import { z } from "zod";
import { isCalendarDate } from "./form-validation";
import { type PlanCalendarDraft } from "./study-plan";
const id = z.uuid();
export const repeatCalendarSourceSchema = z.object({
  attempt_id: id,
  child_id: id,
  child_name: z.string(),
  grade: z.number().int().nullable(),
  timezone: z.string(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  questions: z.array(
    z.object({
      id,
      position: z.number().int().positive(),
      stem: z.string(),
      subject: z.string(),
      topic: z.string().nullable(),
      state: z.enum(["wrong", "partial"]),
    }),
  ),
  scheduled: z.object({
    question_ids: z.array(id),
    questions: z.array(
      z.object({ id, position: z.number().int().positive(), stem: z.string() }),
    ),
    items: z.array(
      z.object({
        step: z.number().int(),
        event_id: id.nullable(),
        title: z.string().nullable(),
        starts_at: z.string().nullable(),
        ends_at: z.string().nullable(),
      }),
    ),
  }).nullable(),
});
export type RepeatCalendarSource = z.infer<typeof repeatCalendarSourceSchema>;
export const repeatCalendarCommandSchema = z.object({
  p_request_id: id,
  p_attempt_id: id,
  p_source_hash: z.string().regex(/^[a-f0-9]{64}$/),
  p_question_ids: z.array(id).min(1).max(100).refine((a) =>
    new Set(a).size === a.length
  ),
  p_items: z.array(
    z.object({
      day: z.number().int().min(1).max(3),
      title: z.string().trim().min(1).max(120),
      notes: z.string().trim().min(1).max(1200),
      starts_at: z.iso.datetime({ offset: true }),
      minutes: z.number().int().min(5).max(60),
    }).strict(),
  ).min(1).max(3).refine((a) => new Set(a.map((x) => x.day)).size === a.length),
}).strict();
export type RepeatCalendarCommand = z.infer<typeof repeatCalendarCommandSchema>;
/** Editable planning suggestions, not a diagnosed or optimal learning interval. */
export function makeRepeatCalendarDrafts(
  today: string,
  title: string,
  notes: string,
): PlanCalendarDraft[] {
  if (!isCalendarDate(today)) throw Error("plan_invalid");
  return [1, 3, 7].map((offset, i) => ({
    day: i + 1,
    title,
    notes,
    date: new Date(Date.parse(today) + offset * 86400000).toISOString().slice(
      0,
      10,
    ),
    time: "17:00",
    minutes: 15,
    selected: false,
  }));
}
export function readRepeatCalendarReceipt(
  value: unknown,
  c: RepeatCalendarCommand,
) {
  const r = z.object({
    request: id,
    attempt_id: id,
    items: z.array(z.object({ day: z.number().int(), event_id: id }).strict()),
  }).strict().parse(value);
  if (
    r.request !== c.p_request_id || r.attempt_id !== c.p_attempt_id ||
    r.items.length !== c.p_items.length ||
    new Set(r.items.map((x) => x.day)).size !== r.items.length ||
    new Set(r.items.map((x) => x.event_id)).size !== r.items.length ||
    r.items.some((x) => !c.p_items.some((i) => i.day === x.day))
  ) throw Error("repeat_receipt_invalid");
  return r;
}
