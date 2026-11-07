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
  // Faz 2A (QT30–QT33) ve Faz 2B (QT41) — sunucuda enabled=false gelir; istek, kapalı türü sağlayıcıdan önce reddeder.
  "mark_text",
  "error_fix",
  "multi_choice",
  "two_stage",
  "region_select",
  "clock",
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
  "mark_text",
  "error_fix",
  "multi_choice",
  "two_stage",
  "region_select",
  "clock",
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
  mark_text: obj({
    unit: { type: "string", enum: ["word", "sentence"] },
    segments: arr(
      obj({ id: str("Id of a selectable segment; empty string for a non-selectable piece (spaces, punctuation)."), text: str() }),
      "The whole text in order, 2-300 segments. word: one word per selectable segment; sentence: one sentence.",
    ),
    targets: arr(str(), "Ids of the segments to mark (at least 1, fewer than all selectable)."),
    max_select: { type: "integer", description: "0 = no limit shown; otherwise at least the number of targets." },
  }),
  error_fix: obj({
    unit: { type: "string", enum: ["word", "sentence"] },
    segments: arr(obj({ id: str("Selectable segment id; empty string for spaces/punctuation."), text: str("As the child sees it (wrong spelling stays wrong).") }), "2-300 segments."),
    errors: arr(obj({ id: str("Id of a segment that really is wrong."), accepted: arr(str(), "Every accepted correction (1-8), different from the shown text.") }), "At least 1, fewer than all selectable segments."),
    find_weight: { type: "number", description: "0 = default; otherwise 0.1-0.9 share of the finding step." },
    fix_policy: { type: "string", enum: ["review_unmatched", "closed"] },
    case_insensitive: { type: "boolean" },
  }),
  multi_choice: obj({
    options: arr(entry, "3-8 options."),
    correct: arr(str(), "Ids of all correct options: at least 1 and at least one option must be wrong."),
    select_count: { type: "integer", description: "0 = do not tell the child how many; otherwise equals the number of correct options." },
  }),
  two_stage: obj({
    stage1: obj({ prompt: str(), options: arr(entry, "2-6 options.") }),
    stage2: obj({
      prompt: str("Asks for the reason; must not reveal the stage 1 answer."),
      mode: { type: "string", enum: ["choice", "text"] },
      options: arr(entry, "choice: 2-6 options with ids distinct from stage 1; text: empty."),
    }),
    stage1_answer: str("Id of the correct stage 1 option."),
    stage2_answer: str("choice: id of the correct stage 2 option; text: empty string."),
  }),
  region_select: obj({
    figure: obj({
      kind: { type: "string", enum: ["grid", "sectors"], description: "grid = rows x cols squares; sectors = equal slices of a circle. No images." },
      rows: { type: "integer", description: "grid: 1-8; sectors: 0." },
      cols: { type: "integer", description: "grid: 1-8; sectors: 0." },
    }),
    regions: arr(obj({ id: str(ID_RULE), text: str("Accessible label, e.g. '1. satır 2. sütun' or '3. dilim'.") }), "grid: exactly rows*cols; sectors: 2-12."),
    key_mode: { type: "string", enum: ["count", "targets"], description: "count = any N regions (fraction shading); targets = these exact regions." },
    count: { type: "integer", description: "count mode: 1 .. regions-1; targets mode: 0." },
    targets: arr(str(), "targets mode: region ids; count mode: empty."),
    max_select: { type: "integer", description: "0 = no limit." },
  }),
  clock: obj({
    mode: { type: "string", enum: ["read", "set"], description: "read = clock shows a time, child writes it; set = child sets the time named in the stem." },
    display: { type: "string", enum: ["analog", "digital"] },
    step_minutes: { type: "integer", enum: [1, 5, 15, 30, 60] },
    shown_time: str('read: the time on the clock "HH:MM" (equals time); set: empty string.'),
    time: str('Correct time "HH:MM" (24h), on the step.'),
    accept_12h: { type: "boolean", description: "true = 03:15 and 15:15 both accepted." },
  }),
};
/** İsteğe bağlı uyaran (tablo / sütun grafiği). Görsel yok; `alt` zorunlu ve cevabı söylemez. */
export const STIMULUS_JSON_SCHEMA = obj({
  kind: { type: "string", enum: ["none", "table", "bar_chart"] },
  caption: str(),
  alt: str("Text alternative describing the data (5-1000 chars); never states the answer. Empty when kind is none."),
  columns: arr(str(), "table: 1-6 headers; otherwise empty."),
  rows: arr(arr(str()), "table: 1-12 rows, one cell per column; otherwise empty."),
  bars: arr(obj({ label: str(), value: { type: "number" } }), "bar_chart: 2-10 bars (0-100000); otherwise empty."),
  x_label: str(),
  y_label: str(),
  unit: str(),
});
/** Yapılandırılmış soru nesnesinin üst düzey alanları (stem, çözüm, senaryo izi). Rubrik/şık yoktur. */
function structuredQuestionSchema(type: StructuredInteractionType, difficulties: readonly string[], cognitive: readonly string[]) {
  return obj({
    interaction_type: { type: "string", enum: [type] },
    schema_version: { type: "integer", description: "Always 1." },
    topic: str(),
    difficulty: { type: "string", enum: [...difficulties] },
    stem: str("Instruction/question shown to the child; never contains the answer."),
    structure: STRUCTURE_JSON_SCHEMAS[type],
    stimulus: STIMULUS_JSON_SCHEMA,
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
  "stimulus",
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

const STIMULUS_KEYS = Object.keys((STIMULUS_JSON_SCHEMA as { properties: Obj }).properties);
const emptyList = (v: unknown) => Array.isArray(v) && v.length === 0;
/** Model biçimindeki uyaranı sözleşme biçimine çevirir; `none` → yok. Kullanılmayan alanlar boş olmalı. */
function convertStimulus(st: unknown, err: Set<string>): Obj | null {
  if (!exactKeys(st, STIMULUS_KEYS)) {
    err.add("stimulus_invalid");
    return null;
  }
  const x = st as Obj;
  const opt = (k: string) => (typeof x[k] === "string" && (x[k] as string) !== "" ? { [k]: x[k] } : {});
  if (x.kind === "none") {
    if (x.caption !== "" || x.alt !== "" || !emptyList(x.columns) || !emptyList(x.rows) || !emptyList(x.bars) || x.x_label !== "" || x.y_label !== "" || x.unit !== "") {
      err.add("stimulus_invalid");
    }
    return null;
  }
  if (x.kind === "table") {
    if (!emptyList(x.bars) || x.x_label !== "" || x.y_label !== "" || x.unit !== "") err.add("stimulus_invalid");
    return { kind: "table", ...opt("caption"), alt: x.alt, columns: x.columns, rows: x.rows };
  }
  if (x.kind === "bar_chart") {
    if (!emptyList(x.columns) || !emptyList(x.rows)) err.add("stimulus_invalid");
    return { kind: "bar_chart", ...opt("caption"), alt: x.alt, ...opt("x_label"), ...opt("y_label"), ...opt("unit"), bars: x.bars };
  }
  err.add("stimulus_invalid");
  return null;
}

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
    case "mark_text":
    case "error_fix": {
      if (!Array.isArray(s.segments)) return fail("segments_invalid");
      const segments = s.segments.map((g) => {
        if (!exactKeys(g, ["id", "text"])) return g;
        const { id, text } = g as Obj;
        return id === "" ? { text } : { id, text };
      });
      payload = { unit: s.unit, segments };
      if (type === "mark_text") {
        if (s.max_select !== 0) payload.max_select = s.max_select;
        key = { targets: s.targets };
      } else {
        const errors = Array.isArray(s.errors) ? toMap(s.errors, "id", "accepted", err) : null;
        if (!errors) return fail("key_invalid");
        key = {
          errors: Object.fromEntries(Object.entries(errors).map(([id, accepted]) => [id, { accepted }])),
          ...(s.find_weight !== 0 ? { find_weight: s.find_weight } : {}),
          fix_policy: s.fix_policy,
          case_insensitive: s.case_insensitive,
        };
      }
      break;
    }
    case "multi_choice": {
      payload = { options: entries(s.options), ...(s.select_count !== 0 ? { select_count: s.select_count } : {}) };
      key = { correct: s.correct };
      break;
    }
    case "two_stage": {
      const s1 = s.stage1 as Obj, s2 = s.stage2 as Obj;
      if (!exactKeys(s1, ["prompt", "options"]) || !exactKeys(s2, ["prompt", "mode", "options"])) return fail("stage_invalid");
      const choice = s2.mode === "choice";
      if (!choice && !(Array.isArray(s2.options) && s2.options.length === 0)) err.add("stage_invalid");
      payload = {
        stage1: { prompt: s1.prompt, options: entries(s1.options) },
        stage2: { prompt: s2.prompt, mode: s2.mode, ...(choice ? { options: entries(s2.options) } : {}) },
      };
      if (!choice && s.stage2_answer !== "") err.add("key_value_invalid");
      key = { stage1: s.stage1_answer, ...(choice ? { stage2: s.stage2_answer } : {}) };
      break;
    }
    case "region_select": {
      const f = s.figure as Obj;
      if (!exactKeys(f, ["kind", "rows", "cols"])) return fail("figure_invalid");
      // AI'ın görseli yok: yalnız çizilebilen ızgara/dilim; görsel üzerinde bölge asla (figure.kind image yok).
      if (f.kind !== "grid" && f.kind !== "sectors") return fail("figure_invalid");
      if (f.kind === "sectors" && (f.rows !== 0 || f.cols !== 0)) err.add("figure_invalid");
      payload = {
        figure: f.kind === "grid" ? { kind: "grid", rows: f.rows, cols: f.cols } : { kind: "sectors" },
        regions: entries(s.regions),
        ...(s.max_select !== 0 ? { max_select: s.max_select } : {}),
      };
      if (s.key_mode === "count") {
        if (!(Array.isArray(s.targets) && s.targets.length === 0)) err.add("key_invalid");
        key = { count: s.count };
      } else if (s.key_mode === "targets") {
        if (s.count !== 0) err.add("key_invalid");
        key = { targets: s.targets };
      } else return fail("key_invalid");
      break;
    }
    case "clock": {
      const read = s.mode === "read";
      if (!read && s.shown_time !== "") err.add("clock_invalid");
      payload = { mode: s.mode, display: s.display, step_minutes: s.step_minutes, ...(read ? { shown_time: s.shown_time } : {}) };
      key = { time: s.time, accept_12h: s.accept_12h };
      break;
    }
  }
  const stimulus = convertStimulus(q.stimulus, err);
  if (stimulus) payload.stimulus = stimulus;
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
const IMAGE_REFERENCE_NO_FIGURE =
  /(?<![\p{L}])(resim\p{L}*|resm\p{L}*|görsel\p{L}*|fotoğraf\p{L}*|çizim\p{L}*|picture\p{L}*|image\p{L}*|photo\p{L}*)/iu;
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
const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Normalleştirilmiş `needle`, `hay` içinde tam sözcük/sayı olarak geçiyor mu (TR küçük harf, NFC). */
function mentions(hay: unknown, needle: unknown) {
  const n = norm(needle);
  return n.length >= 2 && new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(n)}(?![\\p{L}\\p{N}])`, "u").test(norm(hay));
}
const byId = (arr: unknown, id: unknown) => texts(Array.isArray(arr) ? arr.filter((e) => isObj(e) && e.id === id) : [])[0];
const selectable = (segments: unknown) => (Array.isArray(segments) ? segments.filter((g) => isObj(g) && typeof g.id === "string") as { id: string; text: string }[] : []);
/** Aynı görünen iki seçilebilir öğenin anahtardaki durumu farklıysa çocuk ayırt edemez. */
function inconsistentTwins(items: { id: string; text: string }[], marked: Set<string>) {
  const seen = new Map<string, boolean>();
  for (const i of items) {
    const t = norm(i.text), m = marked.has(i.id);
    if (seen.has(t) && seen.get(t) !== m) return true;
    seen.set(t, m);
  }
  return false;
}
/** "3/4", "dörtte üç", "4 eş parçadan 3" → [pay, payda]. */
const TR_NUM: Record<string, number> = { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10, "on bir": 11, "on iki": 12 };
const TR_DEN: Record<string, number> = { ikide: 2, üçte: 3, dörtte: 4, beşte: 5, altıda: 6, yedide: 7, sekizde: 8, dokuzda: 9, onda: 10, "on birde": 11, "on ikide": 12 };
function fractionIn(text: unknown): [number, number] | null {
  const t = norm(text);
  let m = t.match(/(?<![\p{N}/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\p{N}/])/u);
  if (m) return [Number(m[1]), Number(m[2])];
  m = t.match(/(\d{1,2})\s+(?:eş\s+)?(?:parçadan|parçanın|kareden|karenin|dilimden|dilimin)\s+(\d{1,2})/u);
  if (m) return [Number(m[2]), Number(m[1])];
  const dens = Object.keys(TR_DEN).sort((x, y) => y.length - x.length).join("|");
  const nums = Object.keys(TR_NUM).sort((x, y) => y.length - x.length).join("|");
  // Pay ek alır ("dörtte birini", "altıda üçünü").
  m = t.match(new RegExp(`(?<![\\p{L}])(${dens})\\s+(${nums})\\p{L}*`, "u"));
  if (m) return [TR_NUM[m[2]!]!, TR_DEN[m[1]!]!];
  if (/(?<![\p{L}])yarısın\p{L}*/u.test(t)) return [1, 2];
  return null;
}
const TIME_FORMS = (hhmm: string) => {
  const [h, mm] = hhmm.split(":");
  const hours = [h!, String(Number(h))];
  if (Number(h) > 12) hours.push(String(Number(h) - 12), String(Number(h) - 12).padStart(2, "0"));
  return hours.flatMap((x) => [`${x}:${mm}`, `${x}.${mm}`]);
};
/** Uyaranın veri metinleri (hücre, sütun, çubuk adı/değeri): alt bunları yineleyebilir; yeni cevap bilgisi veremez. */
function stimulusData(st: Obj | undefined) {
  if (!st) return "";
  const cells = [...((st.columns as unknown[]) ?? []), ...(((st.rows as unknown[][]) ?? []).flat()), ...(((st.bars as Obj[]) ?? []).flatMap((b) => [b.label, b.value]))];
  return cells.map((c) => String(c)).join(" | ");
}
/** Cevabın çocuğa görünen metin karşılıkları (uyaran açıklaması/yönerge sızıntısı denetimi için). */
function answerTexts(type: StructuredInteractionType, p: Obj, k: Obj): string[] {
  const out: unknown[] = [];
  if (type === "fill_blank") {
    for (const b of Object.values((k.blanks ?? {}) as Record<string, { accepted?: unknown[]; tokens?: unknown[] }>)) {
      out.push(...(b.accepted ?? []), ...(b.tokens ?? []).map((t) => byId(p.bank, t)));
    }
  } else if (type === "numeric") out.push(k.value);
  else if (type === "mark_text") out.push(...((k.targets as unknown[]) ?? []).map((t) => byId(p.segments, t)));
  else if (type === "error_fix") out.push(...Object.values((k.errors ?? {}) as Record<string, { accepted: unknown[] }>).flatMap((e) => e.accepted));
  else if (type === "multi_choice") out.push(...((k.correct as unknown[]) ?? []).map((t) => byId(p.options, t)));
  else if (type === "two_stage") out.push(byId((p.stage1 as Obj)?.options, k.stage1));
  else if (type === "clock" && typeof k.time === "string") out.push(...TIME_FORMS(k.time));
  return out.filter((x): x is string => typeof x === "string" && norm(x).length >= 2);
}

export function semanticErrors(type: StructuredInteractionType, q: Obj, payload: Obj, key: Obj): string[] {
  const err = new Set<string>();
  const visible: string[] = [typeof q.stem === "string" ? q.stem : ""];
  const collect = (arr: unknown) => texts(arr).forEach((t) => typeof t === "string" && visible.push(t));
  const stem = norm(q.stem);
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
      for (const b of Object.values((key.blanks ?? {}) as Record<string, { accepted?: unknown[] }>)) {
        for (const a of b?.accepted ?? []) if (mentions(stem, a)) err.add("payload_answer_leak");
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
    case "mark_text": {
      collect(payload.segments);
      const sel = selectable(payload.segments), targets = new Set((key.targets as string[]) ?? []);
      // Sözcük biriminde her seçilebilir parça tek sözcüktür (aksi hâlde seçim sınırı belirsiz).
      if (payload.unit === "word" && sel.some((g) => /\s/u.test(g.text.trim()))) err.add("segment_unit_mismatch");
      if (inconsistentTwins(sel, targets)) err.add("duplicate_text");
      // Yönerge işaretlenecek sözcükleri sayıyorsa cevap sızar ("fiilleri işaretle: koştu, uyudu").
      for (const t of targets) if (mentions(stem, byId(payload.segments, t))) err.add("payload_answer_leak");
      break;
    }
    case "error_fix": {
      collect(payload.segments);
      const sel = selectable(payload.segments), errors = (key.errors ?? {}) as Record<string, { accepted: string[] }>;
      if (payload.unit === "word" && sel.some((g) => /\s/u.test(g.text.trim()))) err.add("segment_unit_mismatch");
      // "Hata" aslında doğru: kabul edilen düzeltme gösterilen metnin aynısı.
      for (const [id, e] of Object.entries(errors)) {
        const shown = norm(byId(payload.segments, id));
        if (e.accepted.some((a) => norm(a) === shown)) err.add("error_not_wrong");
        for (const a of e.accepted) if (mentions(stem, a)) err.add("payload_answer_leak");
      }
      if (inconsistentTwins(sel, new Set(Object.keys(errors)))) err.add("duplicate_text");
      break;
    }
    case "multi_choice":
      collect(payload.options);
      if (hasDuplicate(payload.options)) err.add("duplicate_text");
      break;
    case "two_stage": {
      const s1 = payload.stage1 as Obj, s2 = payload.stage2 as Obj;
      visible.push(String(s1.prompt), String(s2.prompt));
      collect(s1.options);
      collect(s2.options);
      if (hasDuplicate(s1.options) || hasDuplicate(s2.options)) err.add("duplicate_text");
      // 2. aşama 1. aşamanın doğru seçeneğini anarsa cevabı ele verir.
      const right = byId(s1.options, key.stage1);
      if ([s2.prompt, ...texts(s2.options)].some((t) => mentions(t, right))) err.add("stage_reveals_answer");
      if (mentions(s1.prompt, right)) err.add("payload_answer_leak");
      break;
    }
    case "region_select": {
      collect(payload.regions);
      if (hasDuplicate(payload.regions)) err.add("duplicate_text");
      // Yönergedeki kesir bölge sayısıyla tutarlı olmalı: a/b, n bölge → n, b'nin katı ve seçilecek = a·n/b.
      const frac = fractionIn(q.stem);
      const n = Array.isArray(payload.regions) ? payload.regions.length : 0;
      const want = typeof key.count === "number" ? key.count : Array.isArray(key.targets) ? key.targets.length : null;
      if (frac) {
        const [a, b] = frac;
        if (a < 1 || b < 2 || a >= b || n % b !== 0 || want !== (a * n) / b) err.add("fraction_mismatch");
      }
      break;
    }
    case "clock": {
      // Okuma: yönerge gösterilen saati yazarsa cevap sızar. Dijital saati okuyup aynısını yazmak ölçme değildir.
      if (payload.mode === "read") {
        if (typeof key.time === "string" && TIME_FORMS(key.time).some((f) => stem.includes(f))) err.add("payload_answer_leak");
        if (payload.display === "digital") err.add("clock_trivial");
      }
      break;
    }
  }
  const st = isObj(payload.stimulus) ? payload.stimulus : undefined;
  if (st) {
    for (const k of ["alt", "caption"]) if (typeof st[k] === "string") visible.push(st[k] as string);
    // Uyaran açıklaması cevabı söyleyemez; verideki değerleri (hücre/çubuk) aktarabilir.
    const data = stimulusData(st);
    for (const a of answerTexts(type, payload, key)) {
      if ((mentions(st.alt, a) || mentions(st.caption, a)) && !mentions(data, a)) err.add("stimulus_reveals_answer");
    }
  }
  // Bölge seçmede şekil ızgara/dilim olarak çizilir: "şekildeki" atfı geçerli; resim/fotoğraf/görsel yine yok.
  const imageRe = type === "region_select" ? IMAGE_REFERENCE_NO_FIGURE : IMAGE_REFERENCE;
  if (visible.some((t) => imageRe.test(t))) err.add("image_reference_unavailable");
  if (type !== "true_false" && visible.some((t) => /(doğru\s+cevap|cevap\s+anahtar|cevap\s*[:=]|yanıt\s*[:=]|answer\s*[:=])/iu.test(t))) {
    err.add("payload_answer_leak");
  }
  return [...err];
}

/** Çocuğa görünen yapılandırılmış metinler (kişi adı taraması için), alan adıyla. İç içe aşama/uyaran dahil. */
export function visibleStructuredTexts(payload: Obj, prefix = ""): { field: string; text: string }[] {
  const out: { field: string; text: string }[] = [];
  for (const [field, value] of Object.entries(payload)) {
    const name = prefix + field;
    if (typeof value === "string" && ["prompt", "alt", "caption", "x_label", "y_label"].includes(field) && value) out.push({ field: name, text: value });
    else if (Array.isArray(value)) {
      value.forEach((e, i) => {
        if (isObj(e) && typeof e.text === "string" && e.text) out.push({ field: `${name}_${typeof e.id === "string" ? e.id : "text"}`, text: e.text });
        else if (isObj(e) && typeof e.label === "string") out.push({ field: `${name}_${i}`, text: e.label });
        else if (typeof e === "string" && e) out.push({ field: `${name}_${i}`, text: e });
        else if (Array.isArray(e)) e.forEach((c, j) => typeof c === "string" && c && out.push({ field: `${name}_${i}_${j}`, text: c }));
      });
    } else if (isObj(value)) out.push(...visibleStructuredTexts(value, name + "_"));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// 5) Üretim istemi eki (TR). Yalnız yapılandırılmış tür istendiğinde sistem istemine eklenir.
export const STRUCTURED_PROMPT = `
Etkileşimli (yapılandırılmış) soru türleri:
- Yalnız isteğin etkilesim_turleri listesindeki türleri üret; listede olmayan türü üretme, bir türü başka türe çevirme. Türleri listede dengeli dağıt.
- Her yapılandırılmış soruda interaction_type türün adı, schema_version 1 ve structure o türün alanlarıyla doldurulur. Kimlik (id): küçük harfle başlar, küçük harf/rakam/alt çizgi, en çok 24 karakter (ör. s1, b1, w1, l1, r1, a, c1); soru içinde benzersiz.
- Çocuğun gördüğü metinler (stem, structure içindeki text/prompt alanları ve stimulus) doğru cevabı ele vermez: "(Doğru)", "cevap:", ipucu parantezi yazma. Doğru cevap yalnız answer, accepted, tokens, pairs, orders, category, value, targets, errors, correct, stage1_answer, stage2_answer, count, time alanlarına yazılır.
- Öncelikli hedef 1–4. sınıf (7–9 yaş): kısa, somut, günlük hayattan, sınıf düzeyinde kelimeler. Çift olumsuz ("... değildir değil") ve hileli ifade kullanma.
- Görsel yok: "resimdeki", "şekildeki", "görseldeki" gibi var olmayan bir görsele dayanan öğe yazma (yalnız region_select'in çizilen ızgara/dilim şekli ve stimulus tablosu/grafiği vardır).
- true_false (Doğru/Yanlış): 3–5 ifade. Her ifade tek bir yargıdır (iki bilgiyi "ve/ama" ile bağlama), kesin doğru ya da kesin yanlıştır; "bazen, genellikle, çoğu" gibi belirsiz sözcük kullanma. answer true/false. stem kısa yönerge olsun (ör. "Aşağıdaki ifadeler doğru mu, yanlış mı?").
- fill_blank (Boşluk doldurma): segments metin ve boşluk parçalarıdır; boşluk parçasında text boş metin, metin parçasında id boş metin. 1–3 boşlukta input "bank" (kelime havuzu, en az 2 kelime, 1–2 çeldirici olabilir; tokens doğru kelimenin id'si), 4 ve üstü boşlukta "keyboard" (accepted kabul edilen bütün yazılışlar). Havuza aynı yazılışta iki kelime koyma. Bir boşluğa birden fazla kelime gerçekten uyuyorsa hepsini kabul et ya da cümleyi tek cevaplı olacak biçimde değiştir. Klavyede cevabı stem içinde yazma.
- matching (Eşleştirme): sol 2–6 öğe; one_to_one ise sağ en az sol kadar (en çok bir çeldirici). pairs her sol öğe için tam bir kayıt; one_to_one'da her sağ öğe en çok bir kez. Bir sol öğe birden çok sağ öğeyle doğru eşleşebiliyorsa soruyu değiştir.
- numeric (Sayısal cevap): value sayı metni ("150", "1,5", "3/4"). Birim gerekiyorsa unit_required true; units birim seçenekleri; unit doğru cevabın birimi; unit_factors her birimin unit'e oranı (unit 1, ör. cm 1, m 100). Birim gerekmiyorsa units ve unit_factors boş, unit boş metin, unit_weight 0. Tolerans genelde 0. İşlem/süreç ölçülecekse process_required true.
- ordering (Sıralama / cümle kurma): 3–6 öğe; mode "sequence" (olay, işlem, yaşam döngüsü sırası) ya da "sentence" (kelimelerden cümle). orders kabul edilen BÜTÜN tam sıraları içerir (en çok 5). Türkçede kelime sırası esnektir: dil bilgisine uygun birden çok cümle kurulabiliyorsa hepsini listele; 5'ten fazla olabiliyorsa bu soruyu üretme. Aynı kelime iki kez geçiyorsa iki ayrı id ver ve yer değiştirmiş sıraları da listele.
- classification (Sınıflandırma): 2–3 kategori, 4–8 öğe. Kategoriler birbirini dışlar; bir öğe iki kategoriye birden uyuyorsa o öğeyi kullanma. Her öğenin category alanı tek kategorinin id'si; sınır yoksa capacity 0.
- mark_text (Metinde işaretleme): segments metnin tamamıdır, sırayla; seçilebilir her parçaya id ver, boşluk/noktalama parçalarında id boş metin. unit "word" ise her seçilebilir parça tek sözcük, "sentence" ise tek cümle. targets işaretlenecek parçaların id'leri: en az bir, seçilebilirlerin hepsi değil. Aynı yazılan iki parça ya ikisi de hedef ya ikisi de değil. Yönergede hedef sözcükleri yazma ("isimleri işaretle" de; isimleri sayma). max_select sınır yoksa 0.
- error_fix (Hata bulma ve düzeltme): metindeki hatalı parça çocuğa yanlış hâliyle gösterilir. errors gerçekten hatalı parçalar (en az bir, hepsi değil); accepted kabul edilen düzeltmeler ve gösterilen metinden farklıdır. Doğru yazılmış bir parçayı hata diye işaretleme. Düzeltmeyi yönergede yazma. find_weight genelde 0; fix_policy "review_unmatched" (beklenmeyen düzeltmeyi veli inceler).
- multi_choice (Birden çok doğru seçenek): 4–6 seçenek; correct en az bir, en az bir seçenek yanlış (hepsi doğru olamaz). Çocuğa kaç seçim yapacağını söylemek istersen select_count doğru sayısına eşit; yoksa 0.
- two_stage (İki aşamalı soru): stage1 cevap seçimi, stage2 gerekçe. stage2 metni ve seçenekleri 1. aşamanın doğru seçeneğini anmaz ya da ima etmez ("Yarasa neden memelidir?" yerine "Seçimini hangi bilgi destekler?"). stage2 mode "choice" ise seçenek id'leri 1. aşamadan farklı; "text" ise options boş ve stage2_answer boş metin.
- region_select (Bölge boyama/seçme): yalnız çizilebilen şekil: figure.kind "grid" (rows×cols kare; regions tam rows×cols) ya da "sectors" (eşit daire dilimleri, 2–12; rows ve cols 0). Görsel/resim üzerinde bölge asla yok. Kesir boyamada key_mode "count" ve count = boyanacak parça sayısı (bölge sayısından az); yönergedeki kesir bölge sayısıyla tutarlı olsun (ör. 8 kare, "4/8'ini" ya da "yarısını" → count 4). Belirli parçalar isteniyorsa key_mode "targets". Bölge etiketleri ("1. satır 2. sütun") benzersiz.
- clock (Saat): mode "read" (saat gösterilir, çocuk okur; display "analog", shown_time = time; yönergede saati yazma) ya da "set" (yönergede istenen saat yazılır, çocuk saati kurar; shown_time boş). step_minutes 1. sınıfta 60/30, 2. sınıfta 15, 3–4. sınıfta 5; time bu adıma uyar. accept_12h genelde true.
- stimulus (isteğe bağlı uyaran, her türde): gerekmiyorsa kind "none" ve bütün alanlar boş. Tablo (kind "table": columns 1–6, rows 1–12, her satırda sütun sayısı kadar hücre) ya da sütun grafiği (kind "bar_chart": bars 2–10, değer 0–100000). alt zorunlu: verinin metin karşılığıdır (ekran okuyucu); veriyi aktarabilir ama sorunun cevabını, hesap sonucunu ya da doğru seçeneği söylemez.
- Yapılandırılmış soruda choices, correct_key, expected_answer ve rubric yoktur; solution kısa çözüm açıklamasıdır (yalnız veli görür).`;
/** Yapılandırılmış ek yalnız tür istendiğinde istemdedir; sürümü ayrı tutulur (temel kalite istemiyle birlikte sürümlenir). */
export const STRUCTURED_PROMPT_VERSION = "prova-generate/v12-untrusted-structured-phase2";

// ---------------------------------------------------------------------------------------------------------------
// 6) Tür açık mı? Faz 2A/2B türleri sunucuda enabled=false gelir; kapalı tür SQL'de (qt_insert_structured)
// `interaction_type_unavailable` ile düşer. Ücretli sağlayıcı çağrısından ÖNCE okunur ki kapalı tür için ücret oluşmasın.
type TypesTable = {
  from: (t: string) => { select: (c: string) => { in: (col: string, v: string[]) => PromiseLike<{ data: unknown; error: unknown }> } };
};
/** İstenen yapılandırılmış türlerden kapalı/kayıtsız olanlar; okuma hatasında null. */
export async function disabledInteractionTypes(db: TypesTable, types: readonly string[]): Promise<string[] | null> {
  const wanted = types.filter(isStructuredType);
  if (!wanted.length) return [];
  const { data, error } = await db.from("interaction_types").select("type,enabled").in("type", wanted);
  if (error || !Array.isArray(data)) return null;
  const on = new Set((data as { type: string; enabled: boolean }[]).filter((r) => r.enabled === true).map((r) => r.type));
  return wanted.filter((t) => !on.has(t));
}
