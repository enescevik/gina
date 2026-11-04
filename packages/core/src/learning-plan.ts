import { z } from "zod";
import { isCalendarDate } from "./form-validation";
import type { AnswerJournalStorage } from "./answer-journal";
const id = z.uuid();
const day = z.string().refine(isCalendarDate);
const clean = (max: number, min = 0) =>
  z.string().min(min).max(max).refine((s) => s.trim() === s);
export const learningPlanContentSchema = z.object({
  catalog_id: z.string().regex(/^[a-z][a-z0-9_-]{2,79}$/).nullable().optional(),
  subject_id: z.string().regex(/^[a-z][a-z0-9_-]{2,79}$/).nullable().optional(),
  kind: z.enum(["homework", "study", "course"]),
  title: clean(120, 1),
  subject: clean(80),
  topic: clean(200),
  planned_on: day,
  due_on: day.nullable(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  steps: z.array(
    z.object({ id, label: clean(120, 1), checked: z.boolean() }).strict(),
  ).max(12)
    .refine((a) => new Set(a.map((s) => s.id)).size === a.length),
  done: z.boolean(),
  archived: z.boolean(),
  source_id: id.nullable(),
}).strict().refine((c) => !c.due_on || c.due_on >= c.planned_on);
export type LearningPlanContent = z.infer<typeof learningPlanContentSchema>;
export const learningPlanRowSchema = z.object({
  id,
  child_id: id,
  revision: z.number().int().positive(),
  content: learningPlanContentSchema,
  updated_at: z.string(),
  done_at: z.string().nullable(),
  source: z.object({ id, name: z.string(), mime: z.string() }).nullable(),
});
export type LearningPlanRow = z.infer<typeof learningPlanRowSchema>;
export const learningPlanListSchema = z.object({
  today: day,
  items: z.array(learningPlanRowSchema),
});
export const learningPlanCommandSchema = z.object({
  p_request_id: id,
  p_child_id: id,
  p_id: id,
  p_revision: z.number().int().nonnegative(),
  p_content: learningPlanContentSchema,
}).strict();
export type LearningPlanCommand = z.infer<typeof learningPlanCommandSchema>;
export function learningPlanForDay(rows: LearningPlanRow[], date: string) {
  return rows.filter((r) =>
    !r.content.archived && r.content.planned_on <= date &&
    (!r.content.done || r.content.planned_on === date ||
      r.content.due_on === date)
  );
}
export function readLearningPlanReceipt(
  value: unknown,
  c: LearningPlanCommand,
) {
  const r = z.object({
    request: id,
    child_id: id,
    id,
    revision: z.number().int().positive(),
  }).strict().parse(value);
  if (
    r.request !== c.p_request_id || r.id !== c.p_id ||
    r.child_id !== c.p_child_id || r.revision !== c.p_revision + 1
  ) throw Error("plan_receipt_invalid");
  return r;
}
export const LEARNING_PLAN_PREFIX = "gina:learning-plan:v1:";
/** One pending command per child, including a new item that has no list row yet. */
export function createLearningPlanJournal(
  { store, user, family, child, guard, uuid, send }: {
    store: AnswerJournalStorage;
    user: string;
    family: string;
    child: string;
    guard: () => void;
    uuid: () => string;
    send: (
      c: LearningPlanCommand,
    ) => Promise<
      { data: unknown; error: { code?: string; message: string } | null }
    >;
  },
) {
  const key = LEARNING_PLAN_PREFIX +
    [user, family, child].map(encodeURIComponent).join(":");
  const check = () => {
    guard();
    id.parse(user);
    id.parse(family);
    id.parse(child);
  };
  const read = () => {
    check();
    const raw = store.get(key);
    const c = raw ? learningPlanCommandSchema.parse(JSON.parse(raw)) : null;
    if (c && c.p_child_id !== child) throw Error("plan_scope_changed");
    return c;
  };
  const clear = (c: LearningPlanCommand) => {
    if (read()?.p_request_id === c.p_request_id) store.remove(key);
  };
  return {
    read,
    prepare(input: Omit<LearningPlanCommand, "p_request_id" | "p_child_id">) {
      check();
      if (store.get(key)) throw Error("plan_pending");
      const c = learningPlanCommandSchema.parse({
        ...input,
        p_child_id: child,
        p_request_id: uuid(),
      });
      store.set(key, JSON.stringify(c));
      return c;
    },
    async send(c: LearningPlanCommand) {
      if (JSON.stringify(read()) !== JSON.stringify(c)) {
        throw Error(
          "plan_command_changed",
        );
      }
      const result = await send(c);
      check();
      if (result.error) {
        if (
          /^(P0001|42501|22\w{3}|23\w{3})$/.test(result.error.code ?? "")
        ) clear(c);
        throw result.error;
      }
      const receipt = readLearningPlanReceipt(result.data, c);
      clear(c);
      return receipt;
    },
  };
}
