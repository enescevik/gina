import { z } from "zod";
import type { AnswerJournalStorage } from "./answer-journal";
export const PROVA_GENERATION_PREFIX = "gina:prova:generation:v1:";
export const generationPayloadSchema = z.object({
  draft_id: z.uuid(),
  subject: z.string().trim().min(1).max(80),
  grade: z.number().int().min(1).max(12),
  topic_plan: z.array(
    z.object({
      topic: z.string().trim().min(1).max(200),
      count: z.number().int().min(1).max(30),
    }).strict(),
  ).min(1).max(30),
  blueprint_id: z.uuid().nullable(),
  count: z.number().int().min(1).max(30),
  kind: z.enum(["mixed", "multiple_choice", "open_ended"]),
  assessment: z.enum(["written", "practice"]),
  difficulty: z.enum(["kolay", "orta", "orta_ustu", "zor"]),
  note: z.string().max(1500),
  locale: z.enum(["tr", "en"]),
  source_id: z.uuid().optional(),
  ai_consent: z.literal(true).optional(),
}).strict().refine((p) =>
  p.topic_plan.reduce((n, r) => n + r.count, 0) === p.count &&
  new Set(p.topic_plan.map((r) => r.topic)).size === p.topic_plan.length &&
  (!p.source_id || p.ai_consent === true)
);
const choice = z.object({ key: z.string(), text: z.string() });
export const generationResultSchema = z.object({
  ok: z.literal(true),
  model: z.string().min(1),
  prompt_version: z.string().min(1),
  remaining: z.number().int().min(0),
  questions: z.array(z.object({
    id: z.uuid(),
    topic: z.string(),
    kind: z.enum(["multiple_choice", "open_ended"]),
    difficulty: z.enum(["kolay", "orta", "orta_ustu", "zor"]),
    stem: z.string().min(1),
    choices: z.array(choice).nullable(),
    correct_key: z.string().nullable(),
    expected_answer: z.string().nullable(),
    solution: z.string().nullable(),
    explanation: z.string().nullable(),
    source_urls: z.array(z.string()),
    /** D1: set when the server grouped linked AI questions into one shared-source group. */
    group_id: z.uuid().optional(),
    prompt: z.string().optional(),
    position: z.number().int().min(1).max(12).optional(),
    /** D10: kişi adı uyarısı özeti (status + flags). Biçimi `questionContentReviewOf` savunmacı okur; bozuk değer
     * ayrıştırmayı düşürmez (uyarı yalnız gösterilmez). */
    content_review: z.unknown().optional(),
  })).min(1).max(30),
  groups: z.array(z.object({
    id: z.uuid(),
    title: z.string().min(1),
    body: z.string(),
    kind: z.string().nullable().optional(),
    question_ids: z.array(z.uuid()).min(2).max(12),
  })).optional(),
});
const recordSchema = z.object({
  request_id: z.uuid(),
  payload: generationPayloadSchema,
  result: generationResultSchema.optional(),
  safeFailure: z.literal(true).optional(),
}).strict();
export type ProvaGenerationRecord = z.infer<typeof recordSchema>;
export type ProvaGenerationPayload = z.infer<typeof generationPayloadSchema>;
export function createProvaGenerationJournal(
  { store, user, family, draft, id, guard }: {
    store: AnswerJournalStorage;
    user: string;
    family: string;
    draft: string;
    id: () => string;
    guard: () => void;
  },
) {
  const key = PROVA_GENERATION_PREFIX +
    [user, family, draft].map(encodeURIComponent).join(":");
  const check = () => {
    guard();
    z.uuid().parse(user);
    z.uuid().parse(family);
    z.uuid().parse(draft);
  };
  const read = () => {
    check();
    const value = store.get(key);
    if (!value) return null;
    const r = recordSchema.parse(JSON.parse(value));
    if (r.payload.draft_id !== draft) throw Error("generation_scope_changed");
    return r;
  };
  const same = (r: ProvaGenerationRecord) => {
    const current = read();
    if (
      !current || current.request_id !== r.request_id ||
      JSON.stringify(current.payload) !== JSON.stringify(r.payload)
    ) throw Error("generation_request_changed");
    return current;
  };
  return {
    read,
    prepare(payload: ProvaGenerationPayload) {
      if (read()) throw Error("generation_pending");
      const r = recordSchema.parse({ request_id: id(), payload });
      if (r.payload.draft_id !== draft) throw Error("generation_scope_changed");
      store.set(key, JSON.stringify(r));
      return r;
    },
    complete(r: ProvaGenerationRecord, value: unknown) {
      const current = same(r), result = generationResultSchema.parse(value);
      if (
        result.questions.length !== current.payload.count ||
        new Set(result.questions.map((q) => q.id)).size !==
          result.questions.length
      ) throw Error("generation_result_invalid");
      const next = recordSchema.parse({
        ...current,
        result,
        safeFailure: undefined,
      });
      store.set(key, JSON.stringify(next));
      return next;
    },
    failed(r: ProvaGenerationRecord) {
      const current = same(r);
      if (current.result) throw Error("generation_request_changed");
      const next = { ...current, safeFailure: true as const };
      store.set(key, JSON.stringify(next));
      return next;
    },
    cancel(r: ProvaGenerationRecord, ack: unknown) {
      same(r);
      const value = z.object({
        request_id: z.uuid(),
        status: z.literal("cancelled"),
      }).parse(ack);
      if (value.request_id !== r.request_id) {
        throw Error("generation_request_changed");
      }
      store.remove(key);
    },
    release() {
      const current = read();
      if (current && !current.result) {
        throw Error("generation_result_uncertain");
      }
      store.remove(key);
    },
  };
}
