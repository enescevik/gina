import { z } from "zod";

/**
 * C01 — P04 öncesi otomatik sıfır puanlar için önizleme/uygulama sözleşmesi
 * (`preview_legacy_open_zero_corrections`, `apply_legacy_open_zero_corrections`,
 * `get_legacy_open_zero_corrections`). Düzeltme yalnız deneme toplamlarını yeniden hesaplar; verilmiş
 * veli/AI puanları, cevaplar ve rapor snapshot'ları değişmez. Uygulama veli ya da tam yönetici onayıyla çağrılır.
 */
const totals = z.object({
  status: z.enum(["in_progress", "submitted", "graded"]),
  score_pct: z.number().int().min(0).max(100).nullable(),
  open_total: z.number().int().nullable(),
  open_graded: z.number().int().nullable(),
  open_pending: z.number().int().nullable().optional(),
  open_unanswered: z.number().int().nullable().optional(),
  provisional: z.boolean().nullable(),
  graded_at: z.string().nullable().optional(),
});
export const legacyZeroItemSchema = z.object({
  question_id: z.uuid(),
  position: z.number().int().min(1),
  state: z.enum(["pending", "unanswered"]),
});
export const legacyZeroPreviewSchema = z.object({
  scope: z.literal("family"),
  family_id: z.uuid(),
  rule: z.literal("p04_legacy_auto_zero"),
  eligible: z.number().int().min(0),
  blocked: z.number().int().min(0),
  already_corrected: z.number().int().min(0),
  attempts: z.array(z.object({
    attempt_id: z.uuid(),
    exam_id: z.uuid(),
    child_id: z.uuid(),
    finished_at: z.string().nullable(),
    blocked: z.enum(["child_archived"]).nullable(),
    before: totals,
    after: totals,
    items: z.array(legacyZeroItemSchema),
    kept_scores: z.number().int().min(0),
  })),
});
export type LegacyZeroPreview = z.infer<typeof legacyZeroPreviewSchema>;
export const legacyZeroApplyResultSchema = z.object({
  corrected: z.number().int().min(0),
  results: z.array(z.object({
    attempt_id: z.uuid(),
    result: z.enum([
      "corrected",
      "already_corrected",
      "not_eligible",
      "child_archived",
      "not_found",
    ]),
    before: totals.optional(),
    after: totals.optional(),
  })),
});
export type LegacyZeroApplyResult = z.infer<typeof legacyZeroApplyResultSchema>;

/** Önizlemede uygulanabilir (engelsiz) deneme kimlikleri; arşivli profil asla seçilmez. */
export function legacyZeroSelectable(preview: LegacyZeroPreview): string[] {
  return preview.attempts.filter((a) => a.blocked === null).map((a) =>
    a.attempt_id
  );
}

/** Önce/sonra farkı: puan, durum ve ara sonuç değişimi. */
export function legacyZeroImpact(a: LegacyZeroPreview["attempts"][number]) {
  return {
    scoreBefore: a.before.score_pct,
    scoreAfter: a.after.score_pct,
    becomesProvisional: a.after.provisional === true &&
      a.before.provisional !== true,
    pending: a.items.filter((i) => i.state === "pending").length,
    unanswered: a.items.filter((i) => i.state === "unanswered").length,
  };
}
