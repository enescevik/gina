import { z } from "zod";
import { isPhase2bType, phase2bAnswerErrors, phase2bAnswerState, stimulusSchema, type Phase2bAnswer, type Phase2bInteractionType } from "./phase2b";
import { isPhase2aType, phase2aAnswerErrors, phase2aAnswerState, type Phase2aAnswer, type Phase2aInteractionType } from "./phase2a";

/**
 * QT00 — yapılandırılmış soru türleri sözleşmesi (istemci tarafı).
 *
 * SQL sunucu puanlama otoritesidir (`gina.qt_score`). Bu modül ikinci bir puan motoru DEĞİLDİR:
 * yalnız tür/cevap şekli doğrulaması, cevap doluluk durumu, cevap düzenleme yardımcıları ve
 * hazırlama ekranı için içerik doğrulaması sağlar. Hata kodları SQL ile aynıdır ve
 * `fixtures.json` ortak örnekleriyle (SQL golden testi + core testi) birlikte doğrulanır.
 */

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

/** Bu istemci sürümünün çizebildiği türler; `get_attempt_questions_v2` p_supported. */
export const CLIENT_SUPPORTED_INTERACTION_TYPES: readonly InteractionType[] = [
  ...LEGACY_INTERACTION_TYPES,
  ...STRUCTURED_INTERACTION_TYPES,
];

export const INTERACTION_PHASE: Record<StructuredInteractionType, "1A" | "1B"> = {
  true_false: "1A",
  fill_blank: "1A",
  matching: "1A",
  numeric: "1A",
  ordering: "1B",
  classification: "1B",
};
/** Alıştırma türü: OYSS/ortak yazılı (assessment_track = meb_common) sınavına kendiliğinden alınmaz. */
export const PRACTICE_ONLY_TYPES: ReadonlySet<StructuredInteractionType> = new Set([
  "true_false",
  "fill_blank",
  "matching",
  "ordering",
  "classification",
]);

export function isStructuredType(t: string | null | undefined): t is StructuredInteractionType {
  return (STRUCTURED_INTERACTION_TYPES as readonly string[]).includes(t ?? "");
}
export function effectiveInteractionType(kind: string, interactionType?: string | null): string {
  return interactionType ?? kind;
}

// ---------------------------------------------------------------------------------------------
// Şemalar (öğrenci payload'ı = izin listesiyle kurulan projeksiyon; hazırlama payload'ı = tam içerik)
const ID = z.string().regex(/^[a-z][a-z0-9_]{0,23}$/);
const entry = (max: number) => z.object({ id: ID, text: z.string().refine((s) => s.trim().length >= 1 && s.trim().length <= max) }).strict();

export const studentPayloadSchemas = {
  true_false: z.object({ statements: z.array(entry(500)).min(1).max(10), stimulus: stimulusSchema.optional() }).strict(),
  fill_blank: z.object({
    segments: z.array(z.discriminatedUnion("type", [
      z.object({ type: z.literal("text"), text: z.string().min(1).max(1000) }).strict(),
      z.object({ type: z.literal("blank"), id: ID }).strict(),
    ])).min(2).max(40),
    input: z.enum(["bank", "keyboard"]),
    bank: z.array(entry(80)).max(16).optional(),
    bank_reuse: z.boolean().optional(),
    stimulus: stimulusSchema.optional(),
  }).strict(),
  matching: z.object({
    left: z.array(entry(300)).min(2).max(8),
    right: z.array(entry(300)).min(2).max(10),
    policy: z.enum(["one_to_one", "many_to_one"]),
    stimulus: stimulusSchema.optional(),
  }).strict(),
  numeric: z.object({
    units: z.array(entry(20)).max(8),
    unit_required: z.boolean(),
    work_area: z.boolean().optional(),
    stimulus: stimulusSchema.optional(),
  }).strict(),
  ordering: z.object({ items: z.array(entry(300)).min(2).max(10), mode: z.enum(["sequence", "sentence"]), stimulus: stimulusSchema.optional() }).strict(),
  classification: z.object({
    items: z.array(entry(200)).min(2).max(16),
    categories: z.array(z.object({ id: ID, text: z.string().min(1).max(80), capacity: z.number().int().min(1).max(16).optional() }).strict()).min(2).max(5),
    stimulus: stimulusSchema.optional(),
  }).strict(),
} satisfies Record<StructuredInteractionType, z.ZodType>;

export type StudentPayload<T extends StructuredInteractionType = StructuredInteractionType> = z.infer<(typeof studentPayloadSchemas)[T]>;
export type TrueFalsePayload = StudentPayload<"true_false">;
export type FillBlankPayload = StudentPayload<"fill_blank">;
export type MatchingPayload = StudentPayload<"matching">;
export type NumericPayload = StudentPayload<"numeric">;
export type OrderingPayload = StudentPayload<"ordering">;
export type ClassificationPayload = StudentPayload<"classification">;

const tag = <T extends StructuredInteractionType>(t: T) => ({ type: z.literal(t), v: z.literal(1) });
export const answerSchemas = {
  true_false: z.object({ ...tag("true_false"), items: z.record(ID, z.boolean()) }).strict(),
  fill_blank: z.object({
    ...tag("fill_blank"),
    blanks: z.record(ID, z.union([z.object({ token: ID }).strict(), z.object({ text: z.string().max(120) }).strict()])),
  }).strict(),
  matching: z.object({ ...tag("matching"), pairs: z.record(ID, ID) }).strict(),
  numeric: z.object({ ...tag("numeric"), value: z.string().max(40).optional(), unit: ID.optional() }).strict(),
  ordering: z.object({ ...tag("ordering"), order: z.array(ID).min(2).max(10) }).strict(),
  classification: z.object({ ...tag("classification"), placement: z.record(ID, ID) }).strict(),
} satisfies Record<StructuredInteractionType, z.ZodType>;
export const structuredAnswerSchema = z.discriminatedUnion("type", [
  answerSchemas.true_false,
  answerSchemas.fill_blank,
  answerSchemas.matching,
  answerSchemas.numeric,
  answerSchemas.ordering,
  answerSchemas.classification,
]);
export type StructuredAnswer = z.infer<typeof structuredAnswerSchema>;
export type AnswerOf<T extends StructuredInteractionType> = Extract<StructuredAnswer, { type: T }>;

// ---------------------------------------------------------------------------------------------
export { parseNumberInput } from "./number";

// ---------------------------------------------------------------------------------------------
// Cevap doğrulaması (SQL gina.qt_answer_errors ile aynı kodlar). Boş dizi = geçerli.
const ids = (arr: { id: string }[] | undefined) => (arr ?? []).map((x) => x.id);
export function answerErrors(type: StructuredInteractionType | Phase2aInteractionType | Phase2bInteractionType, payload: unknown, answer: unknown): string[] {
  if (payload && typeof payload === "object" && "stimulus" in payload) {
    const { stimulus: _s, ...rest } = payload as Record<string, unknown>;
    payload = rest;
  }
  if (!answer || typeof answer !== "object" || Array.isArray(answer) || JSON.stringify(answer).length > 8000) return ["answer_invalid"];
  const a = answer as Record<string, unknown>;
  if (a.type !== type) return ["answer_type_mismatch"];
  if (a.v !== 1) return ["answer_version_unsupported"];
  if (isPhase2aType(type)) return phase2aAnswerErrors(type, payload as Record<string, unknown>, a);
  if (isPhase2bType(type)) return phase2bAnswerErrors(type, payload as Record<string, unknown>, a);
  const field = { true_false: "items", fill_blank: "blanks", matching: "pairs", classification: "placement", ordering: "order", numeric: null }[type];
  const allowed = new Set(["type", "v", ...(field ? [field] : ["value", "unit"])]);
  if (Object.keys(a).some((k) => !allowed.has(k))) return ["answer_unknown_field"];
  const p = payload as Record<string, unknown>;
  if (type === "numeric") {
    if ("value" in a && (typeof a.value !== "string" || a.value.length > 40)) return ["answer_value_invalid"];
    if ("unit" in a && (typeof a.unit !== "string" || !ids(p.units as { id: string }[]).includes(a.unit))) return ["answer_unknown_id"];
    return [];
  }
  const value = a[field!];
  if (type === "ordering") {
    const all = ids(p.items as { id: string }[]);
    if (!Array.isArray(value) || value.length !== all.length || new Set(value.filter((x) => typeof x === "string" && all.includes(x))).size !== all.length) {
      return ["answer_order_invalid"];
    }
    return [];
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["answer_invalid"];
  const entries = Object.entries(value as Record<string, unknown>);
  const used: string[] = [];
  if (type === "true_false") {
    const known = ids(p.statements as { id: string }[]);
    for (const [k, v] of entries) {
      if (!known.includes(k)) return ["answer_unknown_id"];
      if (typeof v !== "boolean") return ["answer_value_invalid"];
    }
  } else if (type === "fill_blank") {
    const blanks = (p.segments as { type: string; id?: string }[]).filter((s) => s.type === "blank").map((s) => s.id!);
    const bank = ids(p.bank as { id: string }[]);
    for (const [k, v] of entries) {
      if (!blanks.includes(k)) return ["answer_unknown_id"];
      const o = v as Record<string, unknown>;
      if (p.input === "bank") {
        if (!o || typeof o !== "object" || Object.keys(o).join() !== "token" || typeof o.token !== "string" || !bank.includes(o.token)) return ["answer_value_invalid"];
        if (!p.bank_reuse && used.includes(o.token)) return ["answer_token_reused"];
        used.push(o.token);
      } else if (!o || typeof o !== "object" || Object.keys(o).join() !== "text" || typeof o.text !== "string" || o.text.length > 120) {
        return ["answer_value_invalid"];
      }
    }
  } else if (type === "matching") {
    const left = ids(p.left as { id: string }[]);
    const right = ids(p.right as { id: string }[]);
    for (const [k, v] of entries) {
      if (!left.includes(k)) return ["answer_unknown_id"];
      if (typeof v !== "string" || !right.includes(v)) return ["answer_value_invalid"];
      if (p.policy === "one_to_one" && used.includes(v)) return ["answer_pair_reused"];
      used.push(v);
    }
  } else if (type === "classification") {
    const items = ids(p.items as { id: string }[]);
    const cats = p.categories as { id: string; capacity?: number }[];
    const count: Record<string, number> = {};
    for (const [k, v] of entries) {
      if (!items.includes(k)) return ["answer_unknown_id"];
      if (typeof v !== "string" || !cats.some((c) => c.id === v)) return ["answer_value_invalid"];
      count[v] = (count[v] ?? 0) + 1;
    }
    if (cats.some((c) => c.capacity !== undefined && (count[c.id] ?? 0) > c.capacity)) return ["answer_capacity_exceeded"];
  }
  return [];
}

// ---------------------------------------------------------------------------------------------
// Cevap doluluk durumu (SQL score_details.answer_state ile aynı tanım). Puan DEĞİLDİR.
export type AnswerState = "unanswered" | "partial" | "complete";
export function answerState(type: StructuredInteractionType | Phase2aInteractionType | Phase2bInteractionType, payload: unknown, answer: StructuredAnswer | Phase2aAnswer | Phase2bAnswer | null | undefined): AnswerState {
  const p = payload as Record<string, unknown>;
  if (!answer) return "unanswered";
  if (isPhase2aType(answer.type)) return phase2aAnswerState(p, answer as Phase2aAnswer);
  if (isPhase2bType(answer.type)) return phase2bAnswerState(answer as Phase2bAnswer);
  const ratio = (done: number, total: number): AnswerState => (done === 0 ? "unanswered" : done < total ? "partial" : "complete");
  switch (answer.type) {
    case "true_false":
      return ratio(Object.keys(answer.items).length, (p.statements as unknown[]).length);
    case "fill_blank": {
      const blanks = (p.segments as { type: string }[]).filter((s) => s.type === "blank").length;
      const done = Object.values(answer.blanks).filter((b) => "token" in b || b.text.normalize("NFC").trim().length > 0).length;
      return ratio(done, blanks);
    }
    case "matching":
      return ratio(Object.keys(answer.pairs).length, (p.left as unknown[]).length);
    case "classification":
      return ratio(Object.keys(answer.placement).length, (p.items as unknown[]).length);
    case "ordering":
      return "complete";
    case "numeric": {
      const hasValue = (answer.value ?? "").trim().length > 0;
      if (!p.unit_required) return hasValue ? "complete" : "unanswered";
      const hasUnit = answer.unit !== undefined;
      return !hasValue && !hasUnit ? "unanswered" : hasValue && hasUnit ? "complete" : "partial";
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Cevap düzenleme yardımcıları (saf; değişmez nesne döner). Kimlikler ekran sırasına bağlı değildir.
export function emptyAnswer<T extends StructuredInteractionType>(type: T, payload?: unknown): AnswerOf<T> {
  const base = { type, v: 1 } as const;
  switch (type) {
    case "true_false": return { ...base, items: {} } as AnswerOf<T>;
    case "fill_blank": return { ...base, blanks: {} } as AnswerOf<T>;
    case "matching": return { ...base, pairs: {} } as AnswerOf<T>;
    case "classification": return { ...base, placement: {} } as AnswerOf<T>;
    case "numeric": return { ...base } as AnswerOf<T>;
    case "ordering": return { ...base, order: ids((payload as OrderingPayload | undefined)?.items) } as AnswerOf<T>;
  }
  throw new Error("type_unknown");
}
const without = <V>(o: Record<string, V>, k: string) => {
  const { [k]: _, ...rest } = o;
  return rest;
};
export function setTrueFalse(a: AnswerOf<"true_false">, id: string, value: boolean | null): AnswerOf<"true_false"> {
  return { ...a, items: value === null ? without(a.items, id) : { ...a.items, [id]: value } };
}
export function setBlank(a: AnswerOf<"fill_blank">, id: string, value: { token: string } | { text: string } | null): AnswerOf<"fill_blank"> {
  return { ...a, blanks: value === null ? without(a.blanks, id) : { ...a.blanks, [id]: value } };
}
/** Eşleştirme: birebir politikada sağ öğe başka bir sola bağlıysa oradan çözülür (değiştirme). */
export function setPair(a: AnswerOf<"matching">, left: string, right: string | null, policy: MatchingPayload["policy"]): AnswerOf<"matching"> {
  let pairs = without(a.pairs, left);
  if (right === null) return { ...a, pairs };
  if (policy === "one_to_one") pairs = Object.fromEntries(Object.entries(pairs).filter(([, r]) => r !== right));
  return { ...a, pairs: { ...pairs, [left]: right } };
}
export function setPlacement(a: AnswerOf<"classification">, item: string, category: string | null): AnswerOf<"classification"> {
  return { ...a, placement: category === null ? without(a.placement, item) : { ...a.placement, [item]: category } };
}
/** Sıralama: öğeyi verilen konuma taşı (yukarı/aşağı ve dokun-yerleştir için; sürükleme şart değil). */
export function moveItem(a: AnswerOf<"ordering">, id: string, toIndex: number): AnswerOf<"ordering"> {
  const from = a.order.indexOf(id);
  if (from < 0) return a;
  const order = a.order.filter((x) => x !== id);
  order.splice(Math.max(0, Math.min(order.length, toIndex)), 0, id);
  return { ...a, order };
}
export function setNumeric(a: AnswerOf<"numeric">, patch: { value?: string | null; unit?: string | null }): AnswerOf<"numeric"> {
  const next: AnswerOf<"numeric"> = { type: "numeric", v: 1 };
  const value = patch.value === undefined ? a.value : patch.value ?? undefined;
  const unit = patch.unit === undefined ? a.unit : patch.unit ?? undefined;
  if (value !== undefined && value !== "") next.value = value;
  if (unit !== undefined) next.unit = unit;
  return next;
}
/** Sınıflandırma kapasitesi dolu mu? */
export function categoryFull(p: ClassificationPayload, a: AnswerOf<"classification">, category: string): boolean {
  const cap = p.categories.find((c) => c.id === category)?.capacity;
  return cap !== undefined && Object.values(a.placement).filter((c) => c === category).length >= cap;
}

export * from "./authoring";
export * from "./phase2a";
export * from "./phase2b";
