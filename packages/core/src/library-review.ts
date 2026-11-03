import { z } from "zod";
const key = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/);
const text = (max: number) => z.string().max(max);
const positive = z.number().int().min(1);
const metadata = z.record(z.string(), z.unknown());
export const libraryStudentSchema = z
  .object({
    grade: positive.max(12),
    subject: text(80).min(1),
    topic: text(200).min(1),
    kind: z.enum(["open_ended", "multiple_choice"]),
    difficulty: z.enum(["kolay", "orta", "orta_ustu", "zor"]),
    stem: text(3500).min(5),
    choices: z
      .array(
        z
          .object({
            key: z.enum(["A", "B", "C", "D"]),
            text: text(2000).min(1),
          })
          .strict(),
      )
      .max(4),
  })
  .strict();
export const libraryTeacherSchema = z
  .object({
    correct_key: z.enum(["A", "B", "C", "D"]).nullable(),
    expected_answer: text(10000).min(1),
    solution: text(10000).min(1),
    explanation: text(4000).min(1),
    common_misconception: text(2000).min(1),
    next_step: text(2000).min(1),
    rubric: z
      .object({
        max_points: positive.max(100),
        scoring: text(4000).min(1),
        criteria: z
          .array(
            z
              .object({
                id: key,
                points: positive.max(100),
                criterion: text(2000).min(1),
              })
              .strict(),
          )
          .min(1)
          .max(20),
        missing_answer: text(2000).min(1),
        review_required: z.literal(true),
      })
      .strict(),
  })
  .strict();
export const libraryBundleSchema = z
  .object({
    schema: z.literal("gina.library-import.v1"),
    package_key: key,
    revision: positive.max(100000),
    previous_hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    title: text(160).min(3),
    grade: positive.max(12),
    subject: text(80).min(1),
    provenance: metadata,
    assets: z
      .array(
        z
          .object({
            key,
            mime: z.literal("image/png"),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
            width: positive.max(4096),
            height: positive.max(4096),
            base64: text(700000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
          })
          .strict(),
      )
      .max(100),
    sources: z
      .array(
        z
          .object({
            key,
            title: text(160).min(1),
            body: text(6000),
            alt: text(2000),
            asset_key: key.nullable(),
            minimum_reading_width: z.number().int().min(0).max(1600),
            provenance: metadata,
          })
          .strict(),
      )
      .max(100),
    questions: z
      .array(
        z
          .object({
            key,
            revision: positive.max(100000),
            source_key: key.nullable(),
            student: libraryStudentSchema,
            teacher: libraryTeacherSchema,
            metadata,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((b, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const unique = (values: string[]) => new Set(values).size === values.length;
    if (
      !unique(b.assets.map((a) => a.key)) ||
      !unique(b.sources.map((s) => s.key)) ||
      !unique(b.questions.map((q) => q.key))
    )
      fail("Yinelenen kimlik var.");
    if (
      (b.revision === 1 && b.previous_hash !== null) ||
      (b.revision > 1 && !b.previous_hash)
    )
      fail("Önceki sürüm bilgisi geçersiz.");
    for (const s of b.sources) {
      if (
        s.asset_key
          ? !b.assets.some((a) => a.key === s.asset_key) || !s.alt.trim()
          : !s.body.trim()
      )
        fail("Ortak kaynak eksik.");
      if (!b.questions.some((q) => q.source_key === s.key))
        fail("Kullanılmayan ortak kaynak var.");
    }
    for (const a of b.assets)
      if (!b.sources.some((s) => s.asset_key === a.key))
        fail("Kullanılmayan görsel var.");
    for (const q of b.questions) {
      if (q.student.grade !== b.grade || q.student.subject !== b.subject)
        fail("Sınıf veya ders eşleşmiyor.");
      if (q.source_key && !b.sources.some((s) => s.key === q.source_key))
        fail("Soru kaynağı bulunamadı.");
      if (
        q.student.kind === "open_ended"
          ? q.student.choices.length !== 0 || q.teacher.correct_key !== null
          : q.student.choices.length !== 4 ||
            !unique(q.student.choices.map((c) => c.key)) ||
            !q.teacher.correct_key
      )
        fail("Cevap biçimi geçersiz.");
      const rubric = q.teacher.rubric;
      if (
        !unique(rubric.criteria.map((c) => c.id)) ||
        rubric.criteria.reduce((sum, c) => sum + c.points, 0) !==
          rubric.max_points
      )
        fail("Puan ölçütleri toplamı eşleşmiyor.");
    }
  });
export const libraryFileSchema = z
  .object({ p_request_id: z.uuid(), p_bundle: libraryBundleSchema })
  .strict();
export type LibraryFile = z.infer<typeof libraryFileSchema>;
export const libraryReviewOutcome = z.enum([
  "unreviewed",
  "changes_requested",
  "suitable",
]);
export const libraryReviewCommandSchema = z
  .object({
    action: z.literal("review"),
    package_id: z.uuid(),
    question_key: key,
    question_revision: positive,
    expected_review_revision: z.number().int().min(0),
    outcome: libraryReviewOutcome,
    note: text(4000),
  })
  .strict()
  .refine(
    (v) => v.outcome !== "changes_requested" || v.note.trim().length >= 3,
    "Düzeltme için açıklama yazın.",
  );
export const libraryCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("import"), file: libraryFileSchema }).strict(),
  libraryReviewCommandSchema,
]);
export const libraryPendingSchema = z
  .object({ request: z.uuid(), payload: libraryCommandSchema })
  .strict()
  .refine(
    (v) =>
      v.payload.action !== "import" ||
      v.request === v.payload.file.p_request_id,
    "İstek kimliği değişemez.",
  );
export type LibraryCommand = z.infer<typeof libraryCommandSchema>;
export type LibraryPending = z.infer<typeof libraryPendingSchema>;
export const libraryReviewSchema = z.object({
  request_id: z.uuid(),
  package_id: z.uuid(),
  question_key: key,
  question_revision: positive,
  review_revision: positive,
  outcome: libraryReviewOutcome,
  note: text(4000),
  created_at: z.string(),
});
export type LibraryReview = z.infer<typeof libraryReviewSchema>;
export const libraryPackageRowSchema = z.object({
  id: z.uuid(),
  package_key: key,
  revision: positive,
  title: z.string(),
  grade: positive,
  subject: z.string(),
  status: z.literal("draft"),
  created_at: z.string(),
  question_count: z.number().int(),
  source_count: z.number().int(),
});
export type LibraryPackageRow = z.infer<typeof libraryPackageRowSchema>;
export const libraryDetailSchema = z.object({
  id: z.uuid(),
  package_key: key,
  revision: positive,
  title: z.string(),
  grade: positive,
  subject: z.string(),
  status: z.literal("draft"),
  content_hash: z.string(),
  sources: z.array(
    z.object({
      key,
      title: z.string(),
      body: z.string(),
      alt: z.string(),
      sha256: z.string().nullable(),
      width: z.number().nullable(),
      height: z.number().nullable(),
      minimum_reading_width: z.number(),
      png_base64: z.string().nullable(),
      provenance: metadata.optional(),
    }),
  ),
  questions: z.array(
    z.object({
      key,
      revision: positive,
      position: positive,
      source_key: key.nullable(),
      student: libraryStudentSchema,
      teacher: libraryTeacherSchema.optional(),
      metadata: metadata.optional(),
    }),
  ),
  provenance: metadata.optional(),
});
export type LibraryDetail = z.infer<typeof libraryDetailSchema>;
export function localLibraryPreview(file: LibraryFile): LibraryDetail {
  const b = file.p_bundle;
  return {
    id: file.p_request_id,
    ...b,
    content_hash: "",
    status: "draft",
    sources: b.sources.map((s) => {
      const a = b.assets.find((a) => a.key === s.asset_key);
      return {
        ...s,
        sha256: a?.sha256 ?? null,
        width: a?.width ?? null,
        height: a?.height ?? null,
        png_base64: a?.base64 ?? null,
      };
    }),
    questions: b.questions.map((q, i) => ({ ...q, position: i + 1 })),
  };
}
