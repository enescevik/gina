import { z } from "zod";

/**
 * QT41/QT42 (Faz 2B) istemci sözleşmesi: bölge seçme (şekil boyama / görsel üzerinde bölge), saat ve
 * yapılandırılmış türlere eklenen tablo/grafik uyaranı. Puan SQL'de. Sunucuda `enabled=false`.
 */
export const PHASE2B_INTERACTION_TYPES = ["region_select", "clock"] as const;
export type Phase2bInteractionType = (typeof PHASE2B_INTERACTION_TYPES)[number];
export const isPhase2bType = (t: string): t is Phase2bInteractionType => (PHASE2B_INTERACTION_TYPES as readonly string[]).includes(t);

const ID = z.string().regex(/^[a-z][a-z0-9_]{0,23}$/);
const box = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0.03).max(1), z.number().min(0.03).max(1)]);
export const stimulusSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("table"), caption: z.string().max(200).optional(), alt: z.string().min(5).max(1000),
    columns: z.array(z.string().min(1).max(60)).min(1).max(6), rows: z.array(z.array(z.union([z.string().max(80), z.number()]))).min(1).max(12) }).strict(),
  z.object({ kind: z.literal("bar_chart"), caption: z.string().max(200).optional(), alt: z.string().min(5).max(1000), x_label: z.string().max(40).optional(),
    y_label: z.string().max(40).optional(), unit: z.string().max(40).optional(), bars: z.array(z.object({ label: z.string().min(1).max(40), value: z.number().min(0).max(100000) }).strict()).min(2).max(10) }).strict(),
]);
export type Stimulus = z.infer<typeof stimulusSchema>;

export const phase2bPayloadSchemas = {
  region_select: z.object({
    figure: z.object({ kind: z.enum(["grid", "sectors", "image"]), rows: z.number().int().optional(), cols: z.number().int().optional(), source: z.literal("question_media").optional() }).strict(),
    regions: z.array(z.object({ id: ID, text: z.string().min(1).max(120), box: box.optional() }).strict()).min(2).max(48),
    max_select: z.number().int().min(1).optional(),
    stimulus: stimulusSchema.optional(),
  }).strict(),
  clock: z.object({
    mode: z.enum(["read", "set"]), display: z.enum(["analog", "digital"]), step_minutes: z.union([z.literal(1), z.literal(5), z.literal(15), z.literal(30), z.literal(60)]),
    shown_time: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).optional(), stimulus: stimulusSchema.optional(),
  }).strict(),
} satisfies Record<Phase2bInteractionType, z.ZodType>;
export const phase2bAnswerSchemas = {
  region_select: z.object({ type: z.literal("region_select"), v: z.literal(1), selected: z.array(ID).max(48) }).strict(),
  clock: z.object({ type: z.literal("clock"), v: z.literal(1), time: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).optional() }).strict(),
} satisfies Record<Phase2bInteractionType, z.ZodType>;
export type Phase2bAnswer = z.infer<(typeof phase2bAnswerSchemas)[Phase2bInteractionType]>;

export const parseClockTime = (t: unknown): number | null =>
  typeof t === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null;
export const formatClockTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const onlyKeys = (o: unknown, allowed: string[]) => isObj(o) && Object.keys(o).every((k) => allowed.includes(k));

/** SQL gina.qt_stimulus_errors ile aynı kodlar. */
export function stimulusErrors(s: unknown): string[] {
  if (s === undefined || s === null) return [];
  if (!isObj(s) || JSON.stringify(s).length > 8000) return ["stimulus_invalid"];
  if (typeof s.alt !== "string" || s.alt.trim().length < 5 || s.alt.trim().length > 1000 || ("caption" in s && (typeof s.caption !== "string" || s.caption.length > 200))) {
    return ["stimulus_alt_invalid"];
  }
  const r = stimulusSchema.safeParse(s);
  if (!r.success) return ["stimulus_invalid"];
  const d = r.data;
  if (d.kind === "table" && d.rows.some((row) => row.length !== d.columns.length)) return ["stimulus_invalid"];
  return [];
}

export function phase2bContentErrors(type: Phase2bInteractionType, p: unknown, k: unknown): string[] {
  const err = new Set<string>();
  if (!isObj(p) || JSON.stringify(p).length > 16000) return ["payload_invalid"];
  if (!isObj(k) || JSON.stringify(k).length > 16000) return ["key_invalid"];
  if (type === "region_select") {
    if (!onlyKeys(p, ["figure", "regions", "max_select"])) return ["payload_unknown_field"];
    const f = p.figure as Obj;
    if (!onlyKeys(f, ["kind", "rows", "cols", "source"]) || !["grid", "sectors", "image"].includes(String(f.kind))) return ["figure_invalid"];
    const regions = p.regions as Obj[];
    if (!Array.isArray(regions) || regions.length < 2 || regions.length > 48) return ["regions_invalid"];
    const ids: string[] = [];
    for (const r of regions) {
      if (!onlyKeys(r, ["id", "text", "box"]) || typeof r.id !== "string" || !/^[a-z][a-z0-9_]{0,23}$/.test(r.id) || ids.includes(r.id) ||
        typeof r.text !== "string" || r.text.trim().length < 1 || r.text.trim().length > 120) return ["regions_invalid"];
      ids.push(r.id);
    }
    const n = ids.length;
    if (f.kind === "grid" && (typeof f.rows !== "number" || typeof f.cols !== "number" || f.rows * f.cols !== n || f.rows < 1 || f.rows > 8 || f.cols < 1 || f.cols > 8)) err.add("figure_invalid");
    if (f.kind === "sectors" && n > 12) err.add("figure_invalid");
    if (f.kind !== "image" && ("source" in f || regions.some((r) => "box" in r))) err.add("figure_invalid");
    if (f.kind === "image") {
      if (f.source !== "question_media") err.add("figure_invalid");
      for (const r of regions) {
        const b = r.box;
        if (!Array.isArray(b) || b.length !== 4 || b.some((x) => typeof x !== "number" || x < 0 || x > 1) ||
          (b[0] as number) + (b[2] as number) > 1.000001 || (b[1] as number) + (b[3] as number) > 1.000001 || (b[2] as number) < 0.03 || (b[3] as number) < 0.03) err.add("region_box_invalid");
      }
    }
    if ("max_select" in p && (typeof p.max_select !== "number" || p.max_select < 1 || p.max_select > n)) err.add("max_select_invalid");
    if (onlyKeys(k, ["targets"]) && Array.isArray(k.targets)) {
      const t = k.targets as unknown[];
      if (new Set(t.filter((x) => typeof x === "string" && ids.includes(x))).size !== t.length) err.add("key_value_invalid");
      if (t.length < 1 || t.length >= n) err.add("selection_balance_invalid");
    } else if (onlyKeys(k, ["count"]) && typeof k.count === "number") {
      if (!Number.isInteger(k.count) || k.count < 1 || k.count > n - 1) err.add("key_value_invalid");
      if (f.kind === "image") err.add("key_invalid");
    } else return [...err, "key_invalid"].sort();
  } else {
    if (!onlyKeys(p, ["mode", "display", "step_minutes", "shown_time"])) return ["payload_unknown_field"];
    if (!["read", "set"].includes(String(p.mode)) || !["analog", "digital"].includes(String(p.display))) err.add("clock_invalid");
    if (![1, 5, 15, 30, 60].includes(p.step_minutes as number)) err.add("clock_invalid");
    const kt = parseClockTime(k.time);
    if (!onlyKeys(k, ["time", "accept_12h"]) || kt === null || ("accept_12h" in k && typeof k.accept_12h !== "boolean")) return [...err, "key_invalid"].sort();
    if (kt % ((p.step_minutes as number) || 1) !== 0) err.add("key_not_on_step");
    if (p.mode === "read" && (parseClockTime(p.shown_time) === null || p.shown_time !== k.time)) err.add("clock_invalid");
    if (p.mode === "set" && "shown_time" in p) err.add("clock_invalid");
  }
  return [...err].sort();
}

export function phase2bAnswerErrors(type: Phase2bInteractionType, p: Obj, a: Obj): string[] {
  if (type === "region_select") {
    if (!onlyKeys(a, ["type", "v", "selected"]) || !Array.isArray(a.selected)) return ["answer_invalid"];
    const ids = (p.regions as Obj[]).map((r) => String(r.id));
    if (a.selected.some((x) => typeof x !== "string" || !ids.includes(x))) return ["answer_unknown_id"];
    if (new Set(a.selected).size !== a.selected.length) return ["answer_value_invalid"];
    if (a.selected.length > ((p.max_select as number | undefined) ?? ids.length)) return ["answer_too_many"];
    return [];
  }
  if (!onlyKeys(a, ["type", "v", "time"])) return ["answer_unknown_field"];
  if ("time" in a) {
    const t = parseClockTime(a.time);
    if (t === null || t % ((p.step_minutes as number) || 1) !== 0) return ["answer_value_invalid"];
  }
  return [];
}

export function phase2bAnswerState(a: Phase2bAnswer | null | undefined): "unanswered" | "complete" {
  if (!a) return "unanswered";
  return a.type === "region_select" ? (a.selected.length ? "complete" : "unanswered") : (a.time ? "complete" : "unanswered");
}
