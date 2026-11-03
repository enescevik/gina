import { z } from "zod";
import type { AnswerJournalStorage } from "./answer-journal";
import { helpStatusSchema } from "./help";
export const operatorHelpCommandSchema = z.object({
  ticket: z.uuid(),
  revision: z.number().int().positive(),
  body: z.string().trim().min(1).max(6000),
  internal: z.boolean(),
  status: helpStatusSchema.nullable(),
}).strict();
export type OperatorHelpCommand = z.infer<typeof operatorHelpCommandSchema>;
const pendingSchema = z.object({
  version: z.literal(1),
  id: z.uuid(),
  payload: operatorHelpCommandSchema,
}).strict();
export type PendingOperatorHelp = z.infer<typeof pendingSchema>;
export const OPERATOR_HELP_PREFIX = "gina.operator-help.v1:";
/** Immutable until a receipt or definite SQL rejection. Never repurpose an
 * internal-note receipt as a family-visible reply, including after a reload. */
export class OperatorHelpOutbox {
  private key: string;
  constructor(
    private store: AnswerJournalStorage,
    user: string,
    private uuid: () => string,
  ) {
    this.key = OPERATOR_HELP_PREFIX + z.uuid().parse(user);
  }
  restore(): PendingOperatorHelp | null {
    const raw = this.store.get(this.key);
    if (raw === null) return null;
    try {
      return pendingSchema.parse(JSON.parse(raw));
    } catch {
      throw new Error("operator_help_invalid");
    }
  }
  prepare(payload: OperatorHelpCommand): PendingOperatorHelp {
    const value = operatorHelpCommandSchema.parse(payload),
      old = this.restore();
    if (old) {
      if (JSON.stringify(old.payload) !== JSON.stringify(value)) {
        throw new Error("operator_help_pending");
      }
      return old;
    }
    const next = pendingSchema.parse({
      version: 1,
      id: this.uuid(),
      payload: value,
    });
    this.store.set(this.key, JSON.stringify(next));
    return next;
  }
  acknowledge(id: string) {
    if (this.restore()?.id === id) this.store.remove(this.key);
  }
}
