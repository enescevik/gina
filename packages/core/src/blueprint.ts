import { z } from "zod";
import type { AnswerJournalStorage } from "./answer-journal";
const year = z.string().regex(/^20\d{2}-20\d{2}$/).refine((v) =>
  Number(v.slice(5)) === Number(v.slice(0, 4)) + 1
);
export const blueprintInputSchema = z.object({
  child_id: z.uuid(),
  grade: z.number().int().min(1).max(12),
  subject: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(100),
  academic_year: year,
  term: z.number().int().min(1).max(2),
  exam: z.number().int().min(1).max(2),
  rows: z.array(
    z.object({
      topic: z.string().trim().min(1).max(200),
      count: z.number().int().min(1).max(30),
    }).strict(),
  ).min(1).max(30),
  source_url: z.string().max(2000).refine((v) =>
    !v || z.url({protocol:/^https$/}).safeParse(v).success
  ),
  confirmed: z.literal(true),
  // C01: velinin "okulun senaryosunu biliyorum/bilmiyorum" beyanı ve kişiselleştirme metadata'sı. İsteğe bağlı:
  // eski kayıtlı komutlar (yerel günlük) aynen okunur; sunucu yokluğu "sorulmadı" sayar. Okul onayı değildir.
  school_scenario: z.enum(["known", "unknown"]).optional(),
  personalization: z.object({
    basis: z.literal("catalogue_seed"),
    base_label: z.string().trim().min(1).max(200),
    base_total: z.number().int().min(1).max(30),
    base_blocks: z.number().int().min(1).max(30),
  }).strict().optional(),
}).strict().refine((v) =>
  v.rows.reduce((s, r) => s + r.count, 0) <= 30 &&
  new Set(v.rows.map((r) => r.topic)).size === v.rows.length
);
export type BlueprintInput = z.infer<typeof blueprintInputSchema>;
const commandSchema = z.object({
  p_request_id: z.uuid(),
  p_input: blueprintInputSchema,
}).strict();
export type BlueprintCommand = z.infer<typeof commandSchema>;
export const BLUEPRINT_PREFIX = "gina:blueprint:command:v1:";
export function createBlueprintJournal({
  store,
  user,
  family,
  id,
  guard,
  send,
}: {
  store: AnswerJournalStorage;
  user: string;
  family: string;
  id: () => string;
  guard: () => void;
  send: (
    command: BlueprintCommand,
  ) => Promise<
    { data: unknown; error: { code?: string; message: string } | null }
  >;
}) {
  const key = BLUEPRINT_PREFIX +
    [user, family].map(encodeURIComponent).join(":");
  const read = () => {
    guard();
    z.uuid().parse(user);
    z.uuid().parse(family);
    const value = store.get(key);
    return value ? commandSchema.parse(JSON.parse(value)) : null;
  };
  return {
    read,
    prepare(input: BlueprintInput) {
      read();
      if (store.get(key)) throw Error("blueprint_pending");
      const command = commandSchema.parse({
        p_request_id: id(),
        p_input: input,
      });
      store.set(key, JSON.stringify(command));
      return command;
    },
    async send(command: BlueprintCommand) {
      if (JSON.stringify(read()) !== JSON.stringify(command)) {
        throw Error("blueprint_changed");
      }
      const result = await send(command);
      guard();
      if (result.error) {
        if (
          /^(P0001|42501|22\w{3}|23\w{3})$/.test(result.error.code ?? "") &&
          read()?.p_request_id === command.p_request_id
        ) store.remove(key);
        throw result.error;
      }
      const parsed = z.uuid().parse(result.data);
      if (read()?.p_request_id === command.p_request_id) store.remove(key);
      return parsed;
    },
  };
}
