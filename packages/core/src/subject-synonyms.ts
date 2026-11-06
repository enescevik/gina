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

/** C02 server link: child lesson name → parent-confirmed catalogue id (`child_subject_links`). */
export const subjectLinkSchema = z.object({
  alias_normalized: z.string(),
  /** The text the parent confirmed, as written in the document/table (provenance). */
  title: z.string(),
  subject_id: z.string(),
  label_tr: z.string(),
  label_en: z.string(),
  active: z.boolean(),
  source: z.enum(["manual", "device_import"]),
  revision: z.number().int(),
  linked_at: z.string(),
});
export type SubjectLink = z.infer<typeof subjectLinkSchema>;
export const subjectLinksSchema = z.object({
  child_id: z.uuid(),
  links: z.array(subjectLinkSchema),
});
export const subjectLinksReceiptSchema = subjectLinksSchema.extend({ changed: z.number().int() });

/** Link for a lesson name (same normalisation as the server). */
export function linkForTitle(links: readonly SubjectLink[], title: string): SubjectLink | null {
  const key = normalizeSubjectAlias(title);
  return key ? links.find((l) => l.alias_normalized === key) ?? null : null;
}

/**
 * How a lesson is shown: the catalogue title (Turkish/English as the catalogue writes it) when the
 * parent confirmed one, with the original text kept underneath when it differs. Unlinked lessons keep
 * their own name exactly.
 */
export function subjectDisplay(
  lesson: { title: string; subject_label_tr?: string | null; subject_label_en?: string | null },
  english = false,
): { title: string; original: string | null } {
  const label = english ? lesson.subject_label_en : lesson.subject_label_tr;
  if (!label) return { title: lesson.title, original: null };
  const same = normalizeSubjectAlias(label) === normalizeSubjectAlias(lesson.title);
  return { title: label, original: same ? null : lesson.title };
}

/**
 * Old device-only bindings (U05, `gina:timetable:subjects:v1:*`) that are not on the server yet. A name
 * the server already links to another subject is a conflict: it is shown, never sent silently.
 */
export function deviceBindingsToImport(
  local: Readonly<Record<string, { subject_id: string; label_tr: string; label_en: string; title?: string }>>,
  server: readonly SubjectLink[],
): {
  send: { key: string; title: string; subject_id: string; label_tr: string; label_en: string }[];
  conflicts: { key: string; title: string; local: string; server: string }[];
  same: string[];
} {
  const send: { key: string; title: string; subject_id: string; label_tr: string; label_en: string }[] = [];
  const conflicts: { key: string; title: string; local: string; server: string }[] = [];
  const same: string[] = [];
  for (const [key, b] of Object.entries(local)) {
    if (!key || !/^subject-[a-z0-9-]+$/.test(b?.subject_id ?? "")) continue;
    const s = server.find((l) => l.alias_normalized === key);
    const title = b.title?.trim() || s?.title || key;
    if (!s) send.push({ key, title, subject_id: b.subject_id, label_tr: b.label_tr, label_en: b.label_en });
    else if (s.subject_id === b.subject_id) same.push(key);
    else conflicts.push({ key, title, local: b.label_tr, server: s.label_tr });
  }
  return { send, conflicts, same };
}
