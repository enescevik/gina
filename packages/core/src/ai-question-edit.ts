// D14 — Veli AI sorusunu düzenler. Sunucu (`save_ai_question_edit` / `save_ai_group_edit`) özgünü değiştirmez; yeni satır
// (generator "ai_edited", edited_from/edited_root) ya da yeni grup sürümü yazar. Bu dosya istemci tarafı saf yardımcılardır:
// düzenlenebilirlik, taslakta blok değiştirme, rubrik → editör metni ve canlı kişi adı ipucu (sunucudaki denetimin aynası).
import type { ProvaBlock, ProvaDraft, QuestionRubric } from "./prova-draft";
import type { QuestionContentReview } from "./question-content-review";

const record = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null;

/** AI kaynaklı (ya da daha önce düzenlenmiş AI) soru mu? Elle/kütüphane sorusu için false. */
export function isAiEditable(provenance: unknown): boolean {
  const g = record(provenance)?.generator;
  return g === "ai" || g === "ai_edited";
}

/** Düzenleme zincirinin ilk AI satırı (düzenlenmemiş soruda kendi kimliği). */
export function aiEditRoot(row: { id: string; provenance?: unknown }): string {
  const root = record(row.provenance)?.edited_root;
  return typeof root === "string" && root ? root : row.id;
}

/**
 * Taslakta `fromId` bloğunu yerinde `block` ile değiştirir (sıra korunur). Blok yoksa sona ekler; yeni kimlik zaten
 * taslaktaysa yalnız eskisini çıkarır. D1 `fitAccepted` kabulü aynı soruya aitse yeni kimliğe taşınır.
 */
export function replaceProvaBlock(
  draft: ProvaDraft,
  fromId: string,
  block: ProvaBlock,
  acceptedIds: { from: string[]; to: string[] } = { from: [fromId], to: [block.id] },
): ProvaDraft {
  const has = draft.blocks.some((b) => b.id === block.id);
  const at = draft.blocks.findIndex((b) => b.id === fromId);
  let blocks: ProvaBlock[];
  if (at < 0) blocks = has ? draft.blocks : [...draft.blocks, block];
  else if (has) blocks = draft.blocks.filter((b) => b.id !== fromId);
  // Yerinde değişimde bloğun kaynağı (ai/document) korunur.
  else blocks = draft.blocks.map((b, i) => (i === at ? { ...block, source: b.source } : b));
  if (!draft.fitAccepted) return { ...draft, blocks };
  const accepted = new Set(draft.fitAccepted);
  acceptedIds.from.forEach((id, i) => {
    if (!accepted.has(id)) return;
    accepted.delete(id);
    const next = acceptedIds.to[i];
    if (next) accepted.add(next);
  });
  return { ...draft, blocks, fitAccepted: [...accepted] };
}

/** Rubrik → editör metni (`parseRubricInput` tersi): alternatifler satır satır, ölçütler "metin | puan". */
export function rubricToInput(rubric: QuestionRubric): { alternatives: string; criteria: string } {
  return {
    alternatives: rubric.alternative_answers.join("\n"),
    criteria: rubric.criteria.map((c) => `${c.text} | ${Math.round(c.points)}`).join("\n"),
  };
}

const LETTER = "A-Za-zÀ-ÖØ-öø-ÿçğıöşüâîûÇĞİÖŞÜÂÎÛ";
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Özgün uyarıda işaretlenen adlardan düzenlenmiş metinde hâlâ geçenler (büyük/küçük harf duyarlı, harf sınırı; "Elif'in"
 * eşleşir, "Elifçe" eşleşmez). Sunucudaki `gina.ai_edit_content_review` ile aynı kural; yalnız canlı ipucu içindir.
 */
export function remainingFlaggedNames(
  review: QuestionContentReview | null,
  texts: string[],
): string[] {
  if (!review) return [];
  const names = [...new Set(review.flags.flatMap((f) => f.names.map((n) => n.trim())).filter(Boolean))];
  return names.filter((name) => {
    const re = new RegExp(`(^|[^${LETTER}])${escape(name)}($|[^${LETTER}])`, "u");
    return texts.some((t) => re.test(t));
  });
}
