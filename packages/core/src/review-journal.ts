import { z } from "zod";
import { notebookSchema } from "./notebook";
import type { AnswerJournalStorage } from "./answer-journal";

export const REVIEW_JOURNAL_PREFIX = "gina.review-journal.v1:";
export const reviewDraftSchema = z.object({
  score: z.string().max(3),
  feedback: z.string().max(4000),
  document: notebookSchema,
  appliedAi: z.uuid().nullable(),
}).strict();
const baseSchema = z.object({
  revision: z.number().int().nonnegative(),
  answerHash: z.string().min(1).max(256),
  openEnded: z.boolean(),
}).strict();
const recordSchema = z.object({
  version: z.literal(1),
  base: baseSchema,
  draft: reviewDraftSchema,
  pending: z.uuid().nullable(),
}).strict();
export type ReviewDraft = z.infer<typeof reviewDraftSchema>;
export type ReviewBase = z.infer<typeof baseSchema>;
export type ReviewJournalRecord = z.infer<typeof recordSchema>;
export function reviewJournalKey(user: string, family: string, attempt: string, question: string) {
  return REVIEW_JOURNAL_PREFIX + [user, family, attempt, question].map(v => z.uuid().parse(v)).join(":");
}

/** Synchronous write-ahead record, scoped to the reviewing parent and question.
 * A pending request freezes both the original base and all submitted fields. */
export class ReviewJournal {
  private raw: string | null | undefined;
  private record: ReviewJournalRecord | null = null;
  constructor(private store: AnswerJournalStorage, private key: string, private id: () => string) {}
  restore() {
    const raw = this.store.get(this.key);
    const record = raw === null ? null : recordSchema.parse(JSON.parse(raw));
    this.raw = raw;
    this.record = record;
    return record;
  }
  private guard() {
    if (this.raw === undefined) throw Error("review_local_not_ready");
    if (this.store.get(this.key) !== this.raw) throw Error("review_local_changed");
  }
  private put(record: ReviewJournalRecord) {
    this.guard();
    const parsed = recordSchema.parse(record);
    const raw = JSON.stringify(parsed);
    if (raw.length > 1_100_000) throw Error("review_local_too_large");
    this.store.set(this.key, raw);
    this.raw = raw;
    this.record = parsed;
    return parsed;
  }
  edit(base: ReviewBase, draft: ReviewDraft) {
    this.guard();
    if (this.record?.pending) throw Error("review_local_pending");
    return this.put({version:1, base:this.record?.base ?? base, draft, pending:null});
  }
  prepare() {
    this.guard();
    const record = this.record;
    if (!record) throw Error("review_local_not_ready");
    if (record.base.openEnded && (!record.draft.score.trim() ||
      !/^\d+$/.test(record.draft.score) || Number(record.draft.score) > 100)) {
      throw Error("invalid_score");
    }
    return record.pending ? record : this.put({...record, pending:this.id()});
  }
  reject(request: string) {
    this.guard();
    if (this.record?.pending !== request) throw Error("review_local_changed");
    this.put({...this.record, pending:null});
  }
  acknowledge(request: string, revision: unknown) {
    this.guard();
    if (this.record?.pending !== request) throw Error("review_local_changed");
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 1 || revision < this.record.base.revision) {
      throw Error("review_receipt_invalid");
    }
    this.remove();
  }
  discard() {
    this.guard();
    if (this.record?.pending) throw Error("review_local_pending");
    this.remove();
  }
  private remove() {
    this.store.remove(this.key);
    this.raw = null;
    this.record = null;
  }
}
