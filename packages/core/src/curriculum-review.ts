import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const cell = z.string().regex(/^[A-Z]+[1-9][0-9]*$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const officialUrl = z.url({ protocol: /^https$/ }).max(2000).regex(
  /^https:\/\/(?:[a-zA-Z0-9-]+\.)*(?:meb|eba)\.gov\.tr(?:\/[^\s]*)?$/,
);
export const curriculumCandidateSchema = z.object({
  key: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  academic_year: z.string().regex(/^20\d{2}-20\d{2}$/).refine((v) =>
    Number(v.slice(5)) === Number(v.slice(0, 4)) + 1
  ),
  term: z.number().int().min(1).max(2),
  exam: z.number().int().min(1).max(2),
  grade: z.number().int().min(5).max(12),
  subject: text(80),
  label: text(100),
  source_url: officialUrl,
  source_sha256: hash,
  sheet: text(160),
  header_cell: cell,
  question_count: z.number().int().min(1).max(30),
  blocks: z.array(
    z.object({
      count: z.number().int().min(1).max(30),
      count_cell: cell,
      outcomes: z.array(
        z.object({ cell, text: text(2000), code: text(100).nullable() })
          .strict(),
      ).min(1).max(20),
    }).strict(),
  ).min(1).max(30),
  review_reasons: z.array(text(500)).min(1).max(50),
}).strict().refine((v) =>
  v.blocks.reduce((n, b) => n + b.count, 0) === v.question_count
);
export type CurriculumCandidate = z.infer<typeof curriculumCandidateSchema>;
export const curriculumBundleSchema = z.object({
  schema: z.literal("gina.curriculum-review.v1"),
  candidates: z.array(curriculumCandidateSchema).min(1).max(1000),
}).strict().refine((v) =>
  new Set(v.candidates.map((c) => c.key + ":" + c.source_sha256)).size ===
    v.candidates.length
);
export const curriculumReviewSchema = z.object({
  programme: text(160),
  school_scope: text(500),
  programme_url: officialUrl,
  source_checked: z.literal(true),
  counts_checked: z.literal(true),
  applicability_checked: z.literal(true),
  issues_resolution: text(4000),
  note: text(2000),
}).strict();
export type CurriculumReview = z.infer<typeof curriculumReviewSchema>;
export const curriculumRowSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  academic_year: z.string(),
  term: z.number(),
  exam: z.number(),
  grade: z.number(),
  subject: z.string(),
  label: z.string(),
  question_count: z.number(),
  status: z.enum(["draft", "reviewed", "published", "withdrawn"]),
  revision: z.number().int(),
  content_hash: hash,
  review_reasons: z.array(z.string()),
});
export const curriculumDetailSchema = curriculumRowSchema.extend({
  candidate: curriculumCandidateSchema,
  review: curriculumReviewSchema.nullable(),
  reviewed_at: z.string().nullable(),
});
export const curriculumCommandSchema = z.discriminatedUnion("action", [
  z.object({
    request: z.uuid(),
    action: z.literal("import"),
    bundle: curriculumBundleSchema,
  }).strict(),
  z.object({
    request: z.uuid(),
    action: z.literal("review"),
    id: z.uuid(),
    revision: z.number().int().min(0),
    review: curriculumReviewSchema,
  }).strict(),
  z.object({
    request: z.uuid(),
    action: z.enum(["publish", "withdraw"]),
    id: z.uuid(),
    revision: z.number().int().min(0),
    note: text(2000),
    confirmed: z.literal(true),
  }).strict(),
]);
export type CurriculumCommand = z.infer<typeof curriculumCommandSchema>;
