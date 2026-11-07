import {blankMarkupMatches} from "./blank-markup";
/**
 * QT10–QT13, QT20–QT21 — veli hazırlama formu modeli (saf).
 *
 * Form durumu → `payload` + `answer_key` (sözleşme: docs/learning/PROVA-QUESTION-TYPES-CONTRACT.md).
 * Kimlikler satır oluşturulurken sayaçtan üretilir (`s1`, `b1`, `l1`, `r1`, …) ve ekran sırasına
 * bağlı değildir: satırı taşımak kimliği değiştirmez, silinen kimlik aynı taslakta yeniden kullanılmaz.
 * Doğrulama `questionContentErrors` (SQL ile aynı kodlar) + yalnız öneri niteliğinde rehberlik.
 */
import { AI_INTERACTION_TYPES } from "./prova-generation-journal";
import { AUTHOR_PRACTICE_ONLY_TYPES } from "./question-authoring-p2";
import {
  PHASE2A_INTERACTION_TYPES,
  PHASE2B_INTERACTION_TYPES,
  PRACTICE_ONLY_TYPES,
  questionContentErrors,
  type StructuredInteractionType,
} from "./question-types";

export interface AuthorRow {
  id: string;
  text: string;
}

export interface TrueFalseDraft {
  type: "true_false";
  statements: (AuthorRow & { answer: boolean | null })[];
}
export interface FillBlankDraft {
  type: "fill_blank";
  /** "Su donunca [[katı]] olur." — klavyede alternatifler `|` ile: [[Ankara|ankara]]. */
  markup: string;
  /** Boşluk kimlikleri metindeki boşluk sırasıyla; yeniden ayrıştırmada cevaba göre korunur. */
  blanks: { id: string; raw: string }[];
  input: "bank" | "keyboard";
  /** Kelime havuzuna eklenen çeldiriciler. */
  distractors: AuthorRow[];
  bankReuse: boolean;
  caseInsensitive: boolean;
}
export interface MatchingDraft {
  type: "matching";
  left: AuthorRow[];
  /** Sağ sütun; eşlenmeyen satırlar çeldiricidir. */
  right: AuthorRow[];
  policy: "one_to_one" | "many_to_one";
  pairs: Record<string, string>;
}
export interface NumericDraft {
  type: "numeric";
  value: string;
  units: AuthorRow[];
  unitRequired: boolean;
  /** Anahtardaki birim (unit_required ise). */
  unit: string | null;
  /** "1 <birim> = x <anahtar birimi>" — boş bırakılan birim dönüştürülmez. */
  factors: Record<string, string>;
  absTolerance: string;
  /** Yüzde (0–50). */
  relTolerancePct: string;
  /** Birimin puandaki payı, yüzde (0–50). */
  unitWeightPct: string;
  processRequired: boolean;
  workArea: boolean;
}
export interface OrderingDraft {
  type: "ordering";
  /** Satır sırası = birinci kabul edilen sıra. */
  items: AuthorRow[];
  mode: "sequence" | "sentence";
  /** Ek kabul edilen sıralar (en çok 4; toplam 5). */
  alternatives: string[][];
}
export interface ClassificationDraft {
  type: "classification";
  categories: (AuthorRow & { capacity: string })[];
  items: (AuthorRow & { category: string | null })[];
}
export type StructuredDraftBody =
  | TrueFalseDraft
  | FillBlankDraft
  | MatchingDraft
  | NumericDraft
  | OrderingDraft
  | ClassificationDraft;
/** Taslak + kimlik sayacı. */
export type StructuredDraft = StructuredDraftBody & { seq: number };

export const ORDERING_MAX_ORDERS = 5;

/** Sayaçtan yeni kimlik; ekran sırasından bağımsız. */
export function allocateId<D extends { seq: number }>(
  draft: D,
  prefix: string,
): [string, D] {
  const seq = draft.seq + 1;
  return [`${prefix}${seq}`, { ...draft, seq }];
}

export function newStructuredDraft(type: StructuredInteractionType): StructuredDraft {
  switch (type) {
    case "true_false":
      return { type, seq: 3, statements: [1, 2, 3].map((n) => ({ id: `s${n}`, text: "", answer: null })) };
    case "fill_blank":
      return { type, seq: 0, markup: "", blanks: [], input: "bank", distractors: [], bankReuse: false, caseInsensitive: false };
    case "matching":
      return {
        type,
        seq: 3,
        left: [{ id: "l1", text: "" }, { id: "l2", text: "" }, { id: "l3", text: "" }],
        right: [{ id: "r1", text: "" }, { id: "r2", text: "" }, { id: "r3", text: "" }],
        policy: "one_to_one",
        pairs: {},
      };
    case "numeric":
      return {
        type,
        seq: 0,
        value: "",
        units: [],
        unitRequired: false,
        unit: null,
        factors: {},
        absTolerance: "",
        relTolerancePct: "",
        unitWeightPct: "",
        processRequired: false,
        workArea: false,
      };
    case "ordering":
      return { type, seq: 3, items: [{ id: "o1", text: "" }, { id: "o2", text: "" }, { id: "o3", text: "" }], mode: "sequence", alternatives: [] };
    case "classification":
      return {
        type,
        seq: 4,
        categories: [{ id: "c1", text: "", capacity: "" }, { id: "c2", text: "", capacity: "" }],
        items: [{ id: "i1", text: "", category: null }, { id: "i2", text: "", category: null }],
      };
  }
}

// ---------------------------------------------------------------------------------------------
// Satır yardımcıları (taşıma kimlik değiştirmez; silme anahtardaki başvuruları temizler)
export function moveRow<T>(rows: T[], index: number, delta: number): T[] {
  const next = index + delta;
  if (index < 0 || index >= rows.length || next < 0 || next >= rows.length) return rows;
  const copy = [...rows];
  [copy[index], copy[next]] = [copy[next]!, copy[index]!];
  return copy;
}
const omit = <V>(o: Record<string, V>, k: string) => Object.fromEntries(Object.entries(o).filter(([x]) => x !== k));

export function removeRow(draft: StructuredDraft, id: string): StructuredDraft {
  switch (draft.type) {
    case "true_false":
      return { ...draft, statements: draft.statements.filter((s) => s.id !== id) };
    case "fill_blank":
      return { ...draft, distractors: draft.distractors.filter((d) => d.id !== id) };
    case "matching":
      return {
        ...draft,
        left: draft.left.filter((r) => r.id !== id),
        right: draft.right.filter((r) => r.id !== id),
        pairs: Object.fromEntries(Object.entries(omit(draft.pairs, id)).filter(([, r]) => r !== id)),
      };
    case "numeric": {
      const units = draft.units.filter((u) => u.id !== id);
      return { ...draft, units, unit: draft.unit === id ? null : draft.unit, factors: omit(draft.factors, id) };
    }
    case "ordering":
      return { ...draft, items: draft.items.filter((r) => r.id !== id), alternatives: draft.alternatives.map((o) => o.filter((x) => x !== id)) };
    case "classification":
      return {
        ...draft,
        categories: draft.categories.filter((c) => c.id !== id),
        items: draft.items.filter((i) => i.id !== id).map((i) => (i.category === id ? { ...i, category: null } : i)),
      };
  }
}

/** Yeni satır ekle (türün ilgili listesine). `side` yalnız eşleştirme/sınıflandırma için. */
export function addRow(draft: StructuredDraft, side?: "left" | "right" | "categories" | "items" | "units" | "distractors"): StructuredDraft {
  switch (draft.type) {
    case "true_false": {
      const [id, d] = allocateId(draft, "s");
      return { ...d, statements: [...d.statements, { id, text: "", answer: null }] };
    }
    case "fill_blank": {
      const [id, d] = allocateId(draft, "d");
      return { ...d, distractors: [...d.distractors, { id, text: "" }] };
    }
    case "matching": {
      const key = side === "left" ? "left" : "right";
      const [id, d] = allocateId(draft, key === "left" ? "l" : "r");
      return { ...d, [key]: [...d[key], { id, text: "" }] };
    }
    case "numeric": {
      const [id, d] = allocateId(draft, "u");
      return { ...d, units: [...d.units, { id, text: "" }] };
    }
    case "ordering": {
      const [id, d] = allocateId(draft, "o");
      return { ...d, items: [...d.items, { id, text: "" }], alternatives: d.alternatives.map((o) => [...o, id]) };
    }
    case "classification": {
      if (side === "categories") {
        const [id, d] = allocateId(draft, "c");
        return { ...d, categories: [...d.categories, { id, text: "", capacity: "" }] };
      }
      const [id, d] = allocateId(draft, "i");
      return { ...d, items: [...d.items, { id, text: "", category: null }] };
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Boşluk doldurma: işaretli metni ayrıştır, boşluk kimliklerini cevaba göre koru.
const normWord = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ");

/** Metin değişince boşluk kimliklerini eşleştir: aynı ham cevap → aynı kimlik; yeni boşluk → yeni kimlik. */
export function reconcileBlanks(draft: FillBlankDraft & { seq: number }, markup: string): FillBlankDraft & { seq: number } {
  const raws = [...blankMarkupMatches(markup)].map((m) => m[1] ?? "");
  const free = [...draft.blanks];
  let seq = draft.seq;
  const used = new Set<string>();
  const blanks = raws.map((raw, i) => {
    let at = free.findIndex((b) => b.raw === raw && !used.has(b.id));
    // Aynı konumda düzenlenen cevap: kimliği koru (ör. yazım düzeltmesi).
    if (at < 0 && raws.length === draft.blanks.length && draft.blanks[i] && !used.has(draft.blanks[i]!.id)) {
      at = free.findIndex((b) => b.id === draft.blanks[i]!.id);
    }
    if (at >= 0) {
      const b = free.splice(at, 1)[0]!;
      used.add(b.id);
      return { id: b.id, raw };
    }
    seq += 1;
    const id = `b${seq}`;
    used.add(id);
    return { id, raw };
  });
  return { ...draft, markup, blanks, seq };
}

function fillBlankParts(d: FillBlankDraft) {
  const segments: ({ type: "text"; text: string } | { type: "blank"; id: string })[] = [];
  let last = 0;
  let i = 0;
  for (const m of blankMarkupMatches(d.markup)) {
    if (m.index! > last) segments.push({ type: "text", text: d.markup.slice(last, m.index) });
    const id = d.blanks[i]?.id ?? `b_x${i}`;
    segments.push({ type: "blank", id });
    i += 1;
    last = m.index! + m[0].length;
  }
  if (last < d.markup.length) segments.push({ type: "text", text: d.markup.slice(last) });
  const accepted = Object.fromEntries(d.blanks.map((b) => [b.id, b.raw.split("|").map(normWord).filter(Boolean)]));
  return { segments, accepted };
}

// ---------------------------------------------------------------------------------------------
const trimRows = (rows: AuthorRow[]) => rows.map((r) => ({ id: r.id, text: r.text.trim() }));
/** Kontrollü sayı alanı (tolerans/yüzde). Boş → undefined; geçersiz → NaN (sunucu kodu üretir). */
function optionalNumber(input: string): number | undefined {
  const s = input.trim().replace(",", ".");
  if (!s) return undefined;
  return /^[0-9]+(\.[0-9]+)?$/.test(s) ? Number(s) : Number.NaN;
}

/** Form → sözleşme şekli. Sunucuya giden gövdenin aynısı (doğrulama ayrı). */
export function buildStructuredContent(draft: StructuredDraft): { payload: Record<string, unknown>; answer_key: Record<string, unknown> } {
  switch (draft.type) {
    case "true_false":
      return {
        payload: { statements: trimRows(draft.statements) },
        answer_key: { answers: Object.fromEntries(draft.statements.filter((s) => s.answer !== null).map((s) => [s.id, s.answer])) },
      };
    case "fill_blank": {
      const { segments, accepted } = fillBlankParts(draft);
      if (draft.input === "keyboard") {
        return {
          payload: { segments, input: "keyboard" },
          answer_key: {
            blanks: Object.fromEntries(Object.entries(accepted).map(([id, a]) => [id, { accepted: a }])),
            ...(draft.caseInsensitive ? { case_insensitive: true } : {}),
          },
        };
      }
      // Havuz: her boşluğun ilk cevabı bir kelime; tekrar serbestse aynı kelime tek kart.
      const bank: AuthorRow[] = [];
      const tokens: Record<string, { tokens: string[] }> = {};
      for (const b of draft.blanks) {
        const word = accepted[b.id]?.[0] ?? "";
        const same = draft.bankReuse ? bank.find((w) => w.text === word && word) : undefined;
        if (same) tokens[b.id] = { tokens: [same.id] };
        else {
          const id = `w${b.id}`;
          bank.push({ id, text: word });
          tokens[b.id] = { tokens: [id] };
        }
      }
      bank.push(...trimRows(draft.distractors));
      return {
        payload: { segments, input: "bank", bank, bank_reuse: draft.bankReuse },
        answer_key: { blanks: tokens },
      };
    }
    case "matching":
      return {
        payload: { left: trimRows(draft.left), right: trimRows(draft.right), policy: draft.policy },
        answer_key: { pairs: Object.fromEntries(draft.left.filter((l) => draft.pairs[l.id]).map((l) => [l.id, draft.pairs[l.id]])) },
      };
    case "numeric": {
      const units = trimRows(draft.units);
      const key: Record<string, unknown> = { value: draft.value.trim() };
      const abs = optionalNumber(draft.absTolerance);
      const rel = optionalNumber(draft.relTolerancePct);
      const uw = optionalNumber(draft.unitWeightPct);
      if (abs !== undefined) key.abs_tolerance = abs;
      if (rel !== undefined) key.rel_tolerance = rel / 100;
      if (draft.unitRequired) {
        if (draft.unit) key.unit = draft.unit;
        const factors = Object.entries(draft.factors).filter(([u, f]) => u !== draft.unit && f.trim() && units.some((x) => x.id === u));
        if (factors.length && draft.unit) {
          key.unit_factors = { [draft.unit]: 1, ...Object.fromEntries(factors.map(([u, f]) => [u, Number(f.trim().replace(",", "."))])) };
        }
        if (uw !== undefined) key.unit_weight = uw / 100;
      }
      if (draft.processRequired) key.process_required = true;
      return {
        payload: { units: draft.unitRequired ? units : [], unit_required: draft.unitRequired, ...(draft.workArea ? { work_area: true } : {}) },
        answer_key: key,
      };
    }
    case "ordering":
      return {
        payload: { items: trimRows(draft.items), mode: draft.mode },
        answer_key: { orders: [draft.items.map((i) => i.id), ...draft.alternatives] },
      };
    case "classification":
      return {
        payload: {
          items: trimRows(draft.items),
          categories: draft.categories.map((c) => {
            const cap = optionalNumber(c.capacity);
            return { id: c.id, text: c.text.trim(), ...(cap !== undefined ? { capacity: cap } : {}) };
          }),
        },
        answer_key: { membership: Object.fromEntries(draft.items.filter((i) => i.category).map((i) => [i.id, i.category])) },
      };
  }
}

function rowsOf(d: StructuredDraft): AuthorRow[] {
  switch (d.type) {
    case "true_false": return d.statements;
    case "fill_blank": return d.input === "bank" ? d.distractors : [];
    case "matching": return [...d.left, ...d.right];
    case "numeric": return d.unitRequired ? d.units : [];
    case "ordering": return d.items;
    case "classification": return [...d.categories, ...d.items];
  }
}

/** Sunucuyla aynı kodlar + formda sunucuya gitmeden yakalanan birkaç açık durum. */
export function structuredDraftErrors(draft: StructuredDraft): string[] {
  const { payload, answer_key } = buildStructuredContent(draft);
  const errs = new Set(questionContentErrors(draft.type, payload, answer_key));
  if (rowsOf(draft).some((r) => !r.text.trim())) errs.add("row_empty");
  if (draft.type === "fill_blank" && draft.blanks.some((b) => !b.raw.split("|").some((x) => normWord(x)))) errs.add("blank_empty");
  if (draft.type === "numeric") {
    for (const [u, f] of Object.entries(draft.factors)) {
      if (u !== draft.unit && f.trim() && !(Number(f.trim().replace(",", ".")) > 0)) errs.add("unit_factors_invalid");
    }
    if (draft.unitRequired && !draft.unit) errs.add("key_unit_invalid");
  }
  if (draft.type === "ordering" && draft.alternatives.length + 1 > ORDERING_MAX_ORDERS) errs.add("orders_too_many");
  return [...errs].sort();
}

/** Yalnız öneri (katı kural değil) — plan §6 QT10/QT11. */
export type AuthorGuidance = "tf_count" | "tf_single_judgement" | "fill_bank_suggest" | "fill_typing_suggest" | "matching_distractor" | "numeric_process_manual";
export function authorGuidance(draft: StructuredDraft): AuthorGuidance[] {
  const out: AuthorGuidance[] = [];
  if (draft.type === "true_false") {
    if (draft.statements.length < 3 || draft.statements.length > 5) out.push("tf_count");
    // Birden fazla yargı işareti: "ve", "ama", "çünkü", ";" … (yalnız ipucu).
    if (draft.statements.some((s) => /(\s(ve|ama|fakat|ancak|çünkü|and|but|because)\s)|;/i.test(s.text))) out.push("tf_single_judgement");
  }
  if (draft.type === "fill_blank") {
    const n = draft.blanks.length;
    if (n >= 1 && n <= 3 && draft.input === "keyboard") out.push("fill_bank_suggest");
    if (n >= 4 && draft.input === "bank") out.push("fill_typing_suggest");
  }
  if (draft.type === "matching" && draft.policy === "one_to_one" && draft.right.length === draft.left.length) out.push("matching_distractor");
  if (draft.type === "numeric" && draft.processRequired) out.push("numeric_process_manual");
  return out;
}

/** Sunucu `question_structure_invalid` DETAIL'i (virgüllü) → kodlar. Diğer hatalarda mesaj kodu. */
export function structuredSaveErrorCodes(error: unknown): string[] {
  if (!error || typeof error !== "object") return [];
  const e = error as { message?: unknown; details?: unknown };
  if (e.message === "question_structure_invalid" && typeof e.details === "string" && e.details.trim()) {
    return e.details.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return typeof e.message === "string" ? [e.message] : [];
}

/** OYSS/ortak yazılı (meb_common) sınavında kullanılamayan türler. */
export function blockedForTrack(track: string | null | undefined, types: (string | null | undefined)[]): string[] {
  if (track !== "meb_common") return [];
  // 1A/1B alıştırma türleri + bütün 2A/2B türleri (SQL interaction_types.practice_only).
  return [...new Set(types.filter((t): t is string => !!t && AUTHOR_PRACTICE_ONLY_TYPES.has(t)))];
}

/**
 * Prova türü (Şıklı / Açık uçlu / Karma; "Yazılıya hazırlık" amacı Açık uçluya sabitlenir) ile yapılandırılmış soru uyumu.
 * Karar (7 Kasım 2026): sayısal kısa cevap açık uçlu/yazılı amacında Karma'ya zorlamadan eklenebilir; Şıklı'da ve
 * diğer yapılandırılmış türlerde Karma uyarısı kalır.
 */
export function structuredFitsKind(kind: "mixed" | "multiple_choice" | "open_ended", type: string | null | undefined): boolean {
  if (kind === "mixed") return true;
  return kind === "open_ended" && type === "numeric";
}

/** Cihaz destek bildirimi (get_child_question_type_support) → bildirmemiş türler. Uyarıdır, engel değildir. */
export interface DeviceTypeSupport {
  device_id: string;
  name: string | null;
  question_types: string[] | null;
  reported_at: string | null;
}
export function unsupportedTypesForChild(devices: DeviceTypeSupport[], used: string[]): { missing: string[]; noDevice: boolean } {
  const types = [...new Set(used)];
  if (!types.length) return { missing: [], noDevice: false };
  if (!devices.length) return { missing: types, noDevice: true };
  // En az bir cihaz bütün türleri bildirmişse sorun yok; değilse hiçbir cihazın bildirmediği türler listelenir.
  if (devices.some((d) => types.every((t) => d.question_types?.includes(t)))) return { missing: [], noDevice: false };
  const missing = types.filter((t) => !devices.some((d) => d.question_types?.includes(t)));
  return { missing: missing.length ? missing : types, noDevice: false };
}

// ---------------------------------------------------------------------------------------------
// QT-AI: veli AI üretiminde tür seçimi. Yazılı/OYSS (meb_common) isteğinde yalnız açık uçlu + sayısal
// (sunucu `parseInteractionTypes` aynı kuralı uygular: `interaction_type_not_allowed_for_track`).
export type AiInteractionType = (typeof AI_INTERACTION_TYPES)[number];
export const AI_WRITTEN_TRACK_TYPES: readonly AiInteractionType[] = ["open_ended", "numeric"];
/** Faz anahtarları kapalıyken (varsayılan) yalnız 1A/1B + eski türler; 2A/2B ayrı anahtarlarla görünür. */
export function aiTypesAllowed(writtenTrack: boolean, phases: { phase2a?: boolean; phase2b?: boolean } = {}): readonly AiInteractionType[] {
  if (writtenTrack) return AI_WRITTEN_TRACK_TYPES;
  return AI_INTERACTION_TYPES.filter((t) =>
    (PHASE2A_INTERACTION_TYPES as readonly string[]).includes(t) ? !!phases.phase2a
      : (PHASE2B_INTERACTION_TYPES as readonly string[]).includes(t) ? !!phases.phase2b : true);
}
/** Seçimi isteğe çevirir: boş seçim → undefined (alan hiç gönderilmez, eski davranış). Sıra sabit (kanonik). */
export function aiInteractionTypesFor(selected: readonly string[], writtenTrack: boolean, phases: { phase2a?: boolean; phase2b?: boolean } = {}): AiInteractionType[] | undefined {
  const allowed = aiTypesAllowed(writtenTrack, phases);
  const out = allowed.filter((t) => selected.includes(t));
  return out.length ? [...out] : undefined;
}
