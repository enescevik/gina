/**
 * QT10–QT21 — çocuk cevaplama ve veli inceleme için saf yardımcılar.
 *
 * Puan HESAPLAMAZ: SQL (`gina.qt_score`) tek puan otoritesidir. Buradaki fonksiyonlar yalnız
 * cevap düzenleme (dokun-yerleştir kuralları), doluluk durumu ve sunucunun yazdığı
 * `score_details` + veliye açık anahtarın ekranda nasıl okunacağını belirler.
 */
import {
  answerState,
  type AnswerOf,
  type AnswerState,
  categoryFull,
  type ClassificationPayload,
  type FillBlankPayload,
  isPhase2aType,
  isStructuredType,
  parseNumberInput,
  phase2aAnswerSchema,
  phase2aPayloadSchemas,
  type Phase2aAnswer,
  type Phase2aInteractionType,
  setBlank,
  setPlacement,
  structuredAnswerSchema,
  type StructuredAnswer,
  type StructuredInteractionType,
  type StudentPayload,
  studentPayloadSchemas,
} from "@gina/core";
import { z } from "zod";

// ---------------------------------------------------------------------------------------------
// Payload / cevap okuma

/** Sunucudan gelen payload'ı türün şemasıyla okur. Bozuk/bilinmeyen sürüm → null (güncelleme gerekir). */
export function readPayload<T extends StructuredInteractionType>(type: T, payload: unknown): StudentPayload<T> | null {
  const schema = studentPayloadSchemas[type] as unknown as z.ZodType<StudentPayload<T>>;
  const parsed = schema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/** İstemcinin okuyabildiği bütün yapılandırılmış cevaplar (1A/1B + 2A). */
export type ClientAnswer = StructuredAnswer | Phase2aAnswer;
export type ClientInteractionType = StructuredInteractionType | Phase2aInteractionType;
export const clientAnswerSchema = z.union([structuredAnswerSchema, phase2aAnswerSchema]);
export const isClientType = (t: string | null | undefined): t is ClientInteractionType => isStructuredType(t) || isPhase2aType(t ?? "");

/** 2A payload'ı (öğrenci projeksiyonu ya da veli tam payload'ı; ikisi de aynı anahtarları taşır). */
export function readPhase2aPayload<T extends Phase2aInteractionType>(type: T, payload: unknown) {
  const parsed = (phase2aPayloadSchemas[type] as unknown as z.ZodType<z.infer<(typeof phase2aPayloadSchemas)[T]>>).safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/** Kayıtlı cevap (jsonb) → yapılandırılmış cevap; tür uyuşmuyorsa null değil hata. */
export function readStructuredAnswer(type: string, value: unknown): ClientAnswer | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = clientAnswerSchema.safeParse(value);
  if (!parsed.success || parsed.data.type !== type) throw new Error("client_update_required");
  return parsed.data;
}

/** Bu istemci soruyu çizebilir mi (tür + şema sürümü + payload). */
export function canRender(type: string | null | undefined, schemaVersion: number | null | undefined, payload: unknown): boolean {
  if (!isClientType(type) || (schemaVersion ?? 1) !== 1) return false;
  return isPhase2aType(type) ? readPhase2aPayload(type, payload) !== null : readPayload(type, payload) !== null;
}

// ---------------------------------------------------------------------------------------------
// Doluluk durumu (gezgin ve "boş bırakarak bitir" onayı). Puan değildir.

export interface NavigatorQuestion {
  kind: string;
  interaction_type?: string | null;
  payload?: unknown;
}
export interface NavigatorAnswer {
  key?: string;
  text?: string;
  hasDocument?: boolean;
  answer?: ClientAnswer;
}
export function questionFillState(q: NavigatorQuestion, a: NavigatorAnswer | undefined): AnswerState {
  if (q.kind === "structured" && isClientType(q.interaction_type)) {
    return answerState(q.interaction_type, q.payload, a?.answer ?? null);
  }
  return a?.key || a?.text?.trim() || a?.hasDocument ? "complete" : "unanswered";
}

export function fillCounts(states: AnswerState[]) {
  return {
    unanswered: states.filter((s) => s === "unanswered").length,
    partial: states.filter((s) => s === "partial").length,
    complete: states.filter((s) => s === "complete").length,
  };
}

// ---------------------------------------------------------------------------------------------
// Dokun-yerleştir kuralları

/** Kelime havuzu: kelimeyi boşluğa koy. Tekrar kullanım kapalıysa kelime eski boşluğundan alınır. */
export function placeToken(a: AnswerOf<"fill_blank">, p: FillBlankPayload, blank: string, token: string): AnswerOf<"fill_blank"> {
  let next = a;
  if (!p.bank_reuse) {
    for (const [id, v] of Object.entries(a.blanks)) {
      if (id !== blank && "token" in v && v.token === token) next = setBlank(next, id, null);
    }
  }
  return setBlank(next, blank, { token });
}

/** Kelime → bulunduğu boşluklar (havuzda "kullanıldı" göstermek için). */
export function tokenUses(a: AnswerOf<"fill_blank"> | undefined): Record<string, string[]> {
  const uses: Record<string, string[]> = {};
  for (const [blank, v] of Object.entries(a?.blanks ?? {})) {
    if ("token" in v) (uses[v.token] ??= []).push(blank);
  }
  return uses;
}

export function blankIds(p: FillBlankPayload): string[] {
  return p.segments.flatMap((s) => (s.type === "blank" ? [s.id] : []));
}

/** Eşleştirme: sağ öğe → ona bağlı sol öğeler. */
export function rightUses(a: AnswerOf<"matching"> | undefined): Record<string, string[]> {
  const uses: Record<string, string[]> = {};
  for (const [left, right] of Object.entries(a?.pairs ?? {})) (uses[right] ??= []).push(left);
  return uses;
}

/** Sınıflandırma: kapasite doluysa (ve öğe zaten orada değilse) yerleştirme reddedilir → null. */
export function placeItem(a: AnswerOf<"classification">, p: ClassificationPayload, item: string, category: string): AnswerOf<"classification"> | null {
  if (a.placement[item] === category) return a;
  if (categoryFull(p, a, category)) return null;
  return setPlacement(a, item, category);
}

/** Sayısal giriş için nazik ipucu: boş değilse ve sayı olarak okunamıyorsa "sayı gibi görünmüyor". */
export function numericHint(value: string | undefined): "not_a_number" | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  return parseNumberInput(v) === null ? "not_a_number" : null;
}

/** Yalnız sayı yazarken kullanılan karakterleri tutar (harfleri atar; ifade çalıştırılmaz). */
export function cleanNumericInput(value: string): string {
  return value.replace(/[^0-9.,/\s\-−]/g, "").replace(/\s{2,}/g, " ").slice(0, 40);
}

// ---------------------------------------------------------------------------------------------
// Veli incelemesi: sunucu özet satırı ve madde satırları

export const structuredSummaryRowSchema = z.object({
  question_id: z.string(),
  position: z.number().int(),
  interaction_type: z.string().nullable(),
  answer_state: z.enum(["unanswered", "partial", "complete"]),
  outcome: z.enum(["scored", "pending_human", "unanswered"]).nullable(),
  score: z.number().nullable(),
  score_exact: z.number().nullable(),
  graded_by: z.string().nullable(),
  auto_score: z.number().nullable(),
  answer_hash: z.string().nullable(),
});
export type StructuredSummaryRow = z.infer<typeof structuredSummaryRowSchema>;
export function readStructuredSummary(raw: unknown): StructuredSummaryRow[] {
  const list = (raw as { structured_answers?: unknown } | null)?.structured_answers;
  const parsed = z.array(structuredSummaryRowSchema).safeParse(list ?? []);
  return parsed.success ? parsed.data : [];
}

export const scoreOverrideSchema = z.object({
  question_id: z.string(),
  auto_score: z.number().nullable(),
  previous_score: z.number().nullable(),
  parent_score: z.number(),
  reason: z.string().nullable(),
  created_at: z.string(),
});
export type ScoreOverride = z.infer<typeof scoreOverrideSchema>;
export function readOverrides(raw: unknown): ScoreOverride[] {
  const parsed = z.array(scoreOverrideSchema).safeParse(raw ?? []);
  return parsed.success ? parsed.data : [];
}

/** Velinin gördüğü durum: puanlı (tam/kısmi), veli puanı, veliyi bekliyor, cevapsız (0 sayılmadı). */
export type ParentItemStatus = "parent_scored" | "auto_scored" | "auto_scored_partial" | "pending_parent" | "unanswered";
export function parentItemStatus(row: Pick<StructuredSummaryRow, "outcome" | "score" | "graded_by" | "answer_state">): ParentItemStatus {
  if (row.graded_by === "parent" && row.score !== null) return "parent_scored";
  if (row.outcome === "scored" && row.score !== null) return row.answer_state === "partial" ? "auto_scored_partial" : "auto_scored";
  if (row.outcome === "pending_human") return "pending_parent";
  return "unanswered";
}
/** Otomatik puanı değiştiren veli kararında gerekçe zorunlu (sunucu: score_reason_required). */
export function reasonRequired(row: Pick<StructuredSummaryRow, "outcome" | "auto_score">, score: number): boolean {
  return row.outcome === "scored" && row.auto_score !== null && Math.round(row.auto_score) !== score;
}
export function parseScoreInput(value: string): number | null {
  const v = value.trim();
  if (!/^\d{1,3}$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 100 ? n : null;
}

export interface ScoreDetails {
  answer_state?: AnswerState;
  outcome?: "scored" | "pending_human" | "unanswered";
  score?: number | null;
  items?: Record<string, unknown>;
}
export function readScoreDetails(raw: unknown): ScoreDetails | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as ScoreDetails) : null;
}

/** review: anahtarda olmayan anlamlı cevap; veli karar verir (pending_human). */
export type ItemMark = "correct" | "incorrect" | "blank" | "unknown" | "review";
export interface ReviewRow {
  id: string;
  prompt: string;
  given: string | null;
  expected: string | null;
  mark: ItemMark;
}
export interface ReviewLabels {
  yes: string;
  no: string;
  blank: (n: number) => string;
  value: string;
  unit: string;
  position: (n: number) => string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const textOf = (list: { id: string; text: string }[] | undefined, id: unknown) =>
  typeof id === "string" ? list?.find((x) => x.id === id)?.text ?? null : null;

function markOf(details: ScoreDetails | null, id: string, given: string | null): ItemMark {
  const item = details?.items?.[id];
  if (isObj(item)) {
    if (item.answered === false) return "blank";
    return item.correct === true ? "correct" : "incorrect";
  }
  return given === null ? "blank" : "unknown";
}

/**
 * Veli inceleme satırları: her alt madde için çocuğun cevabı, doğru cevap (anahtardan) ve
 * sunucunun `score_details.items` işareti. Sıralamada işaret pozisyon başına değil, sunucunun
 * ikili öncelik özeti olarak ayrıca gösterilir (bkz. orderingSummary).
 */
export function reviewRows(
  type: StructuredInteractionType,
  payload: unknown,
  answer: StructuredAnswer | null | undefined,
  details: ScoreDetails | null,
  key: unknown,
  labels: ReviewLabels,
): ReviewRow[] {
  const k = isObj(key) ? key : {};
  const a = answer && answer.type === type ? answer : null;
  switch (type) {
    case "true_false": {
      const p = readPayload("true_false", payload);
      if (!p) return [];
      const items = (a as AnswerOf<"true_false"> | null)?.items ?? {};
      const answers = isObj(k.answers) ? k.answers : {};
      return p.statements.map((s) => {
        const g = items[s.id];
        const given = g === undefined ? null : g ? labels.yes : labels.no;
        const e = answers[s.id];
        return { id: s.id, prompt: s.text, given, expected: typeof e === "boolean" ? (e ? labels.yes : labels.no) : null, mark: markOf(details, s.id, given) };
      });
    }
    case "fill_blank": {
      const p = readPayload("fill_blank", payload);
      if (!p) return [];
      const blanks = (a as AnswerOf<"fill_blank"> | null)?.blanks ?? {};
      const kb = isObj(k.blanks) ? k.blanks : {};
      return blankIds(p).map((id, n) => {
        const v = blanks[id];
        const given = !v ? null : "token" in v ? textOf(p.bank, v.token) : v.text.trim() ? v.text : null;
        const ke = kb[id];
        const expected = !isObj(ke)
          ? null
          : Array.isArray(ke.tokens)
          ? ke.tokens.map((tk) => textOf(p.bank, tk)).filter(Boolean).join(" / ")
          : Array.isArray(ke.accepted)
          ? ke.accepted.filter((x): x is string => typeof x === "string").join(" / ")
          : null;
        return { id, prompt: labels.blank(n + 1), given, expected, mark: markOf(details, id, given) };
      });
    }
    case "matching": {
      const p = readPayload("matching", payload);
      if (!p) return [];
      const pairs = (a as AnswerOf<"matching"> | null)?.pairs ?? {};
      const kp = isObj(k.pairs) ? k.pairs : {};
      return p.left.map((l) => {
        const given = textOf(p.right, pairs[l.id]);
        return { id: l.id, prompt: l.text, given, expected: textOf(p.right, kp[l.id]), mark: markOf(details, l.id, given) };
      });
    }
    case "classification": {
      const p = readPayload("classification", payload);
      if (!p) return [];
      const placement = (a as AnswerOf<"classification"> | null)?.placement ?? {};
      const km = isObj(k.membership) ? k.membership : {};
      return p.items.map((i) => {
        const given = textOf(p.categories, placement[i.id]);
        return { id: i.id, prompt: i.text, given, expected: textOf(p.categories, km[i.id]), mark: markOf(details, i.id, given) };
      });
    }
    case "numeric": {
      const p = readPayload("numeric", payload);
      if (!p) return [];
      const n = a as AnswerOf<"numeric"> | null;
      const unitText = textOf(p.units, n?.unit);
      const keyUnit = textOf(p.units, k.unit);
      const split = isObj(details?.items?.unit);
      const value = n?.value?.trim() ? n.value : null;
      const rows: ReviewRow[] = [{
        id: "value",
        prompt: labels.value,
        given: value === null && !unitText ? null : [value, split ? null : unitText].filter(Boolean).join(" ") || null,
        expected: typeof k.value === "string" ? [k.value, split ? null : keyUnit].filter(Boolean).join(" ") : null,
        mark: markOf(details, "value", value),
      }];
      if (split) rows.push({ id: "unit", prompt: labels.unit, given: unitText, expected: keyUnit, mark: markOf(details, "unit", unitText) });
      return rows;
    }
    case "ordering": {
      const p = readPayload("ordering", payload);
      if (!p) return [];
      const order = (a as AnswerOf<"ordering"> | null)?.order ?? [];
      const orders = Array.isArray(k.orders) ? k.orders : [];
      const first = Array.isArray(orders[0]) ? (orders[0] as unknown[]) : [];
      return p.items.map((_, i) => ({
        id: `pos${i}`,
        prompt: labels.position(i + 1),
        given: textOf(p.items, order[i]),
        expected: textOf(p.items, first[i]),
        mark: order.length ? "unknown" : "blank",
      }));
    }
  }
}

/** Sıralama için sunucu özeti: doğru ikili öncelik / gerekli. */
export function orderingSummary(details: ScoreDetails | null): { correct: number; required: number } | null {
  const items = details?.items;
  if (!isObj(items) || typeof items.pairs_correct !== "number" || typeof items.pairs_required !== "number") return null;
  return { correct: items.pairs_correct, required: items.pairs_required };
}
/** Süreç gerektiren sayısalda otomatik sonuç ipucu (kesin puan değildir). */
export function autoResultHint(details: ScoreDetails | null): number | null {
  const v = details?.items?.auto_result_score;
  return typeof v === "number" ? v : null;
}
