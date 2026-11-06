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

// --- Source acquisition / versioning (M01). A fetched revision is evidence, not approval or endorsement. ---
export const CURRICULUM_SOURCE_FRESHNESS = [
  "verified",
  "unverified",
  "pending_review",
  "diff_review_required",
  "withdrawn",
] as const;
export const curriculumSourceRevisionSchema = z.object({
  id: z.uuid(),
  sha256: hash,
  bytes: z.number().int().min(1),
  mime: z.string(),
  resolved_url: z.string(),
  redirect_chain: z.array(z.object({ url: z.string(), status: z.number() })),
  inspection: z.record(z.string(), z.unknown()),
  retrieved_at: z.string(),
  last_checked_at: z.string(),
  status: z.enum([
    "pending_review",
    "approved",
    "diff_review_required",
    "superseded",
    "withdrawn",
  ]),
  extraction_status: z.enum(["queued", "done", "failed", "skipped"]),
  review_note: z.string().nullable(),
  reviewed_at: z.string().nullable(),
  candidates: z.number().int(),
  published_candidates: z.number().int(),
  // H02: panel extraction state (optional: older read models do not send them).
  extraction: z.record(z.string(), z.unknown()).nullable().optional(),
  extraction_running: z.boolean().optional(),
  extraction_started_at: z.string().nullable().optional(),
  extraction_attempts: z.number().int().optional(),
  extraction_last_error: z.string().nullable().optional(),
  draft_candidates: z.number().int().optional(),
  stored: z.boolean().optional(),
});
export const curriculumSourceRowSchema = z.object({
  id: z.uuid(),
  source_key: z.string(),
  exam_family: z.literal("oyss"),
  school_year: z.string(),
  term: z.number().int(),
  label: z.string(),
  index_url: z.string(),
  link_url: z.string(),
  freshness: z.enum(CURRICULUM_SOURCE_FRESHNESS),
  last_checked_at: z.string().nullable(),
  last_check_error: z.string().nullable(),
  index_published_on: z.string().nullable(),
  index_updated_on: z.string().nullable(),
  approved: z.object({
    revision_id: z.uuid(),
    sha256: hash,
    retrieved_at: z.string(),
    last_checked_at: z.string(),
  }).nullable(),
  revisions: z.array(curriculumSourceRevisionSchema),
});
export type CurriculumSourceRow = z.infer<typeof curriculumSourceRowSchema>;
/** Parent-facing read: never a file, never a scenario choice; `officially_verified` is always false. */
export const curriculumSourceFreshnessSchema = z.object({
  status: z.enum([...CURRICULUM_SOURCE_FRESHNESS, "unpublished"]),
  last_checked_at: z.string().nullable().optional(),
  index_updated_on: z.string().nullable().optional(),
  last_approved_retrieved_at: z.string().nullable().optional(),
  last_approved_sha256: hash.nullable().optional(),
  alternative: z.literal("free_study").nullable().optional(),
  officially_verified: z.literal(false),
});
export type CurriculumSourceFreshness = z.infer<
  typeof curriculumSourceFreshnessSchema
>;
export const curriculumSourceReviewCommandSchema = z.object({
  request: z.uuid(),
  revision_id: z.uuid(),
  action: z.enum(["approve", "withdraw", "dismiss"]),
  note: text(2000),
  confirmed: z.literal(true),
}).strict();
export type CurriculumSourceReviewCommand = z.infer<
  typeof curriculumSourceReviewCommandSchema
>;
export const curriculumSourceFetchTargetSchema = z.object({
  exam_family: z.literal("oyss"),
  school_year: z.string().regex(/^20\d{2}-20\d{2}$/).refine((v) =>
    Number(v.slice(5)) === Number(v.slice(0, 4)) + 1
  ),
  term: z.number().int().min(1).max(2),
  exam_no: z.number().int().min(1).max(2).optional(),
  grade: z.number().int().min(1).max(12).optional(),
  subject: text(80),
  programme: text(160).optional(),
  link_url: z.url({ protocol: /^https$/ }).max(500).optional(),
  /** H02: school level when the official page lists the subject once per level. */
  level: z.enum(["ortaokul", "lise"]).optional(),
}).strict();
export type CurriculumSourceFetchTarget = z.infer<
  typeof curriculumSourceFetchTargetSchema
>;
