import { z } from "zod";
import { notebookSchema } from "./notebook";
import { crosswordAnswerSchema, phase2aAnswerSchema, phase2bAnswerSchema, structuredAnswerSchema } from "./question-types";
import type { AnswerReceipt, AnswerValue } from "./answer-receipts";

export interface AnswerJournalStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}
const valueSchema = z.object({
  key: z.string().max(20).optional(),
  text: z.string().max(20000).optional(),
  document: notebookSchema.optional(),
  // QT00: sürümlü yapılandırılmış cevap. Eski (v1) günlük kayıtlarında yoktur ve aynen okunur.
  // QT30–QT33: 2A cevapları da aynı günlükte tutulur (tür etkin değilse sunucu zaten reddeder).
  answer: z.union([structuredAnswerSchema, phase2aAnswerSchema, phase2bAnswerSchema, crosswordAnswerSchema]).optional(),
}).strict();
const recordSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  latest: valueSchema,
  pending: z.object({
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    answer: valueSchema,
  }).strict().nullable(),
}).strict();
type RecordValue = z.infer<typeof recordSchema>;
export const ANSWER_JOURNAL_PREFIX = "gina.answer-journal.v1:";
export function answerJournalScope(
  user: string,
  family: string,
  child: string,
  attempt: string,
) {
  return ANSWER_JOURNAL_PREFIX +
    [user, family, child, attempt].map((v) => z.uuid().parse(v)).join(":") +
    ":";
}
const same = (a: AnswerValue, b: AnswerValue) =>
  a.key === b.key && a.text === b.text &&
  JSON.stringify(a.document) === JSON.stringify(b.document) &&
  JSON.stringify(a.answer) === JSON.stringify(b.answer);
export class AnswerJournalConflict extends Error {
  constructor(public questionId: string) {
    super("answer_changed");
  }
}

/** Per-question write-ahead journal. Persist both the edit and the exact request
 * before network I/O. A newer edit must never replace an uncertain request. */
export class AnswerJournal {
  constructor(
    private store: AnswerJournalStorage,
    private scope: string,
    private id: () => string,
  ) {}
  private key(question: string) {
    return this.scope + z.uuid().parse(question);
  }
  private read(question: string): RecordValue | null {
    const raw = this.store.get(this.key(question));
    if (!raw) return null;
    try {
      return recordSchema.parse(JSON.parse(raw));
    } catch {
      throw new Error("answer_local_invalid");
    }
  }
  private put(question: string, record: RecordValue) {
    const raw = JSON.stringify(recordSchema.parse(record));
    // Bound the envelope holding both latest and pending documents; never truncate.
    if (raw.length > 2_100_000) throw new Error("answer_local_too_large");
    this.store.set(this.key(question), raw);
  }
  restore(): Record<string, AnswerValue> {
    const answers: Record<string, AnswerValue> = {};
    for (
      const key of this.store.keys().filter((k) => k.startsWith(this.scope))
    ) {
      const question = key.slice(this.scope.length);
      const record = this.read(question);
      if (record) answers[question] = record.latest;
    }
    return answers;
  }
  discard(question: string) {
    this.store.remove(this.key(question));
  }
  edit(question: string, answer: AnswerValue, serverRevision: number) {
    const old = this.read(question);
    this.put(question, {
      version: 1,
      revision: old?.revision ?? serverRevision,
      latest: valueSchema.parse(answer),
      pending: old?.pending ?? null,
    });
  }
  async send(
    question: string,
    transmit: (receipt: AnswerReceipt) => Promise<number>,
    saved: (answer: AnswerValue, revision: number) => void,
  ) {
    let record = this.read(question);
    while (record) {
      const receipt = record.pending ??
        { id: this.id(), revision: record.revision, answer: record.latest };
      if (!record.pending) this.put(question, { ...record, pending: receipt });
      let revision: number;
      try {
        revision = await transmit(receipt);
        // A successful HTTP status alone does not acknowledge the saved answer.
        // Keep the exact pending request on malformed or older responses so a
        // retry can reconcile its server receipt without losing the local work.
        if (
          !Number.isSafeInteger(revision) || revision < 1 ||
          revision < receipt.revision
        ) throw new Error("answer_ack_invalid");
      } catch (error) {
        if (
          error && typeof error === "object" && "message" in error &&
          error.message === "answer_changed"
        ) throw new AnswerJournalConflict(question);
        throw error;
      }
      const current = this.read(question);
      // Auth invalidation/discard must not resurrect local records on a late reply.
      if (!current) return;
      if (current.pending?.id !== receipt.id) {
        throw new Error("answer_local_changed");
      }
      if (same(current.latest, receipt.answer)) {
        this.store.remove(this.key(question));
      } else this.put(question, { ...current, revision, pending: null });
      saved(receipt.answer, revision);
      record = this.read(question);
    }
  }
}
