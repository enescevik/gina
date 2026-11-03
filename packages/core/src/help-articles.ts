import { z } from "zod";
import type { AnswerJournalStorage } from "./answer-journal";
const revision = z.number().int().nonnegative();
const identity = {
  id: z.uuid(),
  locale: z.enum(["tr", "en"]),
  platform: z.enum(["all", "ios", "android", "web"]),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/),
};
export const articleCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    ...identity,
    revision,
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(10).max(20000),
  }).strict(),
  z.object({
    action: z.enum(["review", "publish", "archive"]),
    id: z.uuid(),
    revision: revision.min(1),
    reason: z.string().trim().min(3).max(500),
  }).strict(),
]);
export type ArticleCommand = z.infer<typeof articleCommandSchema>;
const pendingSchema = z.object({
  version: z.literal(1),
  request: z.uuid(),
  payload: articleCommandSchema,
}).strict();
export type PendingArticleCommand = z.infer<typeof pendingSchema>;
export const ARTICLE_OUTBOX_PREFIX = "gina.article-outbox.v1:";
export class ArticleOutbox {
  private key: string;
  constructor(
    private store: AnswerJournalStorage,
    user: string,
    private uuid: () => string,
  ) {
    this.key = ARTICLE_OUTBOX_PREFIX + z.uuid().parse(user);
  }
  restore() {
    const raw = this.store.get(this.key);
    if (raw === null) return null;
    try {
      return pendingSchema.parse(JSON.parse(raw));
    } catch {
      throw Error("article_pending_invalid");
    }
  }
  prepare(value: ArticleCommand) {
    const payload = articleCommandSchema.parse(value), old = this.restore();
    if (old) {
      if (JSON.stringify(old.payload) !== JSON.stringify(payload)) {
        throw Error("article_pending_exists");
      }
      return old;
    }
    const next = pendingSchema.parse({
      version: 1,
      request: this.uuid(),
      payload,
    });
    this.store.set(this.key, JSON.stringify(next));
    return next;
  }
  acknowledge(id: string) {
    if (this.restore()?.request === id) this.store.remove(this.key);
  }
}
export const articleVersionSchema = z.object({
  revision: revision.min(1),
  title: z.string(),
  body: z.string(),
  reviewed_at: z.string().nullable(),
});
export const editorArticleSchema = z.object({
  ...identity,
  revision: revision.min(1),
  published_revision: revision.min(1).nullable(),
  draft: articleVersionSchema,
  published: articleVersionSchema.nullable(),
});
export type EditorArticle = z.infer<typeof editorArticleSchema>;
export const editorArticleRowSchema = editorArticleSchema.omit({
  draft: true,
  published: true,
}).extend({ title: z.string(), reviewed_at: z.string().nullable() });
