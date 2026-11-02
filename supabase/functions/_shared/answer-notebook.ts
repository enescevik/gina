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
