// QT-AI — AI üretiminde yapılandırılmış soru türleri (prova-generate).
//
// Model, her yapılandırılmış soruyu açık bir ayırıcıyla (`interaction_type` + `schema_version: 1`) ve türe özgü,
// katı (`additionalProperties: false`, bütün alanlar zorunlu) bir `structure` nesnesiyle döndürür. Bu modül:
//   1. İstek seçeneğini (`interaction_types`) doğrular; OYSS/ortak yazılı (meb_common) isteğinde alıştırma
//      türlerini açık nedenle reddeder (sessizce açık uçluya çevirmez).
//   2. Sağlayıcı JSON şemasını tür başına kurar (yalnız istenen türler).
//   3. Model çıktısını öğrenci `payload`'ı ve özel `answer_key`'e ayırır. Payload yalnız izin listesindeki alanlardan
//      YENİDEN kurulur; anahtar, çözüm, rubrik, provenance veya istem payload'a hiçbir yoldan giremez.
//   4. Deterministik doğrulama: core/SQL ile aynı kodlar (`questionContentErrors`) + AI'ya özgü red-team kuralları
//      (aynı görünen metin, kabul edilmemiş eşdeğer sıra, görsel olmayan öğeye atıf, birim oranı, cevap sızıntısı).
// Herhangi bir hata satırı, dolayısıyla işin tamamını reddeder (çağıran mevcut `ai_result_invalid` yolunu izler).
import { questionContentErrors } from "./question-structure.ts";

export const LEGACY_INTERACTION_TYPES = ["multiple_choice", "open_ended"] as const;
export const STRUCTURED_INTERACTION_TYPES = [
  "true_false",
  "fill_blank",
  "matching",
  "numeric",
  "ordering",
  "classification",
] as const;
export type LegacyInteractionType = (typeof LEGACY_INTERACTION_TYPES)[number];
export type StructuredInteractionType = (typeof STRUCTURED_INTERACTION_TYPES)[number];
export type InteractionType = LegacyInteractionType | StructuredInteractionType;
/** Core `PRACTICE_ONLY_TYPES` ve SQL `interaction_types.practice_only` ile aynı küme. */
export const PRACTICE_ONLY_TYPES: ReadonlySet<string> = new Set([
  "true_false",
  "fill_blank",
  "matching",
  "ordering",
  "classification",
]);
const ALL_TYPES: readonly string[] = [...LEGACY_INTERACTION_TYPES, ...STRUCTURED_INTERACTION_TYPES];
export const isStructuredType = (t: unknown): t is StructuredInteractionType =>
  typeof t === "string" && (STRUCTURED_INTERACTION_TYPES as readonly string[]).includes(t);

// ---------------------------------------------------------------------------------------------------------------
// 1) İstek seçeneği
export type InteractionRequest =
  | { types: InteractionType[] }
  | { error: "interaction_types_invalid" | "interaction_type_not_allowed_for_track"; details?: Record<string, string> };

/**
 * `interaction_types` yoksa null (eski davranış aynen). Varsa: 1–8 benzersiz bilinen tür.
 * Yazılı/OYSS (`writtenTrack`): alıştırma türleri ve şıklı soru reddedilir (eski yazılı yolu da yalnız açık uçlu
 * üretir); izinli olanlar `open_ended` ve `numeric` (numeric "OYSS uyumlu" iddiası değildir).
 */
export function parseInteractionTypes(raw: unknown, writtenTrack: boolean): InteractionRequest | null {
  if (raw === undefined || raw === null) return null;
  if (
    !Array.isArray(raw) || raw.length < 1 || raw.length > ALL_TYPES.length ||
    raw.some((t) => typeof t !== "string" || !ALL_TYPES.includes(t)) || new Set(raw).size !== raw.length
  ) return { error: "interaction_types_invalid" };
  const types = raw as InteractionType[];
  if (writtenTrack) {
    const refused = types.filter((t) => PRACTICE_ONLY_TYPES.has(t) || t === "multiple_choice");
    if (refused.length) {
      return {
        error: "interaction_type_not_allowed_for_track",
        details: { track: "meb_common", types: refused.join(",") },
      };
    }
  }
  return { types };
}
/** Eski `kind` alanı (bağlam/doğrulayıcı) için yalnız eski türlerden türetilir. */
export function legacyKindFor(types: readonly string[]): "mixed" | "multiple_choice" | "open_ended" {
  const mc = types.includes("multiple_choice"), oe = types.includes("open_ended");
  return mc && !oe ? "multiple_choice" : oe && !mc ? "open_ended" : "mixed";
}

// ---------------------------------------------------------------------------------------------------------------
// 2) Sağlayıcı şeması. Kimlik deseni/adet sınırları sağlayıcılar arasında taşınabilir olmadığı için açıklamada
// belirtilir; sınırların hepsi sunucuda deterministik olarak doğrulanır.
const str = (description?: string) => ({ type: "string", ...(description ? { description } : {}) });
const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const arr = (items: unknown, description?: string) => ({ type: "array", items, ...(description ? { description } : {}) });
const ID_RULE = "Id: lowercase letter first, then lowercase letters/digits/underscore, max 24 chars; unique within the question.";
const entry = obj({ id: str(ID_RULE), text: str() });

export const STRUCTURE_JSON_SCHEMAS: Record<StructuredInteractionType, Record<string, unknown>> = {
  true_false: obj({
    statements: arr(obj({ id: str(ID_RULE), text: str("One single-judgement statement."), answer: { type: "boolean" } }), "1-10 statements, 3-5 recommended."),
  }),
  fill_blank: obj({
    input: { type: "string", enum: ["bank", "keyboard"] },
    segments: arr(
      obj({
        type: { type: "string", enum: ["text", "blank"] },
        text: str("Text segment content; empty string for a blank."),
        id: str("Blank id; empty string for a text segment."),
        accepted: arr(str(), "Keyboard input: every accepted spelling (1-8). Empty for bank input or text segments."),
        tokens: arr(str(), "Bank input: accepted bank entry ids (1-4). Empty for keyboard input or text segments."),
      }),
      "2-40 segments, 1-10 blanks.",
    ),
    bank: arr(entry, "Bank input: 2-16 words (may include distractors). Empty for keyboard input."),
    bank_reuse: { type: "boolean", description: "Bank input: may a word be used in two blanks. false for keyboard." },
    case_insensitive: { type: "boolean", description: "Keyboard input only (tr-TR case folding). false for bank." },
  }),
  matching: obj({
    policy: { type: "string", enum: ["one_to_one", "many_to_one"] },
    left: arr(entry, "2-8 items."),
    right: arr(entry, "2-10 items; one_to_one needs at least as many as left."),
    pairs: arr(obj({ left: str("Left id."), right: str("Right id.") }), "Exactly one pair per left item."),
  }),
  numeric: obj({
    units: arr(entry, "Unit choices (max 8); empty when no unit is required."),
    unit_required: { type: "boolean" },
    work_area: { type: "boolean", description: "true if the child may show working in the notebook." },
    value: str('Correct number as text, e.g. "150", "1,5", "3/4".'),
    unit: str("Unit id of the correct value; empty string when no unit is required."),
    unit_factors: arr(obj({ unit: str("Unit id."), factor: { type: "number" } }), "Factor of each unit relative to `unit` (that unit = 1). Empty when no unit."),
    abs_tolerance: { type: "number" },
    rel_tolerance: { type: "number" },
    unit_weight: { type: "number", description: "0 = unit not scored separately." },
    process_required: { type: "boolean", description: "true = working is assessed (parent scores)." },
  }),
  ordering: obj({
    mode: { type: "string", enum: ["sequence", "sentence"] },
    items: arr(entry, "2-10 items; identical words get distinct ids."),
    orders: arr(arr(str()), "Every accepted complete order of all item ids (1-5)."),
  }),
  classification: obj({
    categories: arr(obj({ id: str(ID_RULE), text: str(), capacity: { type: "integer", description: "0 = no limit." } }), "2-5 mutually exclusive categories."),
    items: arr(obj({ id: str(ID_RULE), text: str(), category: str("Id of the single correct category.") }), "2-16 items."),
  }),
};
/** Yapılandırılmış soru nesnesinin üst düzey alanları (stem, çözüm, senaryo izi). Rubrik/şık yoktur. */
function structuredQuestionSchema(type: StructuredInteractionType, difficulties: readonly string[], cognitive: readonly string[]) {
  return obj({
    interaction_type: { type: "string", enum: [type] },
    schema_version: { type: "integer", description: "Always 1." },
    topic: str(),
    difficulty: { type: "string", enum: [...difficulties] },
    stem: str("Instruction/question shown to the child; never contains the answer."),
    structure: STRUCTURE_JSON_SCHEMAS[type],
    solution: str("Short solution for the parent (private)."),
    explanation: str(),
    source_urls: arr(str()),
    block_id: str(),
    outcome_ids: arr(str()),
    cognitive_demand: { type: "string", enum: ["", ...cognitive] },
    intended_difficulty: { type: "string", enum: ["", ...difficulties] },
    shared_source_id: str(),
  });
}
/**
 * Yapılandırılmış istek şeması: `questions.items` = istenen türlerin `anyOf` birleşimi. Eski türler istenmişse
 * mevcut soru şeması aynen kullanılır, yalnız `interaction_type` ayırıcısı eklenir ve `kind` istenenlerle daraltılır.
 */
export function structuredGenerationSchema(
  base: { properties: { questions: { items: Record<string, unknown> } } } & Record<string, unknown>,
  types: readonly InteractionType[],
  vocab: { difficulties: readonly string[]; cognitive: readonly string[] },
) {
  const legacyItem = base.properties.questions.items as {
    properties: Record<string, unknown>;
    required: string[];
  } & Record<string, unknown>;
  const legacy = types.filter((t): t is LegacyInteractionType => (LEGACY_INTERACTION_TYPES as readonly string[]).includes(t));
  const variants: unknown[] = [];
  if (legacy.length) {
    variants.push({
      ...legacyItem,
      required: [...legacyItem.required, "interaction_type"],
      properties: {
        ...legacyItem.properties,
        interaction_type: { type: "string", enum: legacy },
        kind: { type: "string", enum: legacy },
      },
    });
  }
  for (const t of types) if (isStructuredType(t)) variants.push(structuredQuestionSchema(t, vocab.difficulties, vocab.cognitive));
  return {
    ...base,
    properties: {
      ...base.properties,
      questions: { type: "array", items: variants.length === 1 ? variants[0] : { anyOf: variants } },
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// 3) Ayrıştırma: model biçimi → öğrenci payload'ı + özel anahtar
type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const exactKeys = (o: unknown, keys: readonly string[]) =>
  isObj(o) && Object.keys(o).length === keys.length && keys.every((k) => k in o);
const STRUCTURED_TOP = [
  "interaction_type",
  "schema_version",
  "topic",
  "difficulty",
  "stem",
  "structure",
  "solution",
  "explanation",
  "source_urls",
  "block_id",
  "outcome_ids",
  "cognitive_demand",
  "intended_difficulty",
  "shared_source_id",
] as const;
const STRUCTURE_KEYS: Record<StructuredInteractionType, string[]> = Object.fromEntries(
  Object.entries(STRUCTURE_JSON_SCHEMAS).map(([t, s]) => [t, Object.keys((s as { properties: Obj }).properties)]),
) as Record<StructuredInteractionType, string[]>;

export interface StructuredSplit {
  interaction_type: StructuredInteractionType;
  schema_version: 1;
  payload: Obj;
  answer_key: Obj;
}
export type SplitResult = { ok: true; value: StructuredSplit } | { ok: false; errors: string[] };

/** Girdiyi [{id,text}] dizisine kopyalar (yalnız iki alan); biçim bozuksa olduğu gibi bırakır (core reddeder). */
const entries = (v: unknown) =>
  Array.isArray(v) ? v.map((e) => (exactKeys(e, ["id", "text"]) ? { id: (e as Obj).id, text: (e as Obj).text } : e)) : v;
/** [{a,b}] → {a: b}; yinelenen kimlik (çelişkili ya da tekrarlı anahtar) `duplicate_id`. */
function toMap(list: unknown, k: string, v: string, err: Set<string>): Obj | null {
  if (!Array.isArray(list)) return null;
  const out: Obj = {};
  for (const e of list) {
    if (!exactKeys(e, [k, v]) || typeof (e as Obj)[k] !== "string") return null;
    const id = (e as Obj)[k] as string;
    if (id in out) err.add("duplicate_id");
    out[id] = (e as Obj)[v];
  }
  return out;
}

export function splitStructuredQuestion(q: unknown): SplitResult {
  if (!isObj(q) || !isStructuredType(q.interaction_type)) return { ok: false, errors: ["type_unknown"] };
  if (q.schema_version !== 1) return { ok: false, errors: ["schema_version_unsupported"] };
  const type = q.interaction_type;
  if (!exactKeys(q, STRUCTURED_TOP) || !exactKeys(q.structure, STRUCTURE_KEYS[type])) {
    return { ok: false, errors: ["payload_unknown_field"] };
  }
  const s = q.structure as Obj;
  const err = new Set<string>();
  let payload: Obj, key: Obj;
  const fail = (code: string): SplitResult => ({ ok: false, errors: [...new Set([...err, code])].sort() });
  switch (type) {
    case "true_false": {
      if (!Array.isArray(s.statements)) return fail("statements_invalid");
      const answers: Obj = {};
      const statements = s.statements.map((e) => {
        if (!exactKeys(e, ["id", "text", "answer"])) return e;
        const { id, text, answer } = e as Obj;
        if (typeof answer !== "boolean") err.add("key_value_invalid");
        if (typeof id === "string") answers[id] = answer;
        return { id, text };
      });
      payload = { statements };
      key = { answers };
      break;
    }
    case "fill_blank": {
      if (!Array.isArray(s.segments)) return fail("segments_invalid");
      const bank = s.input === "bank";
      const blanks: Obj = {};
      const segments = s.segments.map((g) => {
        if (!exactKeys(g, ["type", "text", "id", "accepted", "tokens"])) return g;
        const { type: kind, text, id, accepted, tokens } = g as Obj;
        const empty = (v: unknown) => Array.isArray(v) && v.length === 0;
        if (kind === "text") {
          if (id !== "" || !empty(accepted) || !empty(tokens)) err.add("segments_invalid");
          return { type: "text", text };
        }
        if (kind !== "blank" || text !== "") {
          err.add("segments_invalid");
          return { type: "blank", id };
        }
        if (typeof id === "string") {
          if (id in blanks) err.add("duplicate_id");
          if (bank ? !empty(accepted) : !empty(tokens)) err.add("key_value_invalid");
          blanks[id] = bank ? { tokens } : { accepted };
        }
        return { type: "blank", id };
      });
      payload = { segments, input: s.input };
      if (bank) {
        payload.bank = entries(s.bank);
        payload.bank_reuse = s.bank_reuse;
        if (s.case_insensitive !== false) err.add("key_invalid");
      } else if (!(Array.isArray(s.bank) && s.bank.length === 0) || s.bank_reuse !== false) err.add("bank_not_allowed");
      key = { blanks, ...(!bank && s.case_insensitive === true ? { case_insensitive: true } : {}) };
      if (!bank && typeof s.case_insensitive !== "boolean") err.add("key_invalid");
      break;
    }
    case "matching": {
      payload = { left: entries(s.left), right: entries(s.right), policy: s.policy };
      const pairs = toMap(s.pairs, "left", "right", err);
      if (!pairs) return fail("key_invalid");
      key = { pairs };
      break;
    }
    case "numeric": {
      payload = { units: entries(s.units), unit_required: s.unit_required, work_area: s.work_area };
      key = {
        value: s.value,
        abs_tolerance: s.abs_tolerance,
        rel_tolerance: s.rel_tolerance,
        unit_weight: s.unit_weight,
        process_required: s.process_required,
      };
      if (s.unit_required === true) {
        key.unit = s.unit;
        const factors = toMap(s.unit_factors, "unit", "factor", err);
        if (!factors) return fail("unit_factors_invalid");
        if (Object.keys(factors).length) key.unit_factors = factors;
      } else if (
        s.unit !== "" || !Array.isArray(s.unit_factors) || s.unit_factors.length > 0 ||
        !Array.isArray(s.units) || s.units.length > 0 || (typeof s.unit_weight === "number" && s.unit_weight > 0)
      ) err.add("unit_not_required");
      break;
    }
    case "ordering": {
      payload = { items: entries(s.items), mode: s.mode };
      key = { orders: s.orders };
      break;
    }
    case "classification": {
      if (!Array.isArray(s.items) || !Array.isArray(s.categories)) return fail("items_invalid");
      const membership: Obj = {};
      const items = s.items.map((e) => {
        if (!exactKeys(e, ["id", "text", "category"])) return e;
        const { id, text, category } = e as Obj;
        if (typeof id === "string") {
          if (id in membership) err.add("duplicate_id");
          membership[id] = category;
        }
        return { id, text };
      });
      const categories = s.categories.map((c) => {
        if (!exactKeys(c, ["id", "text", "capacity"])) return c;
        const { id, text, capacity } = c as Obj;
        if (capacity === 0) return { id, text };
        return { id, text, capacity };
      });
      payload = { items, categories };
      key = { membership };
      break;
    }
  }
  const content = questionContentErrors(type, payload, key, 1);
  for (const e of content) err.add(e);
  // AI kuralları yalnız sözleşmeye uyan yapıda çalışır (şekil bozuksa core kodu yeterli ve kesin).
  if (!err.size) {
    try {
      for (const e of semanticErrors(type, q as Obj, payload, key)) err.add(e);
    } catch {
      err.add("content_invalid");
    }
  }
  if (err.size) return { ok: false, errors: [...err].sort() };
  return { ok: true, value: { interaction_type: type, schema_version: 1, payload, answer_key: key } };
}

// ---------------------------------------------------------------------------------------------------------------
// 4) AI'ya özgü deterministik red-team kuralları (SQL sözleşmesinden SIKI; yalnız AI üretimine uygulanır).
// Kodlar: duplicate_text (çocuk aynı görünen iki öğeyi ayırt edemez), order_ambiguous (aynı görünen öğelerin yer
// değiştirdiği sıra kabul listesinde yok), image_reference_unavailable (görsel yok), payload_answer_leak,
// unit_factors_invalid (bilinen birim oranı yanlış ya da eksik / farklı boyut).
const norm = (s: unknown) => (typeof s === "string" ? s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr-TR") : "");
const texts = (arr: unknown) => (Array.isArray(arr) ? arr.map((e) => (isObj(e) ? e.text : undefined)) : []);
const hasDuplicate = (arr: unknown) => {
  const t = texts(arr).map(norm).filter(Boolean);
  return new Set(t).size !== t.length;
};
/** Var olmayan görsele atıf (yapılandırılmış AI sorusunda görsel yoktur). "bu şekilde" (= böyle) yakalanmaz. */
const IMAGE_REFERENCE =
  /(?<![\p{L}])(resim\p{L}*|resm\p{L}*|görsel\p{L}*|fotoğraf\p{L}*|çizim\p{L}*|şekle\s+göre|şekildeki|şekilde\s+(?:görülen|verilen|gösterilen)|picture\p{L}*|image\p{L}*|photo\p{L}*|figure\p{L}*|diagram\p{L}*)/iu;
/** Çocuğa görünen metinde cevabın açık işareti. */
const ANSWER_LEAK =
  /(doğru\s+cevap|cevap\s+anahtar|cevap\s*[:=]|yanıt\s*[:=]|answer\s*[:=]|\(\s*(?:doğru|yanlış|d|y|true|false|t|f)\s*\)|[-–—:]\s*(?:doğru|yanlış)\s*[.!]?\s*$)/iu;

/** Uzunluk/kütle/sıvı/zaman: metin → [boyut, temel birim katsayısı]. Bilinmeyen birim denetlenmez. */
const KNOWN_UNITS: Record<string, [string, number]> = {
  mm: ["L", 0.001], milimetre: ["L", 0.001], cm: ["L", 0.01], santimetre: ["L", 0.01], dm: ["L", 0.1], desimetre: ["L", 0.1],
  m: ["L", 1], metre: ["L", 1], km: ["L", 1000], kilometre: ["L", 1000],
  mg: ["M", 0.001], miligram: ["M", 0.001], g: ["M", 1], gr: ["M", 1], gram: ["M", 1], kg: ["M", 1000], kilogram: ["M", 1000],
  ton: ["M", 1_000_000],
  ml: ["V", 0.001], mililitre: ["V", 0.001], l: ["V", 1], lt: ["V", 1], litre: ["V", 1],
  sn: ["T", 1], saniye: ["T", 1], dk: ["T", 60], dakika: ["T", 60], sa: ["T", 3600], saat: ["T", 3600], gün: ["T", 86400],
  hafta: ["T", 604800],
};
function unitErrors(payload: Obj, key: Obj): string[] {
  if (payload.unit_required !== true || !Array.isArray(payload.units)) return [];
  const units = payload.units as { id: string; text: string }[];
  const known = (u: { text: string }) => KNOWN_UNITS[norm(u.text)];
  const target = units.find((u) => u.id === key.unit);
  if (!target) return [];
  const factors = (key.unit_factors ?? {}) as Record<string, number>;
  // Birden çok birim seçeneği varsa her birinin oranı yazılmalı; yoksa doğru dönüşümlü cevap yanlış sayılır.
  if (units.length > 1 && units.some((u) => typeof factors[u.id] !== "number")) return ["unit_factors_invalid"];
  const base = known(target);
  for (const u of units) {
    const k = known(u);
    if (!k || !base) continue;
    if (k[0] !== base[0]) return ["unit_factors_invalid"];
    const expected = k[1] / base[1];
    const f = factors[u.id];
    if (typeof f === "number" && Math.abs(f - expected) > 1e-9 * Math.max(1, expected)) return ["unit_factors_invalid"];
  }
  return [];
}
function orderClosure(payload: Obj, key: Obj): boolean {
  const items = (payload.items ?? []) as { id: string; text: string }[];
  const orders = (key.orders ?? []) as string[][];
  const groups = new Map<string, string[]>();
  for (const i of items) groups.set(norm(i.text), [...(groups.get(norm(i.text)) ?? []), i.id]);
  const same = [...groups.values()].filter((g) => g.length > 1);
  if (!same.length) return true;
  const accepted = new Set(orders.map((o) => JSON.stringify(o)));
  for (const o of orders) {
    for (const g of same) {
      for (let a = 0; a < g.length; a++) {
        for (let b = a + 1; b < g.length; b++) {
          const swapped = o.map((x) => (x === g[a] ? g[b] : x === g[b] ? g[a] : x));
          if (!accepted.has(JSON.stringify(swapped))) return false;
        }
      }
    }
  }
  return true;
}
export function semanticErrors(type: StructuredInteractionType, q: Obj, payload: Obj, key: Obj): string[] {
  const err = new Set<string>();
  const visible: string[] = [typeof q.stem === "string" ? q.stem : ""];
  const collect = (arr: unknown) => texts(arr).forEach((t) => typeof t === "string" && visible.push(t));
  switch (type) {
    case "true_false":
      collect(payload.statements);
      if (hasDuplicate(payload.statements)) err.add("duplicate_text");
      for (const t of texts(payload.statements)) if (typeof t === "string" && ANSWER_LEAK.test(t)) err.add("payload_answer_leak");
      break;
    case "fill_blank": {
      collect(payload.segments);
      collect(payload.bank);
      if (hasDuplicate(payload.bank)) err.add("duplicate_text");
      // Klavye cevabı çocuğa gösterilen yönergede yazıyorsa cevap sızar.
      const stem = norm(q.stem);
      for (const b of Object.values((key.blanks ?? {}) as Record<string, { accepted?: unknown[] }>)) {
        for (const a of b?.accepted ?? []) {
          const n = norm(a);
          if (n.length >= 2 && new RegExp(`(?<![\\p{L}\\p{N}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u").test(stem)) {
            err.add("payload_answer_leak");
          }
        }
      }
      break;
    }
    case "matching":
      collect(payload.left);
      collect(payload.right);
      if (hasDuplicate(payload.left) || hasDuplicate(payload.right)) err.add("duplicate_text");
      break;
    case "numeric":
      collect(payload.units);
      if (hasDuplicate(payload.units)) err.add("duplicate_text");
      for (const e of unitErrors(payload, key)) err.add(e);
      break;
    case "ordering":
      collect(payload.items);
      if (!orderClosure(payload, key)) err.add("order_ambiguous");
      break;
    case "classification":
      collect(payload.items);
      collect(payload.categories);
      if (hasDuplicate(payload.items) || hasDuplicate(payload.categories)) err.add("duplicate_text");
      break;
  }
  if (visible.some((t) => IMAGE_REFERENCE.test(t))) err.add("image_reference_unavailable");
  if (type !== "true_false" && visible.some((t) => /(doğru\s+cevap|cevap\s+anahtar|cevap\s*[:=]|yanıt\s*[:=]|answer\s*[:=])/iu.test(t))) {
    err.add("payload_answer_leak");
  }
  return [...err];
}

/** Çocuğa görünen yapılandırılmış metinler (kişi adı taraması için), alan adıyla. */
export function visibleStructuredTexts(payload: Obj): { field: string; text: string }[] {
  const out: { field: string; text: string }[] = [];
  for (const [field, value] of Object.entries(payload)) {
    if (!Array.isArray(value)) continue;
    for (const e of value) {
      if (isObj(e) && typeof e.text === "string" && e.text) out.push({ field: `${field}_${typeof e.id === "string" ? e.id : "text"}`, text: e.text });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// 5) Üretim istemi eki (TR). Yalnız yapılandırılmış tür istendiğinde sistem istemine eklenir.
export const STRUCTURED_PROMPT = `
Etkileşimli (yapılandırılmış) soru türleri:
- Yalnız isteğin etkilesim_turleri listesindeki türleri üret; listede olmayan türü üretme, bir türü başka türe çevirme. Türleri listede dengeli dağıt.
- Her yapılandırılmış soruda interaction_type türün adı, schema_version 1 ve structure o türün alanlarıyla doldurulur. Kimlik (id): küçük harfle başlar, küçük harf/rakam/alt çizgi, en çok 24 karakter (ör. s1, b1, w1, l1, r1, a, c1); soru içinde benzersiz.
- Çocuğun gördüğü metinler (stem ve structure içindeki text alanları) doğru cevabı ele vermez: "(Doğru)", "cevap:", ipucu parantezi yazma. Doğru cevap yalnız answer, accepted, tokens, pairs, orders, category, value alanlarına yazılır.
- Öncelikli hedef 1–4. sınıf (7–9 yaş): kısa, somut, günlük hayattan, sınıf düzeyinde kelimeler. Çift olumsuz ("... değildir değil") ve hileli ifade kullanma.
- Görsel yok: "resimdeki", "şekildeki", "görseldeki" gibi var olmayan bir görsele dayanan öğe yazma.
- true_false (Doğru/Yanlış): 3–5 ifade. Her ifade tek bir yargıdır (iki bilgiyi "ve/ama" ile bağlama), kesin doğru ya da kesin yanlıştır; "bazen, genellikle, çoğu" gibi belirsiz sözcük kullanma. answer true/false. stem kısa yönerge olsun (ör. "Aşağıdaki ifadeler doğru mu, yanlış mı?").
- fill_blank (Boşluk doldurma): segments metin ve boşluk parçalarıdır; boşluk parçasında text boş metin, metin parçasında id boş metin. 1–3 boşlukta input "bank" (kelime havuzu, en az 2 kelime, 1–2 çeldirici olabilir; tokens doğru kelimenin id'si), 4 ve üstü boşlukta "keyboard" (accepted kabul edilen bütün yazılışlar). Havuza aynı yazılışta iki kelime koyma. Bir boşluğa birden fazla kelime gerçekten uyuyorsa hepsini kabul et ya da cümleyi tek cevaplı olacak biçimde değiştir. Klavyede cevabı stem içinde yazma.
- matching (Eşleştirme): sol 2–6 öğe; one_to_one ise sağ en az sol kadar (en çok bir çeldirici). pairs her sol öğe için tam bir kayıt; one_to_one'da her sağ öğe en çok bir kez. Bir sol öğe birden çok sağ öğeyle doğru eşleşebiliyorsa soruyu değiştir.
- numeric (Sayısal cevap): value sayı metni ("150", "1,5", "3/4"). Birim gerekiyorsa unit_required true; units birim seçenekleri; unit doğru cevabın birimi; unit_factors her birimin unit'e oranı (unit 1, ör. cm 1, m 100). Birim gerekmiyorsa units ve unit_factors boş, unit boş metin, unit_weight 0. Tolerans genelde 0. İşlem/süreç ölçülecekse process_required true.
- ordering (Sıralama / cümle kurma): 3–6 öğe; mode "sequence" (olay, işlem, yaşam döngüsü sırası) ya da "sentence" (kelimelerden cümle). orders kabul edilen BÜTÜN tam sıraları içerir (en çok 5). Türkçede kelime sırası esnektir: dil bilgisine uygun birden çok cümle kurulabiliyorsa hepsini listele; 5'ten fazla olabiliyorsa bu soruyu üretme. Aynı kelime iki kez geçiyorsa iki ayrı id ver ve yer değiştirmiş sıraları da listele.
- classification (Sınıflandırma): 2–3 kategori, 4–8 öğe. Kategoriler birbirini dışlar; bir öğe iki kategoriye birden uyuyorsa o öğeyi kullanma. Her öğenin category alanı tek kategorinin id'si; sınır yoksa capacity 0.
- Yapılandırılmış soruda choices, correct_key, expected_answer ve rubric yoktur; solution kısa çözüm açıklamasıdır (yalnız veli görür).`;
