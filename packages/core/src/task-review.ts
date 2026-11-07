import { z } from "zod";

// C03: review_task_once geri gönderme nedeni. Sunucu aynı listeyi ve 140 karakter sınırını uygular;
// bu katman yalnız isteği biçimlendirir ve çocuğa/veliye gösterilecek i18n anahtarlarını verir.
export const TASK_RETURN_REASONS = [
  "not_finished",
  "needs_care",
  "missing_part",
  "do_together",
  "wrong_day",
  "other",
] as const;
export type TaskReturnReason = (typeof TASK_RETURN_REASONS)[number];
export const TASK_RETURN_NOTE_MAX = 140;

const reason = z.enum(TASK_RETURN_REASONS);

/** Sunucudaki normalleştirmeyle aynı: boşluk/denetim karakterleri tek boşluk, baş/son kırpılır. */
export function normalizeReturnNote(value: string | null | undefined): string | null {
  const text = (value ?? "").replace(/[\s\u0000-\u001f\u007f]+/g, " ").trim();
  return text ? text : null;
}

export type ReturnChoice = { reason: TaskReturnReason | null; note: string };

/** Formun gönderilebilir olup olmadığı ve sunucuya gidecek değerler; hata kodu i18n anahtarına çevrilir. */
export function returnRequest(choice: ReturnChoice):
  | { ok: true; reason: TaskReturnReason | null; note: string | null }
  | { ok: false; error: "return_note_required" | "return_note_invalid" } {
  const note = normalizeReturnNote(choice.note);
  if (note && note.length > TASK_RETURN_NOTE_MAX) return { ok: false, error: "return_note_invalid" };
  if (note && !choice.reason) return { ok: false, error: "return_note_invalid" };
  if (choice.reason === "other" && !note) return { ok: false, error: "return_note_required" };
  return { ok: true, reason: choice.reason, note: choice.reason ? note : null };
}

/** review_task_once argümanları. Nedensiz geri gönderme ve onay eski gövdeyle aynıdır (eski makbuzla uyumlu). */
export function reviewTaskArgs(input: {
  requestId: string;
  completionId: string;
  approve: boolean;
  completedAt: string;
  reason?: TaskReturnReason | null;
  note?: string | null;
}): Record<string, unknown> {
  const args: Record<string, unknown> = {
    p_request_id: input.requestId,
    p_completion_id: input.completionId,
    p_approve: input.approve,
    p_expected_completed_at: input.completedAt,
  };
  if (!input.approve && input.reason) {
    args.p_return_reason = input.reason;
    args.p_return_note = normalizeReturnNote(input.note);
  }
  return args;
}

/** Aynı karar + aynı içerik → aynı istek kimliği (kayıp yanıt tekrarı), farklı neden → yeni kimlik. */
export function reviewRequestKey(input: {
  completionId: string;
  completedAt: string;
  approve: boolean;
  reason?: TaskReturnReason | null;
  note?: string | null;
}): string {
  return [
    input.completionId,
    input.completedAt,
    input.approve ? "approve" : "return",
    input.approve ? "" : input.reason ?? "",
    input.approve ? "" : normalizeReturnNote(input.note) ?? "",
  ].join("|");
}

export const taskReturnSchema = z.object({
  return_reason: reason.nullable().optional(),
  return_note: z.string().max(TASK_RETURN_NOTE_MAX).nullable().optional(),
});

/** Satırdan güvenle okunan neden (bilinmeyen kod gösterilmez). */
export function readReturnReason(row: { return_reason?: unknown; return_note?: unknown } | null | undefined):
  { reason: TaskReturnReason; note: string | null } | null {
  const parsed = taskReturnSchema.safeParse({ return_reason: row?.return_reason ?? null, return_note: row?.return_note ?? null });
  if (!parsed.success || !parsed.data.return_reason) return null;
  return { reason: parsed.data.return_reason, note: parsed.data.return_note ?? null };
}

/** Sunucunun bilinen hata kodları → i18n anahtarı; bilinmeyen ham hata kullanıcıya gösterilmez. */
export function reviewErrorKey(message: string | null | undefined): string {
  const code = String(message ?? "");
  if (code === "already_reviewed" || code === "not_found") return "c03.review.alreadyReviewed";
  if (code === "submission_changed") return "c03.review.changed";
  if (code === "return_note_required") return "c03.review.noteRequired";
  if (code === "return_note_invalid" || code === "return_reason_invalid") return "c03.review.noteInvalid";
  return "parentHome.reviewError";
}

/**
 * Haftalık öneriden görev başlığı: ilk cümle, en çok 80 karakter (görev formu sınırı), kelime ortasından kesilmez.
 * Öneri metninin tamamı formda kaynak olarak ayrıca gösterilir; hiçbir şey kendiliğinden kaydedilmez.
 */
export function suggestionTaskTitle(text: string, max = 80): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentence = clean.split(/(?<=[.!?…])\s/)[0] ?? clean;
  let end = sentence.length;
  while(end>0 && ".!?…".includes(sentence[end-1]!))end--;
  const base = sentence.slice(0,end).trim();
  if (base.length <= max) return base;
  const cut = base.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max / 2 ? cut.slice(0, space) : cut).trim() + "…";
}

/** Bir inceleme hatası kartı kapatmalı mı: başka oturum karar verdiyse görev artık beklemede değildir. */
export function reviewSettled(message: string | null | undefined): boolean {
  return message === "already_reviewed" || message === "not_found";
}
