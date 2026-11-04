import { z } from "zod";
import type { AnswerJournalStorage } from "./answer-journal";
import { curriculumCandidateSchema } from "./curriculum-review";
export const catalogScenarioSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().min(1),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/),
  candidate: curriculumCandidateSchema,
  programme: z.string().min(1),
  school_scope: z.string().min(1),
  programme_url: z.url({ protocol: /^https$/ }),
});
export type CatalogScenario = z.infer<typeof catalogScenarioSchema>;
export const catalogBlueprintInputSchema = z.object({
  child_id: z.uuid(),
  catalogue_id: z.uuid(),
  revision: z.number().int().min(1),
  subject: z.string().trim().min(1).max(80),
  confirmed: z.literal(true),
}).strict();
export type CatalogBlueprintInput = z.infer<typeof catalogBlueprintInputSchema>;
const catalogBlueprintCommandSchema = z.object({
  p_request_id: z.uuid(),
  p_input: catalogBlueprintInputSchema,
}).strict();
export type CatalogBlueprintCommand = z.infer<
  typeof catalogBlueprintCommandSchema
>;
export const CATALOG_BLUEPRINT_PREFIX = "gina:catalog-blueprint:command:v1:";
export function createCatalogBlueprintJournal({
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
    command: CatalogBlueprintCommand,
  ) => Promise<
    { data: unknown; error: { code?: string; message: string } | null }
  >;
}) {
  const key = CATALOG_BLUEPRINT_PREFIX +
    [user, family].map(encodeURIComponent).join(":");
  const read = () => {
    guard();
    z.uuid().parse(user);
    z.uuid().parse(family);
    const value = store.get(key);
    return value
      ? catalogBlueprintCommandSchema.parse(JSON.parse(value))
      : null;
  };
  return {
    read,
    prepare(input: CatalogBlueprintInput) {
      read();
      if (store.get(key)) throw Error("blueprint_pending");
      const command = catalogBlueprintCommandSchema.parse({
        p_request_id: id(),
        p_input: input,
      });
      store.set(key, JSON.stringify(command));
      return command;
    },
    async send(command: CatalogBlueprintCommand) {
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

export function canonicalSubject(value: string) {
  return value === "İlköğretim Matematik"
    ? "Matematik"
    : value === "Fen"
    ? "Fen Bilimleri"
    : value;
}
/** UI filtering only. Generation independently checks the private binding and live child in SQL. */
export function catalogBlueprintFits(
  context: unknown,
  childId: string,
  purpose: string,
) {
  if (
    !context || typeof context !== "object" || !("origin" in context) ||
    context.origin !== "reviewed_catalogue"
  ) return true;
  return purpose === "written" && "child_id" in context &&
    context.child_id === childId;
}
