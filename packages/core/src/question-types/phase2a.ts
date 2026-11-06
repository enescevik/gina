import { z } from "zod";

/**
 * QT30–QT33 (Faz 2A) istemci sözleşmesi: metin işaretleme, hata bulma–düzeltme, çoklu doğru seçenek,
 * iki aşamalı soru. Puan SQL'de (`gina.qt2_score`). Bu türler sunucuda `enabled=false` ile gelir;
 * çiziciler yayınlanana kadar `CLIENT_SUPPORTED_INTERACTION_TYPES` içine eklenmez.
 */
export const PHASE2A_INTERACTION_TYPES = ["mark_text", "error_fix", "multi_choice", "two_stage"] as const;
export type Phase2aInteractionType = (typeof PHASE2A_INTERACTION_TYPES)[number];
export const isPhase2aType = (t: string): t is Phase2aInteractionType => (PHASE2A_INTERACTION_TYPES as readonly string[]).includes(t);

const ID = z.string().regex(/^[a-z][a-z0-9_]{0,23}$/);
const opt = (max: number) => z.object({ id: ID, text: z.string().min(1).max(max) }).strict();
const segment = z.union([z.object({ id: ID, text: z.string().min(1).max(500) }).strict(), z.object({ text: z.string().min(1).max(500) }).strict()]);

export const phase2aPayloadSchemas = {
  mark_text: z.object({ unit: z.enum(["word", "sentence"]), segments: z.array(segment).min(2).max(300), max_select: z.number().int().min(1).optional() }).strict(),
  error_fix: z.object({ unit: z.enum(["word", "sentence"]), segments: z.array(segment).min(2).max(300) }).strict(),
  multi_choice: z.object({ options: z.array(opt(500)).min(3).max(8), select_count: z.number().int().min(1).optional() }).strict(),
  two_stage: z.object({
    stage1: z.object({ prompt: z.string().min(1).max(1000), options: z.array(opt(300)).min(2).max(6) }).strict(),
    stage2: z.object({ prompt: z.string().min(1).max(1000), mode: z.enum(["choice", "text"]), options: z.array(opt(300)).min(2).max(6).optional() }).strict(),
  }).strict(),
} satisfies Record<Phase2aInteractionType, z.ZodType>;

const tag = <T extends Phase2aInteractionType>(t: T) => ({ type: z.literal(t), v: z.literal(1) });
export const phase2aAnswerSchemas = {
  mark_text: z.object({ ...tag("mark_text"), selected: z.array(ID).max(300) }).strict(),
  error_fix: z.object({ ...tag("error_fix"), marks: z.record(ID, z.object({ text: z.string().max(120).optional() }).strict()) }).strict(),
  multi_choice: z.object({ ...tag("multi_choice"), selected: z.array(ID).max(8) }).strict(),
  two_stage: z.object({ ...tag("two_stage"), stage1: ID.optional(), stage2: z.union([ID, z.object({ text: z.string().max(2000) }).strict()]).optional() }).strict(),
} satisfies Record<Phase2aInteractionType, z.ZodType>;
export type Phase2aAnswer = z.infer<(typeof phase2aAnswerSchemas)[Phase2aInteractionType]>;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const onlyKeys = (o: unknown, allowed: string[]) => isObj(o) && Object.keys(o).every((k) => allowed.includes(k));
const validId = (t: unknown): t is string => typeof t === "string" && /^[a-z][a-z0-9_]{0,23}$/.test(t);

function segmentIds(arr: unknown, max: number): string[] | null {
  if (!Array.isArray(arr) || arr.length < 2 || arr.length > max) return null;
  const ids: string[] = [];
  for (const e of arr) {
    if (!isObj(e) || typeof e.text !== "string" || e.text.length < 1 || e.text.length > 500) return null;
    if ("id" in e) {
      if (!onlyKeys(e, ["id", "text"]) || !validId(e.id) || ids.includes(e.id) || e.text.trim().length === 0) return null;
      ids.push(e.id);
    } else if (!onlyKeys(e, ["text"])) return null;
  }
  return ids;
}
function entryIds(arr: unknown, max: number, maxText: number): string[] | null {
  if (!Array.isArray(arr) || arr.length > max) return null;
  const ids: string[] = [];
  for (const e of arr) {
    if (!isObj(e) || !onlyKeys(e, ["id", "text"]) || !validId(e.id) || ids.includes(e.id) || typeof e.text !== "string") return null;
    const n = e.text.trim().length;
    if (n < 1 || n > maxText) return null;
    ids.push(e.id);
  }
  return ids;
}

export function phase2aContentErrors(type: Phase2aInteractionType, p: unknown, k: unknown): string[] {
  const err = new Set<string>();
  const done = () => [...err].sort();
  if (!isObj(p) || JSON.stringify(p).length > 16000) return ["payload_invalid"];
  if (!isObj(k) || JSON.stringify(k).length > 16000) return ["key_invalid"];
  if (type === "mark_text" || type === "error_fix") {
    if (!onlyKeys(p, type === "mark_text" ? ["unit", "segments", "max_select"] : ["unit", "segments"])) return ["payload_unknown_field"];
    if (p.unit !== "word" && p.unit !== "sentence") err.add("unit_invalid");
    const ids = segmentIds(p.segments, 300);
    if (!ids || ids.length < 2) return [...done(), "segments_invalid"].sort();
    const max = p.max_select;
    if (max !== undefined && (typeof max !== "number" || !Number.isInteger(max) || max < 1 || max > ids.length)) err.add("max_select_invalid");
    if (type === "mark_text") {
      if (!onlyKeys(k, ["targets"]) || !Array.isArray(k.targets)) return [...done(), "key_invalid"].sort();
      const t = k.targets as unknown[];
      if (new Set(t.filter((x) => typeof x === "string" && ids.includes(x))).size !== t.length) err.add("key_value_invalid");
      if (t.length < 1 || t.length >= ids.length) err.add("selection_balance_invalid");
      if (typeof max === "number" && max < t.length) err.add("max_select_invalid");
    } else {
      if (!onlyKeys(k, ["errors", "find_weight", "fix_policy", "case_insensitive"]) || !isObj(k.errors)) return [...done(), "key_invalid"].sort();
      const entries = Object.entries(k.errors);
      for (const [id, v] of entries) {
        if (!ids.includes(id)) err.add("key_unknown_id");
        else if (!onlyKeys(v, ["accepted"]) || !Array.isArray((v as Obj).accepted) || ((v as Obj).accepted as unknown[]).length < 1 || ((v as Obj).accepted as unknown[]).length > 8 ||
          ((v as Obj).accepted as unknown[]).some((x) => typeof x !== "string" || x.trim().length < 1 || x.trim().length > 120)) err.add("key_value_invalid");
      }
      if (entries.length < 1 || entries.length >= ids.length) err.add("selection_balance_invalid");
      if ("find_weight" in k && (typeof k.find_weight !== "number" || k.find_weight < 0.1 || k.find_weight > 0.9)) err.add("weights_invalid");
      if (k.fix_policy !== undefined && k.fix_policy !== "review_unmatched" && k.fix_policy !== "closed") err.add("key_invalid");
      if ("case_insensitive" in k && typeof k.case_insensitive !== "boolean") err.add("key_invalid");
    }
  } else if (type === "multi_choice") {
    if (!onlyKeys(p, ["options", "select_count"])) return ["payload_unknown_field"];
    const ids = entryIds(p.options, 8, 500);
    if (!ids || ids.length < 3) return ["options_invalid"];
    if (!onlyKeys(k, ["correct"]) || !Array.isArray(k.correct)) return [...done(), "key_invalid"].sort();
    const c = k.correct as unknown[];
    if (new Set(c.filter((x) => typeof x === "string" && ids.includes(x))).size !== c.length) err.add("key_value_invalid");
    if (c.length < 1 || c.length >= ids.length) err.add("selection_balance_invalid");
    if ("select_count" in p && p.select_count !== c.length) err.add("select_count_mismatch");
  } else {
    if (!onlyKeys(p, ["stage1", "stage2"])) return ["payload_unknown_field"];
    const s1 = p.stage1 as Obj, s2 = p.stage2 as Obj;
    if (!onlyKeys(s1, ["prompt", "options"]) || typeof s1.prompt !== "string" || s1.prompt.trim().length < 1 || s1.prompt.trim().length > 1000) return ["stage_invalid"];
    const ids1 = entryIds(s1.options, 6, 300);
    if (!ids1 || ids1.length < 2) return ["stage_invalid"];
    if (!onlyKeys(s2, ["prompt", "mode", "options"]) || typeof s2.prompt !== "string" || s2.prompt.trim().length < 1 || s2.prompt.trim().length > 1000 ||
      (s2.mode !== "choice" && s2.mode !== "text")) return ["stage_invalid"];
    let ids2: string[] = [];
    if (s2.mode === "choice") {
      const r = entryIds(s2.options, 6, 300);
      if (!r || r.length < 2 || r.some((x) => ids1.includes(x))) return ["stage_invalid"];
      ids2 = r;
    } else if ("options" in s2) return ["stage_invalid"];
    if (!onlyKeys(k, ["stage1", "stage2", "weights"]) || typeof k.stage1 !== "string") return [...done(), "key_invalid"].sort();
    if (!ids1.includes(k.stage1)) err.add("key_value_invalid");
    if (s2.mode === "choice") {
      if (typeof k.stage2 !== "string" || !ids2.includes(k.stage2)) err.add("key_value_invalid");
    } else if (k.stage2 !== undefined && k.stage2 !== null) err.add("key_value_invalid");
    if (k.weights !== undefined && k.weights !== null && (!isObj(k.weights) ||
      Object.entries(k.weights).some(([w, v]) => !["stage1", "stage2"].includes(w) || typeof v !== "number" || v <= 0 || v > 10))) err.add("weights_invalid");
  }
  return done();
}

export function phase2aAnswerErrors(type: Phase2aInteractionType, p: Obj, a: Obj): string[] {
  if (type === "mark_text" || type === "multi_choice") {
    if (!onlyKeys(a, ["type", "v", "selected"])) return ["answer_unknown_field"];
    const ids = type === "mark_text"
      ? (p.segments as Obj[]).filter((s) => "id" in s).map((s) => String(s.id))
      : (p.options as Obj[]).map((o) => String(o.id));
    if (!Array.isArray(a.selected)) return ["answer_invalid"];
    if (a.selected.some((x) => typeof x !== "string" || !ids.includes(x))) return ["answer_unknown_id"];
    if (new Set(a.selected).size !== a.selected.length) return ["answer_value_invalid"];
    const max = (p.max_select as number | undefined) ?? (p.select_count as number | undefined) ?? ids.length;
    if (a.selected.length > max) return ["answer_too_many"];
  } else if (type === "error_fix") {
    if (!onlyKeys(a, ["type", "v", "marks"]) || !isObj(a.marks)) return ["answer_invalid"];
    const ids = (p.segments as Obj[]).filter((s) => "id" in s).map((s) => String(s.id));
    for (const [k, v] of Object.entries(a.marks)) {
      if (!ids.includes(k)) return ["answer_unknown_id"];
      if (!onlyKeys(v, ["text"]) || ("text" in (v as Obj) && (typeof (v as Obj).text !== "string" || ((v as Obj).text as string).length > 120))) return ["answer_value_invalid"];
    }
  } else {
    if (!onlyKeys(a, ["type", "v", "stage1", "stage2"])) return ["answer_unknown_field"];
    const s1 = ((p.stage1 as Obj).options as Obj[]).map((o) => String(o.id));
    if ("stage1" in a && (typeof a.stage1 !== "string" || !s1.includes(a.stage1))) return ["answer_unknown_id"];
    if ("stage2" in a) {
      const s2 = p.stage2 as Obj;
      if (s2.mode === "choice") {
        if (typeof a.stage2 !== "string" || !(s2.options as Obj[]).some((o) => o.id === a.stage2)) return ["answer_unknown_id"];
      } else if (!onlyKeys(a.stage2, ["text"]) || typeof (a.stage2 as Obj).text !== "string" || ((a.stage2 as Obj).text as string).length > 2000) {
        return ["answer_value_invalid"];
      }
    }
  }
  return [];
}

export function phase2aAnswerState(p: Obj, a: Phase2aAnswer | null | undefined): "unanswered" | "partial" | "complete" {
  if (!a) return "unanswered";
  switch (a.type) {
    case "mark_text":
    case "multi_choice":
      return a.selected.length ? "complete" : "unanswered";
    case "error_fix": {
      const marks = Object.entries(a.marks);
      if (!marks.length) return "unanswered";
      // Gerçek hata konumları anahtardadır; istemci yalnız işaretlenmiş ama düzeltmesi boş öğeleri bilebilir.
      return marks.some(([, m]) => (m.text ?? "").trim().length === 0) ? "partial" : "complete";
    }
    case "two_stage": {
      const second = typeof a.stage2 === "string" ? true : a.stage2 ? a.stage2.text.trim().length > 0 : false;
      const first = a.stage1 !== undefined;
      return !first && a.stage2 === undefined ? "unanswered" : first && second ? "complete" : "partial";
    }
  }
}
