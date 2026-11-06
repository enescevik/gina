// C04: open-ended answer key extras (alternative correct answers + rubric) stored in
// question_bank.provenance.rubric by both AI generation and parent-written questions.
// Only the grading/review payloads read this; it is never sent to the child.
import { rubricNeedsScaling, scaleRubricTo100 } from "../../../packages/core/src/rubric-scale.ts";

/** D13: what an open-ended question measures. `result` = only the final answer; `process` = steps,
 * justification or a required representation. Stored as provenance.rubric.assesses (optional). */
export const RUBRIC_ASSESSES = ["result", "process"] as const;
export type RubricAssesses = (typeof RUBRIC_ASSESSES)[number];
/** Grading payload value: explicit purpose, or `sorudan_cikar` (legacy/parent rubric without the field). */
export type GradingPurpose = "sonuc" | "surec" | "sorudan_cikar";

export interface AnswerKeyExtras {
  alternatif_dogru_cevaplar: string[];
  rubrik: { olcut: string; puan: number }[];
  degerlendirme_amaci: GradingPurpose;
}

/** Defensive read of provenance.rubric.assesses; anything else → null (infer from the stem). */
export function rubricAssesses(provenance: unknown): RubricAssesses | null {
  const rubric = provenance && typeof provenance === "object"
    ? (provenance as { rubric?: unknown }).rubric
    : null;
  const v = rubric && typeof rubric === "object"
    ? (rubric as { assesses?: unknown }).assesses
    : null;
  return (RUBRIC_ASSESSES as readonly unknown[]).includes(v) ? v as RubricAssesses : null;
}

export function gradingPurpose(provenance: unknown): GradingPurpose {
  const a = rubricAssesses(provenance);
  return a === "result" ? "sonuc" : a === "process" ? "surec" : "sorudan_cikar";
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
  const degerlendirme_amaci = gradingPurpose(provenance);
  if (!rubric || typeof rubric !== "object") {
    return { alternatif_dogru_cevaplar: [], rubrik: [], degerlendirme_amaci };
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
      return [{ olcut: mask(text), points }];
    })
    : [];
  // D6/B3: AI rubriği (ör. toplam 5–6) istemdeki 0–100 puan ölçeğine oranlanır; veli rubriği olduğu gibi kalır.
  const kept = criteria.slice(0, MAX_ITEMS);
  const scaled = rubricNeedsScaling(provenance) ? scaleRubricTo100(kept) : kept;
  return {
    alternatif_dogru_cevaplar: [...new Set(alternatives.map(mask))].slice(
      0,
      MAX_ITEMS,
    ),
    rubrik: scaled.map((c) => ({
      olcut: c.olcut,
      puan: Math.round(c.points),
    })),
    degerlendirme_amaci,
  };
}

/**
 * D13 (prova-grade/v7-purpose-aware): purpose-aware answer-key rule shared by grade and notebook review.
 * v6 gave full marks to any equivalent final answer even when the rubric scored steps; that overrode
 * "show your work / justify" rubrics. Now the per-item `degerlendirme_amaci` decides which branch applies.
 */
export const ANSWER_KEY_RULE =
  `- alternatif_dogru_cevaplar listesindeki her cevap beklenen cevapla eşdeğer doğru sonuç kabul edilir.
- degerlendirme_amaci her maddede verilir ve puanlama dalını seçer:
  • "sonuc": soru yalnız sonucu ölçer. Öğrencinin cevabı beklenen cevaba veya bir alternatife eşdeğerse ve sorunun istediği sonucu veriyorsa, ara adımları ya da rubrikteki ara gösterimi yazmamış olsa bile tam doğru say (90–100). Rubrik yalnız yanlış veya eksik sonuçta kısmi puanı bölmek içindir.
  • "surec": soru işlem adımlarını, gerekçeyi ya da belirli bir gösterimi ölçer. Rubrik ölçütlerini yazıldığı gibi puanla: doğru son cevap yalnız gerçekten karşıladığı ölçütlerin puanını alır; cevapta görünmeyen adım, gerekçe veya gösterim için puan verme ve eksik ölçütü belirt. Alternatif cevaplar sonuç ölçütü için doğru sayılır.
  • "sorudan_cikar": amaç belirtilmemiştir; sorunun metninden karar ver. Soru açıkça işlem/adım göstermeyi, açıklamayı, gerekçelendirmeyi, nedenini yazmayı veya belirli bir gösterimle (ör. kesir, şekil, tablo) yazmayı istiyorsa "surec", yalnız sonucu/cevabı soruyorsa "sonuc" kuralını uygula. Emin değilsen "sonuc" kuralını uygula ve gerekçede hangi dalı seçtiğini belirt.
- rubrik verilmişse ölçüt puanları 100 üzerinden puanın parçalarıdır; puanı karşılanan ölçütlerin puanlarına göre ver ve gerekçede karşılanan/eksik ölçütü belirt; rubrik yoksa genel ölçeği kullan.`;
