import { z } from "zod";
import type { AnswerJournalStorage } from "./answer-journal";
export const SETUP_AI_PREFIX = "gina:setup:ai:v1:";
const payload = z.object({
  kind: z.enum(["task", "reward"]),
  grade: z.number().int().min(0).max(12).nullable(),
  age_band: z.enum(["2-5", "6-9", "10-13", "14-18"]).nullable(),
  interests: z.array(z.string().max(40)).max(12),
  locale: z.enum(["tr", "en"]),
  source_id: z.uuid().optional(),
  source_ai_consent: z.literal(true).optional(),
}).strict().refine((p) => !p.source_id || p.source_ai_consent === true);
const result = z.object({
  suggestions: z.array(
    z.object({
      title: z.string().min(1).max(80),
      reason: z.string().max(240),
      stars: z.number().int().min(0).max(999),
      icon: z.string().max(80),
      source_id: z.uuid().optional(),
    }).strict(),
  ).max(3),
  document_notes: z.string().max(500).optional(),
}).strict();
const record = z.object({
  request_id: z.uuid(),
  payload,
  name: z.string().max(255).optional(),
  result: result.optional(),
}).strict();
export type SetupAiRecord = z.infer<typeof record>;
export type SetupAiResult = z.infer<typeof result>;
/** Persist request identity BEFORE upload/generation. Never silently replace an uncertain request. */
export function createSetupAiJournal({
  store,
  user,
  family,
  context,
  kind,
  id,
  guard,
}: {
  store: AnswerJournalStorage;
  user: string;
  family: string;
  context: string;
  kind: "task" | "reward";
  id: () => string;
  guard: () => void;
}) {
  const key = SETUP_AI_PREFIX +
    [user, family, kind, context].map(encodeURIComponent).join(":");
  const check = () => {
    guard();
    z.uuid().parse(user);
    z.uuid().parse(family);
  };
  const read = () => {
    check();
    const raw = store.get(key);
    if (!raw) return null;
    const r = record.parse(JSON.parse(raw));
    if (r.payload.kind !== kind) throw Error("setup_scope_changed");
    return r;
  };
  return {
    read,
    prepare(input: SetupAiRecord["payload"], name?: string) {
      check();
      if (store.get(key)) throw Error("setup_pending");
      const r = record.parse({
        request_id: id(),
        payload: input,
        ...(name ? { name } : {}),
      });
      store.set(key, JSON.stringify(r));
      return r;
    },
    complete(request: SetupAiRecord, value: SetupAiResult) {
      const current = read();
      if (
        !current || current.request_id !== request.request_id ||
        JSON.stringify(current.payload) !== JSON.stringify(request.payload)
      ) throw Error("setup_command_changed");
      const r = record.parse({ ...current, result: value });
      if (
        r.result?.suggestions.some((s) => s.source_id !== r.payload.source_id)
      ) throw Error("setup_source_changed");
      store.set(key, JSON.stringify(r));
      return r;
    },
    discard() {
      check();
      store.remove(key);
    },
  };
}
