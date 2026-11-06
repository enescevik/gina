import { z } from "zod";

/** Açık uçlu tek cevabın durumu (sunucu: gina.open_answer_state). */
export type OpenAnswerState = "graded" | "pending" | "unanswered";
/** Denemenin türetilmiş inceleme durumu (get_attempt_summary.review_state). Enum değişmedi:
 * "pending_review" = status 'submitted' ve eksik açık uçlu puan var. */
export type AttemptReviewState = "in_progress" | "pending_review" | "graded";

export interface AttemptTotals {
  status?: string | null;
  mc_total: number | null;
  mc_correct: number | null;
  open_total: number | null;
  open_graded: number | null;
  /** 2026-11-06 P04 sütunları; eski kayıtlarda null (yeniden hesaplanmaz). */
  open_pending?: number | null;
  open_unanswered?: number | null;
  provisional?: boolean | null;
  score_pct?: number | null;
}

export interface AttemptSummary {
  mcTotal: number;
  mcCorrect: number;
  /** Açık uçlularda eksik puan var (eski alan; davranış korunur). */
  pendingReview: boolean;
  openTotal: number;
  openGraded: number;
  /** Cevabı (metin/çizim) olan, puanı bekleyen açık uçlu sayısı. */
  pendingOpenCount: number;
  /** Ne metin ne çizim içeren açık uçlu sayısı; veli açıkça 0 verebilir. Otomatik 0 yok. */
  unansweredOpenCount: number;
  /** score_pct yalnız puanlı maddelerden hesaplanmış ara sonuç. */
  provisional: boolean;
  /** null: henüz puanlı madde yok (0 değil). */
  scorePct: number | null;
  reviewState: AttemptReviewState;
}

/** Finish RPC totals can precede the AFTER trigger. Question snapshots provide
 * counts while the submitted response is still missing those totals.
 * Legacy rows (open_pending/open_unanswered/provisional null) are read, never
 * reinterpreted: a graded legacy attempt stays graded with its stored score. */
export function attemptSummary(
  result: AttemptTotals,
  questions: readonly { kind: string }[],
): AttemptSummary {
  const mcTotal = result.mc_total ??
    questions.filter((q) => q.kind === "multiple_choice").length;
  const openTotal = result.open_total ??
    questions.filter((q) => q.kind === "open_ended").length;
  const openGraded = result.open_graded ?? 0;
  const pendingReview = openGraded < openTotal;
  const pendingOpenCount = result.open_pending ??
    Math.max(openTotal - openGraded, 0);
  const unansweredOpenCount = result.open_unanswered ?? 0;
  const provisional = result.provisional ?? pendingReview;
  const reviewState: AttemptReviewState = result.status === "in_progress"
    ? "in_progress"
    : result.status === "graded"
    ? "graded"
    : pendingReview || result.status === "submitted"
    ? "pending_review"
    : "graded";
  return {
    mcTotal,
    mcCorrect: result.mc_correct ?? 0,
    pendingReview,
    openTotal,
    openGraded,
    pendingOpenCount,
    unansweredOpenCount,
    provisional,
    scorePct: result.score_pct ?? null,
    reviewState,
  };
}

/** Sunucu kuralının birebir karşılığı (gina.open_answer_present): metin VEYA defterde
 * en az bir çizgi / dolu metin kutusu. Yalnız yapıştırılmış kaynak görseli cevap değildir. */
export function openAnswerPresent(answer: {
  answer_text?: string | null;
  answer_document?: unknown;
}): boolean {
  if ((answer.answer_text ?? "").trim().length > 0) return true;
  const doc = answer.answer_document;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return false;
  const elements = (doc as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) return false;
  return elements.some((e) => {
    if (!e || typeof e !== "object") return false;
    const el = e as { type?: unknown; text?: unknown };
    if (el.type === "stroke") return true;
    return el.type === "text" && typeof el.text === "string" &&
      el.text.trim().length > 0;
  });
}

export function openAnswerState(answer: {
  score?: number | null;
  answer_text?: string | null;
  answer_document?: unknown;
}): OpenAnswerState {
  if (answer.score !== null && answer.score !== undefined) return "graded";
  return openAnswerPresent(answer) ? "pending" : "unanswered";
}

const openAnswerSchema = z.object({
  question_id: z.string().uuid(),
  position: z.number().int().positive(),
  state: z.enum(["graded", "pending", "unanswered"]),
  score: z.number().int().min(0).max(100).nullable(),
  graded_by: z.enum(["ai", "parent"]).nullable(),
  /** C08: AI önerisi (kesin puan değil). Eski yanıtlarda yok. */
  ai_score: z.number().int().min(0).max(100).nullable().optional(),
  /** C08: AI önerisi var, veli henüz kesinleştirmedi. */
  ai_suggested: z.boolean().optional(),
  /** C08: C08 öncesi AI'nın score'a yazdığı eski kayıt (yeniden yazılmaz, eskisi gibi okunur). */
  legacy_ai: z.boolean().optional(),
  has_text: z.boolean(),
  has_document: z.boolean(),
});

/** public.get_attempt_summary(p_attempt_id) dönüşü. open_answers yalnız veli/servis için gelir. */
export const attemptSummaryRpcSchema = z.object({
  id: z.string().uuid(),
  exam_id: z.string().uuid(),
  child_id: z.string().uuid(),
  status: z.enum(["in_progress", "submitted", "graded"]),
  review_state: z.enum(["in_progress", "pending_review", "graded"]),
  mc_total: z.number().int().nullable(),
  mc_correct: z.number().int().nullable(),
  open_total: z.number().int().nullable(),
  open_graded: z.number().int().nullable(),
  pending_open_count: z.number().int().min(0),
  unanswered_open_count: z.number().int().min(0),
  provisional: z.boolean(),
  score_pct: z.number().int().min(0).max(100).nullable(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  graded_at: z.string().nullable(),
  open_answers: z.array(openAnswerSchema).optional(),
  ai_suggestion_count: z.number().int().min(0).optional(),
});
export type AttemptSummaryRpc = z.infer<typeof attemptSummaryRpcSchema>;
export type OpenAnswerSummary = z.infer<typeof openAnswerSchema>;

/** Bozuk/eski yanıtta null döner; UI eski sütun yoluna düşer. */
export function parseAttemptSummary(value: unknown): AttemptSummaryRpc | null {
  const parsed = attemptSummaryRpcSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** C08 — açık uçlu cevabın puan kaynağı: veli kesin puanı, AI önerisi (onay bekliyor), eski AI puanı, yok.
 * AI önerisi hiçbir zaman kesin puan gibi gösterilmez; eski `graded_by='ai'` kayıtları yeniden yazılmaz. */
export type OpenScoreSource = "parent" | "ai_suggestion" | "legacy_ai" | "none";
export function openScoreSource(answer: {
  score?: number | null;
  graded_by?: string | null;
  ai_score?: number | null;
}): OpenScoreSource {
  const hasScore = answer.score !== null && answer.score !== undefined;
  if (hasScore && answer.graded_by === "ai") return "legacy_ai";
  if (hasScore) return "parent";
  if (answer.ai_score !== null && answer.ai_score !== undefined) return "ai_suggestion";
  return "none";
}

/** D4-2 — süreli denemenin süre dolunca bittiğini sunucu satırından türetir.
 * `finish_exam_attempt` istemcinin otomatik bitirmesiyle birkaç saniye sonra çalışır;
 * cihaz saati sunucudan biraz ileride olabileceği için küçük bir pay bırakılır.
 * Süresiz denemede, bitmemiş denemede ya da süreden önce gönderilende false. */
export const TIME_UP_TOLERANCE_MS = 5_000;
export function attemptEndedByTime(attempt: {
  status?: string | null;
  deadline_at?: string | null;
  finished_at?: string | null;
}): boolean {
  if (!attempt.deadline_at || !attempt.finished_at) return false;
  if (attempt.status === "in_progress") return false;
  const deadline = Date.parse(attempt.deadline_at);
  const finished = Date.parse(attempt.finished_at);
  if (!Number.isFinite(deadline) || !Number.isFinite(finished)) return false;
  return finished >= deadline - TIME_UP_TOLERANCE_MS;
}
