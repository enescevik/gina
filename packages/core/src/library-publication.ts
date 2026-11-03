import { z } from "zod";
const plans = z
  .array(z.enum(["free", "plus", "pro"]))
  .min(1)
  .max(3)
  .refine((v) => new Set(v).size === v.length);
export const libraryPublicationSchema = z.object({
  package_id: z.uuid(),
  version: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  plans,
  curriculum_label: z.string(),
  review_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum(["published", "archived"]),
  updated_at: z.string(),
});
export const libraryReadinessSchema = z.object({
  package_id: z.uuid(),
  title: z.string(),
  grade: z.number().int(),
  subject: z.string(),
  revision: z.number().int(),
  checks: z.object({
    question_count: z.number().int(),
    suitable_count: z.number().int(),
    source_count: z.number().int(),
    missing_media: z.number().int(),
    review_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  publication: libraryPublicationSchema.nullable(),
  review_current: z.boolean(),
  delivery_enabled: z.boolean(),
});
export const libraryPublishCommandSchema = z
  .object({
    request: z.uuid(),
    package_id: z.uuid(),
    expected_version: z.number().int().min(0),
    review_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    title: z.string().trim().min(3).max(160),
    description: z.string().max(1000),
    plans,
    curriculum_label: z.string().trim().min(3).max(200),
    confirmed: z.literal(true),
    status: z.enum(["published", "archived"]),
    reason: z.string().max(1000),
  })
  .strict()
  .refine((v) => v.status !== "archived" || v.reason.trim().length >= 3);
export type LibraryReadiness = z.infer<typeof libraryReadinessSchema>;
export type LibraryPublishCommand = z.infer<typeof libraryPublishCommandSchema>;
export type LibraryPublication = z.infer<typeof libraryPublicationSchema>;
