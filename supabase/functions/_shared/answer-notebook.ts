/** Do not silently evaluate only the typed fragment of an unreviewed visual answer. */
export function needsNotebookReview(
  answers: { graded_by?: string | null; answer_document?: unknown }[],
): boolean {
  return answers.some((answer) => {
    if (answer.graded_by === "parent" || answer.answer_document == null) {
      return false;
    }
    const doc = answer.answer_document;
    if (typeof doc !== "object" || Array.isArray(doc)) return true;
    const elements = (doc as Record<string, unknown>).elements;
    return !Array.isArray(elements) || elements.length > 0;
  });
}

/** P04: AI yalnız metni olan, veli puanı olmayan açık uçlu cevabı puanlayabilir.
 * Boş cevap (ne metin ne çizim) ve çizimli cevap asla AI tarafından kesin puan almaz:
 * boş → sunucuda "cevap yok" (puan null), çizim → ayrı onaylı inceleme yolu (notebook_review_required). */
export function aiGradableOpenAnswer(
  kind: string,
  answer: { answer_text?: string | null; graded_by?: string | null; answer_document?: unknown } | undefined,
): boolean {
  if (kind !== "open_ended" || !answer || answer.graded_by === "parent") return false;
  if (needsNotebookReview([answer])) return false;
  return (answer.answer_text ?? "").trim().length > 0;
}
