/**
 * Hazırlama (veli/editör/AI) içerik + anahtar doğrulaması. SQL `gina.qt_question_errors` ile aynı kodlar;
 * sunucu doğrulaması her zaman son karardır, bu fonksiyon formda anında geri bildirim içindir.
 */
import type { StructuredInteractionType } from "./index";
import { isPhase2aType, phase2aContentErrors } from "./phase2a";
import { isPhase2bType, phase2bContentErrors, stimulusErrors } from "./phase2b";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const validId = (t: unknown): t is string => typeof t === "string" && /^[a-z][a-z0-9_]{0,23}$/.test(t);
const onlyKeys = (o: unknown, allowed: string[]) => isObj(o) && Object.keys(o).every((k) => allowed.includes(k));
const trimLen = (s: string) => s.trim().length;

function entryIds(arr: unknown, maxCount: number, maxText: number, extra: string[] = []): string[] | null {
  if (!Array.isArray(arr) || arr.length > maxCount) return null;
  const out: string[] = [];
  for (const e of arr) {
    if (!isObj(e) || typeof e.id !== "string" || typeof e.text !== "string") return null;
    if (!onlyKeys(e, ["id", "text", ...extra])) return null;
    if (!validId(e.id) || out.includes(e.id) || trimLen(e.text) < 1 || trimLen(e.text) > maxText) return null;
    out.push(e.id);
  }
  return out;
}
function weightsOk(w: unknown, ids: string[]) {
  if (w === undefined || w === null) return true;
  if (!isObj(w)) return false;
  return Object.entries(w).every(([k, v]) => ids.includes(k) && typeof v === "number" && v > 0 && v <= 10);
}
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Kontrollü sayı; SQL qt_parse_number ile aynı (bkz. index.ts parseNumberInput). */
import { parseNumberInput } from "./number";

export function questionContentErrors(type: string, payload: unknown, key: unknown, schemaVersion = 1): string[] {
  if (schemaVersion !== 1) return ["schema_version_unsupported"];
  if (isObj(payload) && "stimulus" in payload) {
    const se = stimulusErrors(payload.stimulus);
    if (se.length) return se;
    if (JSON.stringify(payload).length > 16000) return ["payload_invalid"];
    const { stimulus: _s, ...rest } = payload;
    payload = rest;
  }
  if (isPhase2aType(type)) return phase2aContentErrors(type, payload, key);
  if (isPhase2bType(type)) return phase2bContentErrors(type, payload, key);
  if (type === "numeric" && isObj(payload)) {
    if (!onlyKeys(payload, ["units", "unit_required", "work_area"]) || (payload.work_area !== undefined && typeof payload.work_area !== "boolean")) {
      return ["payload_unknown_field"];
    }
    const { work_area: _w, ...rest } = payload;
    return contentErrors(type, rest, key);
  }
  return contentErrors(type, payload, key);
}

function contentErrors(type: string, p: unknown, k: unknown): string[] {
  const err = new Set<string>();
  const done = () => [...err].sort();
  if (!isObj(p) || JSON.stringify(p).length > 16000) return ["payload_invalid"];
  if (!isObj(k) || JSON.stringify(k).length > 16000) return ["key_invalid"];
  try {
    if (type === "true_false") {
      if (!onlyKeys(p, ["statements"])) return ["payload_unknown_field"];
      const ids = entryIds(p.statements, 10, 500);
      if (!ids) return ["statements_invalid"];
      if (ids.length < 1) err.add("statements_count");
      if (!onlyKeys(k, ["answers", "weights"]) || !isObj(k.answers)) return [...done(), "key_invalid"].sort();
      for (const [id, v] of Object.entries(k.answers)) {
        if (!ids.includes(id)) err.add("key_unknown_id");
        if (typeof v !== "boolean") err.add("key_value_invalid");
      }
      if (ids.some((i) => !(i in (k.answers as Obj)))) err.add("key_missing_id");
      if (!weightsOk(k.weights, ids)) err.add("weights_invalid");
    } else if (type === "fill_blank") {
      if (!onlyKeys(p, ["segments", "input", "bank", "bank_reuse"])) return ["payload_unknown_field"];
      if (p.input !== "bank" && p.input !== "keyboard") err.add("input_invalid");
      if (!Array.isArray(p.segments) || p.segments.length < 2 || p.segments.length > 40) return [...done(), "segments_invalid"].sort();
      const blanks: string[] = [];
      for (const s of p.segments) {
        if (isObj(s) && s.type === "text" && onlyKeys(s, ["type", "text"]) && typeof s.text === "string" && s.text.length >= 1 && s.text.length <= 1000) continue;
        if (isObj(s) && s.type === "blank" && onlyKeys(s, ["type", "id"]) && validId(s.id) && !blanks.includes(s.id)) {
          blanks.push(s.id);
          continue;
        }
        return [...done(), "segments_invalid"].sort();
      }
      if (blanks.length < 1 || blanks.length > 10) err.add("blanks_count");
      let bank: string[] | null = [];
      if (p.input === "bank") {
        bank = entryIds(p.bank, 16, 80);
        if (!bank || bank.length < 2) err.add("bank_invalid");
        if (p.bank_reuse !== undefined && typeof p.bank_reuse !== "boolean") err.add("bank_reuse_invalid");
      } else if ("bank" in p || "bank_reuse" in p) err.add("bank_not_allowed");
      if (!onlyKeys(k, ["blanks", "case_insensitive", "weights"]) || !isObj(k.blanks) || (k.case_insensitive !== undefined && typeof k.case_insensitive !== "boolean")) {
        return [...done(), "key_invalid"].sort();
      }
      for (const [id, v] of Object.entries(k.blanks)) {
        if (!blanks.includes(id)) {
          err.add("key_unknown_id");
          continue;
        }
        if (p.input === "bank") {
          if (!onlyKeys(v, ["tokens"]) || !Array.isArray((v as Obj).tokens) || ((v as Obj).tokens as unknown[]).length < 1 || ((v as Obj).tokens as unknown[]).length > 4 ||
            ((v as Obj).tokens as unknown[]).some((t) => typeof t !== "string" || !(bank ?? []).includes(t))) err.add("key_value_invalid");
        } else if (!onlyKeys(v, ["accepted"]) || !Array.isArray((v as Obj).accepted) || ((v as Obj).accepted as unknown[]).length < 1 || ((v as Obj).accepted as unknown[]).length > 8 ||
          ((v as Obj).accepted as unknown[]).some((t) => typeof t !== "string" || trimLen(t) < 1 || trimLen(t) > 120)) err.add("key_value_invalid");
      }
      if (blanks.some((b) => !(b in (k.blanks as Obj)))) err.add("key_missing_id");
      if (p.input === "bank" && !p.bank_reuse) {
        const firsts = new Set(blanks.map((b) => ((k.blanks as Obj)[b] as Obj | undefined)?.tokens).map((t) => (Array.isArray(t) ? t[0] : undefined)));
        if (firsts.size < blanks.length) err.add("bank_unsolvable");
      }
      if (!weightsOk(k.weights, blanks)) err.add("weights_invalid");
    } else if (type === "matching") {
      if (!onlyKeys(p, ["left", "right", "policy"])) return ["payload_unknown_field"];
      const left = entryIds(p.left, 8, 300);
      const right = entryIds(p.right, 10, 300);
      if (!left || !right || left.length < 2 || right.length < 2) return ["sides_invalid"];
      if (left.some((l) => right.includes(l))) err.add("duplicate_id");
      if (p.policy !== "one_to_one" && p.policy !== "many_to_one") err.add("policy_invalid");
      if (p.policy === "one_to_one" && right.length < left.length) err.add("right_too_few");
      if (!onlyKeys(k, ["pairs", "weights"]) || !isObj(k.pairs)) return [...done(), "key_invalid"].sort();
      for (const [id, v] of Object.entries(k.pairs)) {
        if (!left.includes(id)) err.add("key_unknown_id");
        else if (typeof v !== "string" || !right.includes(v)) err.add("key_value_invalid");
      }
      if (left.some((l) => !(l in (k.pairs as Obj)))) err.add("key_missing_id");
      const vals = Object.values(k.pairs).map(String);
      if (p.policy === "one_to_one" && new Set(vals).size !== vals.length) err.add("key_not_one_to_one");
      if (!weightsOk(k.weights, left)) err.add("weights_invalid");
    } else if (type === "numeric") {
      if (!onlyKeys(p, ["units", "unit_required"])) return ["payload_unknown_field"];
      const units = entryIds(p.units ?? [], 8, 20);
      if (!units) return ["units_invalid"];
      if (typeof p.unit_required !== "boolean") err.add("unit_required_invalid");
      if (p.unit_required === true && units.length === 0) err.add("units_missing");
      if (!onlyKeys(k, ["value", "unit", "unit_factors", "abs_tolerance", "rel_tolerance", "unit_weight", "process_required"])) return [...done(), "key_invalid"].sort();
      if (typeof k.value !== "string" || parseNumberInput(k.value) === null) err.add("key_value_invalid");
      for (const t of ["abs_tolerance", "rel_tolerance", "unit_weight"] as const) {
        if (t in k && (!isNum(k[t]) || (k[t] as number) < 0 || (t !== "abs_tolerance" && (k[t] as number) > 0.5))) err.add("tolerance_invalid");
      }
      if ("process_required" in k && typeof k.process_required !== "boolean") err.add("key_invalid");
      if (p.unit_required === true) {
        if (typeof k.unit !== "string" || !units.includes(k.unit)) err.add("key_unit_invalid");
        if ("unit_factors" in k) {
          if (!isObj(k.unit_factors)) err.add("unit_factors_invalid");
          else {
            for (const [u, f] of Object.entries(k.unit_factors)) if (!units.includes(u) || !isNum(f) || f <= 0) err.add("unit_factors_invalid");
            if ((k.unit_factors as Obj)[String(k.unit)] !== 1) err.add("unit_factors_invalid");
          }
        }
      } else if ("unit" in k || "unit_factors" in k || (isNum(k.unit_weight) && k.unit_weight > 0)) err.add("unit_not_required");
    } else if (type === "ordering") {
      if (!onlyKeys(p, ["items", "mode"])) return ["payload_unknown_field"];
      const items = entryIds(p.items, 10, 300);
      if (!items || items.length < 2) return ["items_invalid"];
      if (p.mode !== "sequence" && p.mode !== "sentence") err.add("mode_invalid");
      if (!onlyKeys(k, ["orders"]) || !Array.isArray(k.orders) || k.orders.length < 1 || k.orders.length > 5) return [...done(), "key_invalid"].sort();
      for (const o of k.orders) {
        if (!Array.isArray(o) || o.length !== items.length || new Set(o.filter((x) => typeof x === "string" && items.includes(x))).size !== items.length) err.add("order_invalid");
      }
      if (new Set(k.orders.map((o) => JSON.stringify(o))).size !== k.orders.length) err.add("order_duplicate");
    } else if (type === "classification") {
      if (!onlyKeys(p, ["items", "categories"])) return ["payload_unknown_field"];
      const items = entryIds(p.items, 16, 200);
      if (!Array.isArray(p.categories)) return ["categories_invalid"];
      const cats = entryIds(p.categories.map((c) => (isObj(c) ? Object.fromEntries(Object.entries(c).filter(([x]) => x !== "capacity")) : c)), 5, 80);
      if (!items || items.length < 2) return ["items_invalid"];
      if (!cats || cats.length < 2) return ["categories_invalid"];
      if (items.some((i) => cats.includes(i))) err.add("duplicate_id");
      for (const c of p.categories as Obj[]) {
        if (!onlyKeys(c, ["id", "text", "capacity"])) err.add("categories_invalid");
        if ("capacity" in c && (!isNum(c.capacity) || !Number.isInteger(c.capacity) || c.capacity < 1 || c.capacity > 16)) err.add("capacity_invalid");
      }
      if (!onlyKeys(k, ["membership", "weights"]) || !isObj(k.membership)) return [...done(), "key_invalid"].sort();
      const count: Record<string, number> = {};
      for (const [id, v] of Object.entries(k.membership)) {
        if (!items.includes(id)) err.add("key_unknown_id");
        else if (typeof v !== "string" || !cats.includes(v)) err.add("key_value_invalid");
        else count[v] = (count[v] ?? 0) + 1;
      }
      if (items.some((i) => !(i in (k.membership as Obj)))) err.add("key_missing_id");
      for (const c of p.categories as Obj[]) if (isNum(c.capacity) && (count[String(c.id)] ?? 0) > c.capacity) err.add("capacity_exceeded");
      if (!weightsOk(k.weights, items)) err.add("weights_invalid");
    } else return ["type_unknown"];
  } catch {
    return ["content_invalid"];
  }
  return done();
}

/** Yapılandırılmış soru yazım isteği (save_question_with_sources p_question). */
export interface StructuredQuestionInput {
  grade: number;
  subject: string;
  topic: string;
  difficulty: "kolay" | "orta" | "orta_ustu" | "zor";
  stem: string;
  interaction_type: StructuredInteractionType;
  schema_version: 1;
  payload: Record<string, unknown>;
  answer_key: Record<string, unknown>;
  points?: number;
  solution?: string;
  explanation?: string;
  term?: 1 | 2 | null;
  program?: string | null;
}

/** "Ankara [[başkent]] şehridir." → segment + anahtar taslağı (klavye girişli). Editör kolaylığı. */
export function fillBlankFromMarkup(markup: string): { segments: ({ type: "text"; text: string } | { type: "blank"; id: string })[]; accepted: Record<string, string[]> } {
  const segments: ({ type: "text"; text: string } | { type: "blank"; id: string })[] = [];
  const accepted: Record<string, string[]> = {};
  let n = 0;
  let last = 0;
  for (const m of markup.matchAll(/\[\[([^\]]+)\]\]/g)) {
    if (m.index! > last) segments.push({ type: "text", text: markup.slice(last, m.index) });
    const id = `b${++n}`;
    segments.push({ type: "blank", id });
    accepted[id] = m[1]!.split("|").map((s) => s.trim()).filter(Boolean);
    last = m.index! + m[0].length;
  }
  if (last < markup.length) segments.push({ type: "text", text: markup.slice(last) });
  return { segments, accepted };
}
