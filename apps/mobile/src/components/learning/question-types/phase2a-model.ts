/**
 * QT30–QT33 — çocuk düzenleme kuralları ve veli inceleme satırları (saf). Puan HESAPLAMAZ:
 * `gina.qt2_score` tek otoritedir; burada yalnız cevap düzenleme ve sunucunun yazdığı
 * `score_details` + veliye açık anahtarın okunuşu vardır.
 */
import type { Phase2aAnswerOf, Phase2aPayload } from "@gina/core";
import type { ItemMark, ReviewRow, ScoreDetails } from "./model";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export type Segment = { id?: string; text: string };
export const selectableIds = (segments: Segment[]) => segments.flatMap((s) => (s.id ? [s.id] : []));

/** Seçimi aç/kapa. Sınır doluysa yeni seçim reddedilir (refused=true); "hepsini seç" yoktur. */
export function toggleSelected(selected: string[], id: string, max: number): { next: string[]; refused: boolean } {
  if (selected.includes(id)) return { next: selected.filter((x) => x !== id), refused: false };
  if (selected.length >= max) return { next: selected, refused: true };
  return { next: [...selected, id], refused: false };
}
export const markTextMax = (p: Phase2aPayload<"mark_text">) => p.max_select ?? selectableIds(p.segments).length;
export const multiChoiceMax = (p: Phase2aPayload<"multi_choice">) => p.select_count ?? p.options.length;

/** Hata bulma: kelimeyi hatalı diye işaretle / işareti kaldır. */
export function toggleMark(a: Phase2aAnswerOf<"error_fix">, id: string): Phase2aAnswerOf<"error_fix"> {
  const marks = { ...a.marks };
  if (id in marks) delete marks[id];
  else marks[id] = {};
  return { ...a, marks };
}
/** Düzeltme metni; boş metin anahtarsız işarettir (doluluk: yarım). */
export function setFix(a: Phase2aAnswerOf<"error_fix">, id: string, text: string): Phase2aAnswerOf<"error_fix"> {
  if (!(id in a.marks)) return a;
  return { ...a, marks: { ...a.marks, [id]: text.length ? { text: text.slice(0, 120) } : {} } };
}
/** İki aşama: alanları değiştir; `null` alanı siler. */
export function setStage(a: Phase2aAnswerOf<"two_stage">, patch: { stage1?: string | null; stage2?: string | { text: string } | null }): Phase2aAnswerOf<"two_stage"> {
  const next: Phase2aAnswerOf<"two_stage"> = { type: "two_stage", v: 1 };
  const s1 = patch.stage1 === undefined ? a.stage1 : patch.stage1 ?? undefined;
  let s2 = patch.stage2 === undefined ? a.stage2 : patch.stage2 ?? undefined;
  if (s2 && typeof s2 === "object" && s2.text.length === 0) s2 = undefined;
  if (s1 !== undefined) next.stage1 = s1;
  if (s2 !== undefined) next.stage2 = typeof s2 === "object" ? { text: s2.text.slice(0, 2000) } : s2;
  return next;
}

// ---------------------------------------------------------------------------------------------
export interface Phase2aLabels {
  selected: string;
  notSelected: string;
  shouldSelect: string;
  shouldNotSelect: string;
  marked: (fix: string | null) => string;
  notMarked: string;
  notAnError: string;
  stage1: string;
  stage2: string;
}
export interface Phase2aSummary {
  key: "selection" | "errors";
  values: Record<string, number>;
}

/** Seçim türleri: yalnız seçilen ya da hedef olan öğeler satır olur (uzun metinde gürültü olmasın). */
export function selectionRows(items: { id: string; text: string }[], selected: string[], targets: string[] | null, all: boolean, l: Phase2aLabels): ReviewRow[] {
  return items.filter((i) => all || selected.includes(i.id) || targets?.includes(i.id)).map((i) => {
    const sel = selected.includes(i.id);
    const target = targets ? targets.includes(i.id) : null;
    const mark: ItemMark = target === null ? (sel ? "unknown" : "blank") : sel && target ? "correct" : sel ? "incorrect" : target ? "blank" : "unknown";
    return { id: i.id, prompt: i.text, given: sel ? l.selected : l.notSelected, expected: target === null ? null : target ? l.shouldSelect : l.shouldNotSelect, mark };
  });
}

export function phase2aReviewRows(type: string, payload: unknown, answer: unknown, details: ScoreDetails | null, key: unknown, l: Phase2aLabels): ReviewRow[] {
  const p = isObj(payload) ? payload : {};
  const a = isObj(answer) && answer.type === type ? answer : null;
  const k = isObj(key) ? key : null;
  const items = isObj(details?.items) ? details!.items! : {};
  switch (type) {
    case "mark_text": {
      const segs = ((p.segments as Segment[]) ?? []).filter((s): s is { id: string; text: string } => !!s.id);
      return selectionRows(segs, strings(a?.selected), k ? strings(k.targets) : null, false, l);
    }
    case "multi_choice":
      return selectionRows((p.options as { id: string; text: string }[]) ?? [], strings(a?.selected), k ? strings(k.correct) : null, true, l);
    case "error_fix": {
      const segs = ((p.segments as Segment[]) ?? []).filter((s): s is { id: string; text: string } => !!s.id);
      const marks = isObj(a?.marks) ? (a!.marks as Record<string, { text?: string }>) : {};
      const errors = k && isObj(k.errors) ? (k.errors as Record<string, { accepted?: unknown }>) : null;
      const pending = details?.outcome === "pending_human";
      return segs.filter((s) => s.id in marks || (errors && s.id in errors)).map((s) => {
        const marked = s.id in marks;
        const fix = marks[s.id]?.text?.trim() ? marks[s.id]!.text! : null;
        const item = isObj(items[s.id]) ? (items[s.id] as Obj) : null;
        const isError = errors ? s.id in errors : item ? item.error === true : null;
        let mark: ItemMark;
        if (!marked) mark = isError ? "blank" : "unknown";
        else if (isError === false) mark = "incorrect";
        else if (item?.fixed === true) mark = "correct";
        else if (fix && pending) mark = "review";
        else if (isError) mark = "incorrect";
        else mark = "unknown";
        const expected = errors ? (s.id in errors ? strings(errors[s.id]?.accepted).join(" / ") : l.notAnError) : null;
        return { id: s.id, prompt: s.text, given: marked ? l.marked(fix) : l.notMarked, expected, mark };
      });
    }
    case "two_stage": {
      const s1 = (p.stage1 ?? {}) as { prompt?: string; options?: { id: string; text: string }[] };
      const s2 = (p.stage2 ?? {}) as { prompt?: string; mode?: string; options?: { id: string; text: string }[] };
      const text = (list: { id: string; text: string }[] | undefined, id: unknown) => (typeof id === "string" ? list?.find((o) => o.id === id)?.text ?? null : null);
      const stageMark = (name: string, answered: boolean): ItemMark => {
        const it = isObj(items[name]) ? (items[name] as Obj) : null;
        if (!answered) return "blank";
        if (!it) return "unknown";
        return it.correct === true ? "correct" : it.correct === false ? "incorrect" : "review";
      };
      const g2 = a?.stage2;
      const given2 = typeof g2 === "string" ? text(s2.options, g2) : isObj(g2) && typeof g2.text === "string" && g2.text.trim() ? g2.text : null;
      return [
        { id: "stage1", prompt: `${l.stage1}: ${s1.prompt ?? ""}`, given: text(s1.options, a?.stage1), expected: k ? text(s1.options, k.stage1) : null, mark: stageMark("stage1", typeof a?.stage1 === "string") },
        { id: "stage2", prompt: `${l.stage2}: ${s2.prompt ?? ""}`, given: given2, expected: k && s2.mode === "choice" ? text(s2.options, k.stage2) : null, mark: stageMark("stage2", given2 !== null) },
      ];
    }
  }
  return [];
}

/** Sunucunun sayım özeti (seçim türleri: doğru/fazla; hata: bulunan/düzeltilen/yanlış işaret/eşleşmeyen). */
export function phase2aSummary(type: string, details: ScoreDetails | null): Phase2aSummary | null {
  const it = details?.items;
  if (!isObj(it)) return null;
  const num = (k: string) => (typeof it[k] === "number" ? (it[k] as number) : null);
  if ((type === "mark_text" || type === "multi_choice") && num("targets") !== null) {
    return { key: "selection", values: { tp: num("true_positive") ?? 0, fp: num("false_positive") ?? 0, targets: num("targets") ?? 0 } };
  }
  if (type === "error_fix" && num("errors") !== null) {
    return { key: "errors", values: { found: num("found") ?? 0, fixed: num("fixed") ?? 0, errors: num("errors") ?? 0, falseMarks: num("false_marks") ?? 0, unmatched: num("unmatched_fixes") ?? 0 } };
  }
  return null;
}
