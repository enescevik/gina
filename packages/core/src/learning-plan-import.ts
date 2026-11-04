import { z } from "zod";
import { isCalendarDate } from "./form-validation";
import { learningPlanContentSchema } from "./learning-plan";
import type { AnswerJournalStorage } from "./answer-journal";
const id = z.uuid();
const text = (max: number, min = 0) => z.string().min(min).max(max);
export const learningPlanImportDraftSchema = z.object({
  items: z.array(
    z.object({
      kind: z.enum(["homework", "study", "course"]),
      title: text(120, 1),
      subject: text(80),
      topic: text(200),
      due_on: z.string().refine(isCalendarDate).nullable(),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      steps: z.array(text(120, 1)).max(12),
      page: z.number().int().min(1).max(5),
      note: text(400),
    }).strict(),
  ).max(12),
  warnings: z.array(text(400, 1)).max(10),
}).strict();
export const learningPlanImportViewSchema = z.object({
  id,
  child_id: id,
  source_id: id,
  locale: z.enum(["tr", "en"]),
  grade: z.number().int().nullable(),
  status: z.enum(["new", "working", "done", "failed", "uncertain"]),
  draft: learningPlanImportDraftSchema.nullable(),
  applied: z.record(z.string().regex(/^\d+$/), id),
}).strict();
export type LearningPlanImportView = z.infer<
  typeof learningPlanImportViewSchema
>;
export const learningPlanImportCommandSchema = z.object({
  p_request_id: id,
  p_child_id: id,
  p_import_id: id,
  p_items: z.array(
    z.object({
      index: z.number().int().min(0).max(11),
      id,
      content: learningPlanContentSchema,
    }).strict(),
  ).min(1).max(12).refine((a) =>
    new Set(a.map((v) => v.index)).size === a.length &&
    new Set(a.map((v) => v.id)).size === a.length
  ),
}).strict();
export type LearningPlanImportCommand = z.infer<
  typeof learningPlanImportCommandSchema
>;
export const LEARNING_IMPORT_PREFIX = "gina:learning-plan-import:v1:";
export function createLearningPlanImportJournal({
  store,
  user,
  family,
  child,
  guard,
  uuid,
  send,
}: {
  store: AnswerJournalStorage;
  user: string;
  family: string;
  child: string;
  guard: () => void;
  uuid: () => string;
  send: (
    c: LearningPlanImportCommand,
  ) => Promise<
    { data: unknown; error: { code?: string; message: string } | null }
  >;
}) {
  const key = LEARNING_IMPORT_PREFIX +
    [user, family, child].map(encodeURIComponent).join(":");
  function read() {
    guard();
    id.parse(user);
    id.parse(family);
    id.parse(child);
    const raw = store.get(key);
    const c = raw
      ? learningPlanImportCommandSchema.parse(JSON.parse(raw))
      : null;
    if (c && c.p_child_id !== child) throw Error("plan_scope_changed");
    return c;
  }
  function clear(c: LearningPlanImportCommand) {
    if (read()?.p_request_id === c.p_request_id) store.remove(key);
  }
  return {
    read,
    prepare(input: Pick<LearningPlanImportCommand, "p_import_id" | "p_items">) {
      if (read()) throw Error("plan_pending");
      const c = learningPlanImportCommandSchema.parse({
        ...input,
        p_request_id: uuid(),
        p_child_id: child,
      });
      store.set(key, JSON.stringify(c));
      return c;
    },
    async send(c: LearningPlanImportCommand) {
      if (JSON.stringify(read()) !== JSON.stringify(c)) {
        throw Error("plan_command_changed");
      }
      const r = await send(c);
      guard();
      if (r.error) {
        if (/^(P0001|42501|22\w{3}|23\w{3})$/.test(r.error.code ?? "")) {
          clear(c);
        }
        throw r.error;
      }
      const receipt = z.object({
        request: id,
        import: id,
        child: id,
        ids: z.array(id),
      }).strict().parse(r.data);
      if (
        receipt.request !== c.p_request_id ||
        receipt.import !== c.p_import_id || receipt.child !== child ||
        JSON.stringify(receipt.ids) !==
          JSON.stringify(c.p_items.map((i) => i.id))
      ) throw Error("plan_receipt_invalid");
      clear(c);
      return receipt;
    },
  };
}
