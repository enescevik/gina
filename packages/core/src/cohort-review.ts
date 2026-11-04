import { z } from "zod";
import type { AnswerJournalStorage } from "./answer-journal";
export const cohortReviewCommandSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("review"),
    request: z.uuid(),
    entry: z.uuid(),
    ord: z.number().int().min(1).max(50),
    revision: z.number().int().min(0),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    points: z.record(z.string(), z.number().int().min(0).max(100)),
    outcome: z.enum(["scored", "not_answered", "unreadable"]),
    feedback: z.string().trim().min(10).max(4000),
    appealRevision: z.number().int().positive().nullable(),
    response: z.string().max(4000).nullable(),
  }).strict(),
  z.object({
    action: z.literal("publish"),
    request: z.uuid(),
    group: z.uuid(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    version: z.number().int().min(0),
  }).strict(),
]);
export type CohortReviewCommand = z.infer<typeof cohortReviewCommandSchema>;
export const cohortAppealSchema = z.object({
  p_request: z.uuid(),
  p_group: z.uuid(),
  p_child: z.uuid(),
  p_ord: z.number().int().min(1).max(50),
  p_review_revision: z.number().int().min(1),
  p_reason: z.string().trim().min(10).max(2000),
}).strict();
export type CohortAppealCommand = z.infer<typeof cohortAppealSchema>;
export const COHORT_APPEAL_PREFIX = "gina:cohort-appeal:v1:";
export function createCohortAppealJournal({
  store,
  user,
  family,
  guard,
  send,
}: {
  store: AnswerJournalStorage;
  user: string;
  family: string;
  guard: () => void;
  send: (
    c: CohortAppealCommand,
  ) => Promise<
    { data: unknown; error: { code?: string; message: string } | null }
  >;
}) {
  const key = COHORT_APPEAL_PREFIX +
    [user, family].map(encodeURIComponent).join(":");
  const read = () => {
    guard();
    z.uuid().parse(user);
    z.uuid().parse(family);
    const value = store.get(key);
    return value ? cohortAppealSchema.parse(JSON.parse(value)) : null;
  };
  return {
    read,
    prepare(value: CohortAppealCommand) {
      if (read()) throw Error("cohort_appeal_pending");
      const c = cohortAppealSchema.parse(value);
      store.set(key, JSON.stringify(c));
      return c;
    },
    async send(c: CohortAppealCommand) {
      if (JSON.stringify(read()) !== JSON.stringify(c)) {
        throw Error("cohort_appeal_changed");
      }
      const r = await send(c);
      guard();
      if (r.error) {
        if (/^(P0001|42501|22\w{3}|23\w{3})$/.test(r.error.code ?? "")) {
          store.remove(key);
        }
        throw r.error;
      }
      const ack = z.object({
        entry: z.uuid(),
        ord: z.number().int(),
        revision: z.number().int().positive(),
        status: z.literal("open"),
      }).parse(r.data);
      if (ack.ord !== c.p_ord) throw Error("cohort_receipt_invalid");
      if (read()?.p_request === c.p_request) store.remove(key);
      return ack;
    },
  };
}
export interface CohortCriterion {
  id: string;
  criterion: string;
  points: number;
}
export function validCohortPoints(
  criteria: CohortCriterion[],
  points: Record<string, number>,
  outcome: string,
) {
  return criteria.length > 0 &&
    new Set(criteria.map((c) => c.id)).size === criteria.length &&
    Object.keys(points).length === criteria.length &&
    criteria.every((c) =>
      Number.isInteger(points[c.id]) && points[c.id]! >= 0 &&
      points[c.id]! <= c.points && (outcome === "scored" || points[c.id] === 0)
    );
}
