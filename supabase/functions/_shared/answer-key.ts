// C04: open-ended answer key extras (alternative correct answers + rubric) stored in
// question_bank.provenance.rubric by both AI generation and parent-written questions.
// Only the grading/review payloads read this; it is never sent to the child.

export interface AnswerKeyExtras {
  alternatif_dogru_cevaplar: string[];
  rubrik: { olcut: string; puan: number }[];
}

const MAX_ITEMS = 10;
const MAX_TEXT = 500;

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, MAX_TEXT);
  return text ? text : null;
}

/** Defensive read: malformed or legacy provenance yields empty lists, never throws. */
export function answerKeyExtras(
  provenance: unknown,
  mask: (text: string) => string = (t) => t,
): AnswerKeyExtras {
  const rubric = provenance && typeof provenance === "object"
    ? (provenance as { rubric?: unknown }).rubric
    : null;
  if (!rubric || typeof rubric !== "object") {
    return { alternatif_dogru_cevaplar: [], rubrik: [] };
  }
  const r = rubric as { criteria?: unknown; alternative_answers?: unknown };
  const alternatives = Array.isArray(r.alternative_answers)
    ? r.alternative_answers.map(cleanText).filter((v): v is string => !!v)
    : [];
  const criteria = Array.isArray(r.criteria)
    ? r.criteria.flatMap((c) => {
      if (!c || typeof c !== "object") return [];
      const text = cleanText((c as { text?: unknown }).text);
      const points = Number((c as { points?: unknown }).points);
      if (!text || !Number.isFinite(points) || points < 0 || points > 100) {
        return [];
      }
      return [{ olcut: mask(text), puan: Math.round(points) }];
    })
    : [];
  return {
    alternatif_dogru_cevaplar: [...new Set(alternatives.map(mask))].slice(
      0,
      MAX_ITEMS,
    ),
    rubrik: criteria.slice(0, MAX_ITEMS),
  };
}

/** Prompt rule shared by grade and notebook review. */
export const ANSWER_KEY_RULE =
  "- alternatif_dogru_cevaplar listesindeki her cevap beklenen cevapla eşdeğer doğru kabul edilir. rubrik verilmişse puanı ölçütlerin puanlarına göre ver ve gerekçede karşılanan/eksik ölçütü belirt; rubrik yoksa genel ölçeği kullan.";
