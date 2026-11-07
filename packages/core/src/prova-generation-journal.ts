import { z } from "zod";
import type { AnswerJournalStorage } from "./answer-journal";
import { LEGACY_INTERACTION_TYPES, PHASE2A_INTERACTION_TYPES, PHASE2B_INTERACTION_TYPES, STRUCTURED_INTERACTION_TYPES } from "./question-types";
/**
 * QT-AI: AI tür seçiminde gönderilebilecek türler. 1A/1B prova-generate `parseInteractionTypes` ile aynı;
 * 2A/2B istemcide faz anahtarının arkasındadır (sunucu bu türleri henüz üretmez → `interaction_types_invalid`).
 */
export const AI_INTERACTION_TYPES = [...LEGACY_INTERACTION_TYPES, ...STRUCTURED_INTERACTION_TYPES, ...PHASE2A_INTERACTION_TYPES, ...PHASE2B_INTERACTION_TYPES] as const;
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
  use_favorite_style: z.literal(true).optional(),
  /** QT-AI: isteğe bağlı tür seçimi. Yoksa istek gövdesi eski davranışla birebir aynıdır (eski kayıtlar da yüklenir). */
  interaction_types: z.array(z.enum(AI_INTERACTION_TYPES)).min(1).max(AI_INTERACTION_TYPES.length).optional(),
}).strict().refine((p) =>
  (!p.interaction_types || new Set(p.interaction_types).size === p.interaction_types.length) &&
  p.topic_plan.reduce((n, r) => n + r.count, 0) === p.count &&
  new Set(p.topic_plan.map((r) => r.topic)).size === p.topic_plan.length &&
  (!p.source_id || p.ai_consent === true) &&
  (!p.use_favorite_style || (p.assessment === "practice" && !p.source_id && !p.blueprint_id))
);
const choice = z.object({ key: z.string(), text: z.string() });
function withoutStructuredKeys<T extends { questions: { answer_key?: unknown }[] }>(result: T): T {
  return { ...result, questions: result.questions.map(({ answer_key: _k, ...q }) => q) };
}

export const generationResultSchema = z.object({
  ok: z.literal(true),
  model: z.string().min(1),
  prompt_version: z.string().min(1),
  remaining: z.number().int().min(0),
  questions: z.array(z.object({
    id: z.uuid(),
    topic: z.string(),
    kind: z.enum(["multiple_choice", "open_ended", "structured"]),
    /** QT-AI: yapılandırılmış satırda tür + öğrenci içeriği + veliye dönen özel anahtar (complete_prova_generation). */
    interaction_type: z.enum([...STRUCTURED_INTERACTION_TYPES, ...PHASE2A_INTERACTION_TYPES, ...PHASE2B_INTERACTION_TYPES]).optional(),
    schema_version: z.number().int().optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    answer_key: z.record(z.string(), z.unknown()).optional(),
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
    // Eski bir kayıtta anahtar kalmışsa okunurken de atılır.
    return r.result ? { ...r, result: withoutStructuredKeys(r.result) } : r;
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
      // QT: yapılandırılmış satırların özel cevap anahtarı cihaz depolamasına yazılmaz (telefonda çocuk modu);
      // önizleme anahtarı gerektiğinde get_question_answer_keys ile sunucudan okunur.
      const next = recordSchema.parse({
        ...current,
        result: withoutStructuredKeys(result),
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
