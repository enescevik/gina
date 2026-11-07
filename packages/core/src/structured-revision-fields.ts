import { buildStructuredContent, type AuthorRow, type StructuredDraft } from "./question-authoring";
import { buildPhase2Content, isPhase2AuthorType, type Phase2Draft } from "./question-authoring-p2";
import { isStructuredType } from "./question-types";

type Row = AuthorRow;
type Form = StructuredDraft | Phase2Draft;
type Content = ReturnType<typeof buildStructuredContent>;

export function buildRevisionFields(form: Form): Content {
  return isStructuredType(form.type) ? buildStructuredContent(form as StructuredDraft) : buildPhase2Content(form as Phase2Draft);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => JSON.stringify(key) + ":" + canonical(child)).join(",") + "}";
  }
  return JSON.stringify(value);
}

// Only expose an interactive editor when it can faithfully represent the saved format.
// Older or externally produced variants can still be revised without altering their answer rules.
export function loadRevisionFields(type: string, payload: Record<string, unknown>, key: Record<string, unknown>): Form | null {
  const { stimulus: _stimulus, ...p } = payload;
  try {
    const form = toForm(type, p, key);
    if (!form) return null;
    const rebuilt = buildRevisionFields(form);
    return canonical(rebuilt.payload) === canonical(p) && canonical(rebuilt.answer_key) === canonical(key) ? form : null;
  } catch {
    return null;
  }
}

function toForm(type: string, p: Record<string, unknown>, k: Record<string, unknown>): Form | null {
  if (!isStructuredType(type) && !isPhase2AuthorType(type)) return null;
  // Existing identifiers can be arbitrary. The authoring models use a short numeric suffix for additions.
  const ids = JSON.stringify(p).match(/"id":"[a-z][a-z0-9_]*"/g) ?? [];
  const seq = Math.max(100, ...ids.map(id => Number(id.match(/\d+(?=")/)?.[0] ?? 0)).filter(n => n < 1000000));
  const s = (value: unknown) => value == null ? "" : String(value);
  switch (type) {
    case "true_false":
      return { type, seq, statements: (p.statements as Row[]).map(r => ({ ...r, answer: (k.answers as Record<string, boolean>)[r.id] ?? null })) };
    case "matching":
      return { type, seq, left: p.left as Row[], right: p.right as Row[], policy: p.policy as "one_to_one" | "many_to_one", pairs: k.pairs as Record<string, string> };
    case "numeric":
      return { type, seq, units: p.units as Row[], unitRequired: p.unit_required === true, workArea: p.work_area === true,
        unit: typeof k.unit === "string" ? k.unit : null, value: s(k.value), absTolerance: s(k.abs_tolerance),
        relTolerancePct: typeof k.rel_tolerance === "number" ? s(k.rel_tolerance * 100) : "",
        unitWeightPct: typeof k.unit_weight === "number" ? s(k.unit_weight * 100) : "", processRequired: k.process_required === true,
        factors: Object.fromEntries(Object.entries(k.unit_factors ?? {}).map(([id, value]) => [id, s(value)])) };
    case "ordering": {
      const orders = k.orders as string[][];
      const items = p.items as Row[];
      return { type, seq, mode: p.mode as "sequence" | "sentence", items: orders[0]!.map(id => items.find(r => r.id === id)!), alternatives: orders.slice(1) };
    }
    case "classification":
      return { type, seq, items: (p.items as Row[]).map(r => ({ ...r, category: (k.membership as Record<string,string>)[r.id] ?? null })),
        categories: (p.categories as (Row & { capacity?: number })[]).map(r => ({ ...r, capacity: s(r.capacity) })) };
    case "fill_blank": {
      const bank = (p.bank ?? []) as Row[];
      const selected = new Set<string>();
      const blanks: { id: string; raw: string }[] = [];
      const markup = (p.segments as ({ type: "text"; text: string } | { type: "blank"; id: string })[]).map(segment => {
        if (segment.type === "text") return segment.text;
        const answer = (k.blanks as Record<string, { accepted?: string[]; tokens?: string[] }>)[segment.id];
        for (const id of answer?.tokens ?? []) selected.add(id);
        const raw = (answer?.accepted ?? answer?.tokens?.map(id => bank.find(r => r.id === id)?.text ?? "") ?? []).join("|");
        blanks.push({ id: segment.id, raw });
        return `[[${raw}]]`;
      }).join("");
      return { type, seq, markup, blanks, input: p.input as "bank" | "keyboard", distractors: bank.filter(r => !selected.has(r.id)),
        bankReuse: p.bank_reuse === true, caseInsensitive: k.case_insensitive === true };
    }
    case "mark_text":
    case "error_fix": {
      const segments = p.segments as { id?: string; text: string }[];
      const common = { seq, unit: p.unit as "word" | "sentence", passage: segments.map(r => r.text).join(""),
        tokens: segments.flatMap(r => r.id ? [{ id: r.id, text: r.text }] : []) };
      return type === "mark_text" ? { type, ...common, targets: k.targets as string[], maxSelect: s(p.max_select) }
        : { type, ...common, caseInsensitive: k.case_insensitive === true, reviewUnmatched: k.fix_policy === "review_unmatched",
          errors: Object.fromEntries(Object.entries(k.errors as Record<string, { accepted: string[] }>).map(([id, item]) => [id, item.accepted.join("|")])) };
    }
    case "multi_choice":
      return { type, seq, options: p.options as Row[], correct: k.correct as string[], tellCount: p.select_count !== undefined };
    case "two_stage": {
      const a = p.stage1 as { prompt: string; options: Row[] };
      const b = p.stage2 as { prompt: string; options?: Row[]; mode: "choice" | "text" };
      return { type, seq, prompt1: a.prompt, options1: a.options, correct1: s(k.stage1),
        prompt2: b.prompt, options2: b.options ?? [], mode2: b.mode, correct2: typeof k.stage2 === "string" ? k.stage2 : null };
    }
    case "clock":
      return { type, seq, mode: p.mode as "read" | "set", display: p.display as "analog" | "digital",
        step: p.step_minutes as 1 | 5 | 15 | 30 | 60, time: s(k.time), accept12h: k.accept_12h === true };
    case "region_select": {
      const figure = p.figure as { kind: "grid" | "sectors" | "image"; rows?: number; cols?: number };
      return { type, seq, figure: figure.kind, rows: figure.rows ?? 2, cols: figure.cols ?? 4, sectors: (p.regions as Row[]).length,
        boxes: figure.kind === "image" ? p.regions as (Row & { box: [number, number, number, number] })[] : [], maxSelect: s(p.max_select), keyMode: k.count === undefined ? "targets" : "count", targets: (k.targets ?? []) as string[], count: s(k.count) };
    }
  }
}
