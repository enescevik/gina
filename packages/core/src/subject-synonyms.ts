import { z } from "zod";

/**
 * S04 ders eşanlamlıları. Sunucu `public.suggest_subject(p_text, p_grade)` yalnız aday listesi
 * döndürür; bağlama her zaman veli onayıyla yapılır (tek aday olsa bile). Bu modül sözleşmeyi
 * doğrular ve istemcinin sessiz bağlama yapmasını tip düzeyinde zorlaştırır.
 *
 * Normalizasyon `gina.normalize_subject_alias()` ve `scripts/build-subject-catalog-sql.py`
 * ile birebir aynıdır: Türkçe harf katlama, küçük harf, harf/rakam dışı her şeyi silme,
 * sondaki "dersi" ekini atma.
 */
const FOLD_FROM = "İIıÇçŞşĞğÖöÜüÂâÎîÛûÉé";
const FOLD_TO = "iiiccssggoouuaaiiuuee";

export function normalizeSubjectAlias(text: string): string {
  let folded = "";
  for (const ch of text) {
    const i = FOLD_FROM.indexOf(ch);
    folded += i >= 0 ? FOLD_TO[i] : ch;
  }
  const s = folded.toLowerCase().replace(/[^a-z0-9]/g, "");
  return s.length > 5 && s.endsWith("dersi") ? s.slice(0, -5) : s;
}

export const subjectCandidateSchema = z.object({
  subject_id: z.string().regex(/^subject-[a-z0-9-]+$/),
  label_tr: z.string(),
  label_en: z.string(),
  grade_min: z.number().int(),
  grade_max: z.number().int(),
  in_grade_scope: z.boolean(),
  matched_alias: z.string(),
});
export type SubjectCandidate = z.infer<typeof subjectCandidateSchema>;

export const subjectSuggestionSchema = z.object({
  input: z.string(),
  normalized: z.string(),
  grade: z.number().int().nullable(),
  match: z.enum(["none", "single", "ambiguous"]),
  requires_confirmation: z.literal(true),
  keep_label: z.literal(true),
  scope_note: z.boolean(),
  candidates: z.array(subjectCandidateSchema),
});
export type SubjectSuggestion = z.infer<typeof subjectSuggestionSchema>;

/** Sunucu yanıtını doğrular; `requires_confirmation` true değilse reddeder. */
export function readSubjectSuggestion(value: unknown): SubjectSuggestion {
  return subjectSuggestionSchema.parse(value);
}

export const subjectSynonymSchema = z.object({
  subject_id: z.string(),
  alias: z.string(),
  alias_normalized: z.string(),
  grade_min: z.number().int(),
  grade_max: z.number().int(),
  source: z.enum(["catalog", "policy_ambiguity", "admin"]),
});
export type SubjectSynonym = z.infer<typeof subjectSynonymSchema>;

/** Yönetim listesi için: ders kimliği → görünen eşanlamlılar (normalize tekrarları tekilleştirilir). */
export function groupSubjectSynonyms(
  rows: readonly SubjectSynonym[],
): Map<string, { alias: string; grades: string; ambiguity: boolean }[]> {
  const out = new Map<
    string,
    { alias: string; grades: string; ambiguity: boolean }[]
  >();
  for (const row of rows) {
    const list = out.get(row.subject_id) ?? [];
    const grades =
      row.grade_min === row.grade_max
        ? `${row.grade_min}`
        : `${row.grade_min}–${row.grade_max}`;
    const existing = list.find((x) => x.alias === row.alias);
    if (existing) existing.grades = `${existing.grades}, ${grades}`;
    else
      list.push({
        alias: row.alias,
        grades,
        ambiguity: row.source === "policy_ambiguity",
      });
    out.set(row.subject_id, list);
  }
  return out;
}

/**
 * Velinin seçimiyle bağlama. Seçim yoksa (veya aday listesinde değilse) kimlik yoktur ve
 * velinin yazdığı etiket olduğu gibi kalır. Tek aday dahil hiçbir durumda otomatik seçim yapılmaz.
 */
export function confirmSubjectChoice(
  suggestion: SubjectSuggestion,
  chosenId: string | null,
): { subject_id: string | null; label: string } {
  const label = suggestion.input.trim();
  if (!chosenId) return { subject_id: null, label };
  const hit = suggestion.candidates.find((c) => c.subject_id === chosenId);
  return hit
    ? { subject_id: hit.subject_id, label }
    : { subject_id: null, label };
}
