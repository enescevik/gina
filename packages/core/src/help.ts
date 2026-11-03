import { z } from "zod";
import type { AnswerJournalStorage } from "./answer-journal";

export const helpStatusSchema = z.enum([
  "open",
  "in_progress",
  "waiting_parent",
  "resolved",
  "closed",
]);
export const helpKindSchema = z.enum(["support", "idea"]);
export const helpCategorySchema = z.enum([
  "account",
  "device",
  "learning",
  "billing",
  "other",
]);
const body = z.string().trim().min(1).max(6000);
export const helpCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    kind: helpKindSchema,
    category: helpCategorySchema,
    subject: z.string().trim().min(3).max(160),
    body,
  }).strict(),
  z.object({
    action: z.literal("reply"),
    ticket: z.uuid(),
    revision: z.number().int().positive(),
    body,
    status: z.enum(["open", "closed"]).optional(),
  }).strict(),
]);
export type HelpCommand = z.infer<typeof helpCommandSchema>;
const pendingSchema = z.object({
  version: z.literal(1),
  id: z.uuid(),
  payload: helpCommandSchema,
}).strict();
export type PendingHelpCommand = z.infer<typeof pendingSchema>;
export const HELP_OUTBOX_PREFIX = "gina.help-outbox.v1:";
/** One immutable uncertain command per parent/family. Persist before sending,
 * restore after termination and replay the same server receipt on explicit retry. */
export class HelpOutbox {
  private key: string;
  constructor(
    private store: AnswerJournalStorage,
    user: string,
    family: string,
    private id: () => string,
  ) {
    this.key = HELP_OUTBOX_PREFIX + z.uuid().parse(user) + ":" +
      z.uuid().parse(family);
  }
  restore(): PendingHelpCommand | null {
    const raw = this.store.get(this.key);
    if (raw === null) return null;
    try {
      return pendingSchema.parse(JSON.parse(raw));
    } catch {
      throw new Error("help_local_invalid");
    }
  }
  prepare(payload: HelpCommand): PendingHelpCommand {
    const value = helpCommandSchema.parse(payload), existing = this.restore();
    if (existing) {
      if (JSON.stringify(existing.payload) !== JSON.stringify(value)) {
        throw new Error("help_pending_exists");
      }
      return existing;
    }
    const command = pendingSchema.parse({
      version: 1,
      id: this.id(),
      payload: value,
    });
    this.store.set(this.key, JSON.stringify(command));
    return command;
  }
  acknowledge(id: string) {
    const existing = this.restore();
    if (existing?.id === id) this.store.remove(this.key);
  }
}
export const helpReceiptSchema = z.object({
  id: z.uuid(),
  revision: z.number().int().positive(),
  status: helpStatusSchema,
});
export const helpTicketSchema = z.object({
  id: z.uuid(),
  kind: helpKindSchema,
  category: helpCategorySchema,
  subject: z.string(),
  status: helpStatusSchema,
  revision: z.number().int().positive(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});
export type HelpTicket = z.infer<typeof helpTicketSchema>;
export const helpMessageSchema = z.object({
  sequence: z.number().int().positive().safe(),
  author_role: z.enum(["parent", "support"]),
  visibility: z.enum(["family", "internal"]),
  body: z.string(),
  created_at: z.iso.datetime({ offset: true }),
});
export const helpThreadSchema = helpTicketSchema.omit({
  created_at: true,
  updated_at: true,
}).extend({ messages: z.array(helpMessageSchema) });
export type HelpThread = z.infer<typeof helpThreadSchema>;
export const helpArticleSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  locale: z.enum(["tr", "en"]),
  platform: z.enum(["all", "ios", "android", "web"]),
  revision: z.number().int().positive(),
  published_revision: z.number().int().positive().nullable(),
  title: z.string(),
  body: z.string(),
  reviewed_at: z.iso.datetime({ offset: true }).nullable(),
});
export type HelpArticle = z.infer<typeof helpArticleSchema>;
export function definitiveHelpFailure(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  // Constraint/input/authorization exceptions roll back this SQL command. A
  // transport error or missing response never proves that it did not commit.
  return typeof error.code === "string" &&
    /^(P0001|42501|22\w+|23\w+)$/.test(error.code);
}
