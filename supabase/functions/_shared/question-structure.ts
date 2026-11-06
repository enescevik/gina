// QT-AI — Deno tarafı yapılandırılmış soru içerik/anahtar doğrulaması.
// `packages/core/src/question-types/authoring.ts` (questionContentErrors) ve `number.ts` (parseNumberInput)
// ile BİREBİR aynı kural ve hata kodları (SQL `gina.qt_question_errors` aynası). Edge, core modülünü doğrudan
// içe aktaramıyor (uzantısız göreli import + zod); bu yüzden kopya tutulur ve parite
// `question-structure.test.ts` ile core `fixtures.json` üzerinden kanıtlanır. Değiştirirken iki tarafı birlikte güncelleyin.
// Faz 2A/2B (QT-AI v10): `phase2a.ts` phase2aContentErrors, `phase2b.ts` phase2bContentErrors + stimulusErrors da kopyalanır.
// Sunucu (SQL) her zaman son karardır.

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


/** AI üretiminin bildiği türler. Faz 3 (crossword) ve diğerleri Edge'de açıkça `type_unknown`. */
export const PHASE1_TYPES = ["true_false", "fill_blank", "matching", "numeric", "ordering", "classification"] as const;
export const PHASE2A_TYPES = ["mark_text", "error_fix", "multi_choice", "two_stage"] as const;
export const PHASE2B_TYPES = ["region_select", "clock"] as const;
const PHASE2A: readonly string[] = PHASE2A_TYPES, PHASE2B: readonly string[] = PHASE2B_TYPES, PHASE1: readonly string[] = PHASE1_TYPES;

export function questionContentErrors(type: string, payload: unknown, key: unknown, schemaVersion = 1): string[] {
  if (schemaVersion !== 1) return ["schema_version_unsupported"];
  if (!PHASE1.includes(type) && !PHASE2A.includes(type) && !PHASE2B.includes(type)) return ["type_unknown"];
  // Uyaran (stimulus) her yapılandırılmış türde isteğe bağlı; önce kendisi, sonra kalan payload doğrulanır (core/SQL sırası).
  if (isObj(payload) && "stimulus" in payload) {
    const se = stimulusErrors(payload.stimulus);
    if (se.length) return se;
    if (JSON.stringify(payload).length > 16000) return ["payload_invalid"];
    const { stimulus: _s, ...rest } = payload;
    payload = rest;
  }
  if (PHASE2A.includes(type)) return phase2aContentErrors(type, payload, key);
  if (PHASE2B.includes(type)) return phase2bContentErrors(type, payload, key);
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

/** Kontrollü sayı; SQL qt_parse_number ile aynı (core number.ts kopyası). */
export function parseNumberInput(input: string): number | null {
  let s = input.normalize("NFC").trim().replace(/−/g, "-");
  if (!s || s.length > 40) return null;
  let neg = false;
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1).trim();
  }
  let d: number | null = null;
  let m: RegExpMatchArray | null;
  if (/^[0-9]+$/.test(s)) d = Number(s);
  else if (/^[0-9]{1,3}(\.[0-9]{3})+(,[0-9]+)?$/.test(s)) d = Number(s.replace(/\./g, "").replace(",", "."));
  else if (/^[0-9]+[.,][0-9]+$/.test(s)) d = Number(s.replace(",", "."));
  else if ((m = s.match(/^([0-9]+)\/([0-9]+)$/))) d = Number(m[2]) === 0 ? null : Number(m[1]) / Number(m[2]);
  else if ((m = s.match(/^([0-9]+) ([0-9]+)\/([0-9]+)$/))) {
    const [w, n, den] = [Number(m[1]), Number(m[2]), Number(m[3])];
    d = den === 0 || n >= den ? null : w + n / den;
  }
  if (d === null || !Number.isFinite(d)) return null;
  return neg ? -d : d;
}


// ---------------------------------------------------------------------------------------------------------------
// Faz 2A (core phase2a.ts kopyası)
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
function entryIds2a(arr: unknown, max: number, maxText: number): string[] | null {
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

function phase2aContentErrors(type: string, p: unknown, k: unknown): string[] {
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
    const ids = entryIds2a(p.options, 8, 500);
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
    const ids1 = entryIds2a(s1.options, 6, 300);
    if (!ids1 || ids1.length < 2) return ["stage_invalid"];
    if (!onlyKeys(s2, ["prompt", "mode", "options"]) || typeof s2.prompt !== "string" || s2.prompt.trim().length < 1 || s2.prompt.trim().length > 1000 ||
      (s2.mode !== "choice" && s2.mode !== "text")) return ["stage_invalid"];
    let ids2: string[] = [];
    if (s2.mode === "choice") {
      const r = entryIds2a(s2.options, 6, 300);
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


// ---------------------------------------------------------------------------------------------------------------
// Faz 2B (core phase2b.ts kopyası)
export const parseClockTime = (t: unknown): number | null =>
  typeof t === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null;
/** Core `stimulusErrors` (phase2b.ts; zod `stimulusSchema`) ve SQL gina.qt_stimulus_errors ile aynı kodlar, zod'suz. */
const strMax = (v: unknown, min: number, max: number) => typeof v === "string" && v.length >= min && v.length <= max;
const optStr = (o: Obj, k: string, max: number) => !(k in o) || strMax(o[k], 0, max);
function stimulusShapeOk(s: Obj): boolean {
  if (s.kind === "table") {
    if (!onlyKeys(s, ["kind", "caption", "alt", "columns", "rows"]) || !optStr(s, "caption", 200) || !strMax(s.alt, 5, 1000)) return false;
    if (!Array.isArray(s.columns) || s.columns.length < 1 || s.columns.length > 6 || s.columns.some((c) => !strMax(c, 1, 60))) return false;
    return Array.isArray(s.rows) && s.rows.length >= 1 && s.rows.length <= 12 &&
      s.rows.every((r) => Array.isArray(r) && r.every((c) => strMax(c, 0, 80) || (typeof c === "number" && Number.isFinite(c))));
  }
  if (s.kind === "bar_chart") {
    if (!onlyKeys(s, ["kind", "caption", "alt", "x_label", "y_label", "unit", "bars"]) || !optStr(s, "caption", 200) || !strMax(s.alt, 5, 1000) ||
      !optStr(s, "x_label", 40) || !optStr(s, "y_label", 40) || !optStr(s, "unit", 40)) return false;
    return Array.isArray(s.bars) && s.bars.length >= 2 && s.bars.length <= 10 &&
      s.bars.every((b) => onlyKeys(b, ["label", "value"]) && strMax((b as Obj).label, 1, 40) && typeof (b as Obj).value === "number" &&
        Number.isFinite((b as Obj).value) && ((b as Obj).value as number) >= 0 && ((b as Obj).value as number) <= 100000);
  }
  return false;
}
export function stimulusErrors(s: unknown): string[] {
  if (s === undefined || s === null) return [];
  if (!isObj(s) || JSON.stringify(s).length > 8000) return ["stimulus_invalid"];
  if (typeof s.alt !== "string" || s.alt.trim().length < 5 || s.alt.trim().length > 1000 || ("caption" in s && (typeof s.caption !== "string" || s.caption.length > 200))) {
    return ["stimulus_alt_invalid"];
  }
  if (!stimulusShapeOk(s)) return ["stimulus_invalid"];
  if (s.kind === "table" && (s.rows as unknown[][]).some((row) => row.length !== (s.columns as unknown[]).length)) return ["stimulus_invalid"];
  return [];
}
function phase2bContentErrors(type: string, p: unknown, k: unknown): string[] {
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

