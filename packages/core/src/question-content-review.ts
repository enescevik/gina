// D9/B6 — AI sorusu içerik uyarısı. `prova-generate` kişi adı bulduğunda soruyu reddetmez; provenance'a
// `content_review: { status: "needs_review", detector, flags[] }` yazar. Bu dosya o alanın tipi ve savunmacı
// okuyucusudur (eski/bozuk provenance → null). Bağımlılıksızdır. D10: veli AI öneri ve taslak önizlemesinde gösterilir.

export interface QuestionContentReviewFlag {
  code: "person_name";
  names: string[];
  /** stem | choice_<key> | shared_source */
  fields: string[];
  suggestion: string;
}

export interface QuestionContentReview {
  status: "needs_review";
  detector: string;
  flags: QuestionContentReviewFlag[];
}

const strings = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, max) : [];

/** Savunmacı okuma: yalnız tanınan biçim döner; aksi halde null (uyarı yok sayılır, hata atılmaz). */
export function readQuestionContentReview(provenance: unknown): QuestionContentReview | null {
  if (!provenance || typeof provenance !== "object") return null;
  const raw = (provenance as { content_review?: unknown }).content_review;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { status?: unknown; detector?: unknown; flags?: unknown };
  if (r.status !== "needs_review" || !Array.isArray(r.flags)) return null;
  const flags = r.flags.flatMap((f): QuestionContentReviewFlag[] => {
    if (!f || typeof f !== "object") return [];
    const x = f as { code?: unknown; names?: unknown; fields?: unknown; suggestion?: unknown };
    const names = strings(x.names, 20);
    if (x.code !== "person_name" || !names.length) return [];
    return [{
      code: "person_name",
      names,
      fields: strings(x.fields, 20),
      suggestion: typeof x.suggestion === "string" ? x.suggestion.slice(0, 500) : "",
    }];
  });
  if (!flags.length) return null;
  return { status: "needs_review", detector: typeof r.detector === "string" ? r.detector : "", flags };
}

/**
 * D10: bir soru satırının içerik uyarısı. İki biçimi de okur: üretim sonucu öğesi (`complete_prova_generation_v2`
 * → `questions[].content_review`, yalnız status + flags) ve `question_bank` satırı (`provenance.content_review`).
 * Yalnız veli ekranları içindir; çocuk istemcisi soru satırı/provenance okumaz.
 */
export function questionContentReviewOf(row: unknown): QuestionContentReview | null {
  if (!row || typeof row !== "object") return null;
  return readQuestionContentReview(row) ?? readQuestionContentReview((row as { provenance?: unknown }).provenance);
}

/** Uyarıdaki kişi adları, ilk görülme sırasıyla tekilleştirilmiş. */
export function contentReviewNames(review: QuestionContentReview | null): string[] {
  if (!review) return [];
  return [...new Set(review.flags.flatMap((f) => f.names.map((n) => n.trim())).filter(Boolean))];
}
