/**
 * QT30–QT33 (Faz 2A), QT41/QT42 (Faz 2B) — veli hazırlama formu modeli (saf).
 * Aynı ilkeler (question-authoring.ts): kimlikler sayaçtan, ekran sırasına bağlı değil; doğrulama sunucuyla
 * aynı kodları döndüren `questionContentErrors`; yalnız formda yakalanan birkaç açık durum ek kodla.
 * Bu türler sunucuda yayına kadar `enabled=false`; istemcide ayrı faz anahtarlarının arkasındadır.
 */
import {
  PHASE2A_INTERACTION_TYPES,
  PHASE2B_INTERACTION_TYPES,
  type Phase2aInteractionType,
  type Phase2bInteractionType,
  PRACTICE_ONLY_TYPES,
  questionContentErrors,
  type Stimulus,
} from "./question-types";

export type Phase2InteractionType = Phase2aInteractionType | Phase2bInteractionType;
export const PHASE2_INTERACTION_TYPES: readonly Phase2InteractionType[] = [...PHASE2A_INTERACTION_TYPES, ...PHASE2B_INTERACTION_TYPES];
export const isPhase2AuthorType = (t: unknown): t is Phase2InteractionType =>
  typeof t === "string" && (PHASE2_INTERACTION_TYPES as readonly string[]).includes(t);

/** Alıştırma türleri (OYSS/meb_common izinde engelli): 1A/1B listesi + bütün 2A/2B türleri (SQL practice_only=true). */
export const AUTHOR_PRACTICE_ONLY_TYPES: ReadonlySet<string> = new Set<string>([...PRACTICE_ONLY_TYPES, ...PHASE2_INTERACTION_TYPES]);

type Row = { id: string; text: string };
export interface Token { id: string; text: string }

export interface MarkTextDraft { type: "mark_text"; unit: "word" | "sentence"; passage: string; tokens: Token[]; targets: string[]; maxSelect: string }
export interface ErrorFixDraft {
  type: "error_fix"; unit: "word" | "sentence"; passage: string; tokens: Token[];
  /** token id → kabul edilen düzeltmeler ("doğru|Doğru"). */
  errors: Record<string, string>;
  caseInsensitive: boolean; reviewUnmatched: boolean;
}
export interface MultiChoiceDraft { type: "multi_choice"; options: Row[]; correct: string[]; tellCount: boolean }
export interface TwoStageDraft {
  type: "two_stage";
  prompt1: string; options1: Row[]; correct1: string | null;
  prompt2: string; mode2: "choice" | "text"; options2: Row[]; correct2: string | null;
}
export interface RegionDraft {
  type: "region_select";
  figure: "grid" | "sectors" | "image";
  rows: number; cols: number; sectors: number;
  /** Görsel bölgeleri (0–1 normalize kutu). Izgara/dilim bölgeleri şekilden türetilir. */
  boxes: (Row & { box: [number, number, number, number] })[];
  keyMode: "targets" | "count";
  targets: string[]; count: string; maxSelect: string;
}
export interface ClockDraft { type: "clock"; mode: "read" | "set"; display: "analog" | "digital"; step: 1 | 5 | 15 | 30 | 60; time: string; accept12h: boolean }
export type Phase2DraftBody = MarkTextDraft | ErrorFixDraft | MultiChoiceDraft | TwoStageDraft | RegionDraft | ClockDraft;
export type Phase2Draft = Phase2DraftBody & { seq: number };

export function newPhase2Draft(type: Phase2InteractionType): Phase2Draft {
  switch (type) {
    case "mark_text": return { type, seq: 0, unit: "word", passage: "", tokens: [], targets: [], maxSelect: "" };
    case "error_fix": return { type, seq: 0, unit: "word", passage: "", tokens: [], errors: {}, caseInsensitive: false, reviewUnmatched: true };
    case "multi_choice": return { type, seq: 4, options: [1, 2, 3, 4].map((n) => ({ id: `o${n}`, text: "" })), correct: [], tellCount: true };
    case "two_stage": return {
      type, seq: 4, prompt1: "", options1: [{ id: "a1", text: "" }, { id: "a2", text: "" }], correct1: null,
      prompt2: "", mode2: "choice", options2: [{ id: "g3", text: "" }, { id: "g4", text: "" }], correct2: null,
    };
    case "region_select": return { type, seq: 0, figure: "grid", rows: 2, cols: 4, sectors: 4, boxes: [], keyMode: "targets", targets: [], count: "", maxSelect: "" };
    case "clock": return { type, seq: 0, mode: "read", display: "analog", step: 5, time: "", accept12h: true };
  }
}

// ---------------------------------------------------------------------------------------------
// Metin parçalama: kelime ya da cümle birimleri kimlikli; aradaki boşluk/noktalama kimliksiz düz parça.
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu;
const SENTENCE = /[^.!?…\s][^.!?…]*[.!?…]*/gu;
export function splitPassage(passage: string, unit: "word" | "sentence"): { text: string; unit: boolean }[] {
  const re = unit === "word" ? WORD : SENTENCE;
  const out: { text: string; unit: boolean }[] = [];
  let last = 0;
  for (const m of passage.matchAll(re)) {
    const text = unit === "sentence" ? m[0].trimEnd() : m[0];
    if (m.index! > last) out.push({ text: passage.slice(last, m.index), unit: false });
    out.push({ text, unit: true });
    last = m.index! + text.length;
  }
  if (last < passage.length) out.push({ text: passage.slice(last), unit: false });
  return out;
}
/** Yeniden parçalamada kimlik koruma: aynı metnin k'ıncı geçişi aynı kimliği alır; yeni parça yeni kimlik. */
export function reconcileTokens<D extends { seq: number; tokens: Token[]; passage: string; unit: "word" | "sentence" }>(draft: D, passage: string, unit = draft.unit): D {
  const parts = splitPassage(passage, unit).filter((p) => p.unit);
  const prev = unit === draft.unit ? draft.tokens : [];
  const seen = new Map<string, number>();
  let seq = draft.seq;
  const tokens = parts.map((p) => {
    const k = seen.get(p.text) ?? 0;
    seen.set(p.text, k + 1);
    const match = prev.filter((t) => t.text === p.text)[k];
    if (match) return { id: match.id, text: p.text };
    seq += 1;
    return { id: `${unit === "word" ? "k" : "c"}${seq}`, text: p.text };
  });
  return { ...draft, passage, unit, tokens, seq };
}
function segmentsOf(d: { passage: string; unit: "word" | "sentence"; tokens: Token[] }) {
  let i = 0;
  return splitPassage(d.passage, d.unit).map((p) => (p.unit ? { id: d.tokens[i++]?.id ?? `x${i}`, text: p.text } : { text: p.text }));
}
const trimRows = (rows: Row[]) => rows.map((r) => ({ id: r.id, text: r.text.trim() }));
const optInt = (s: string) => (s.trim() ? (/^\d+$/.test(s.trim()) ? Number(s.trim()) : Number.NaN) : undefined);
const LETTERS = "ABCDEFGH";
/** Izgara hücresi / dilim bölgeleri: kararlı kimlik konumdan (satır/sütun), etiket okunur. */
export function shapeRegions(d: Pick<RegionDraft, "figure" | "rows" | "cols" | "sectors">): Row[] {
  if (d.figure === "grid") {
    const out: Row[] = [];
    for (let r = 0; r < d.rows; r++) for (let c = 0; c < d.cols; c++) out.push({ id: `g${r + 1}_${c + 1}`, text: `${LETTERS[r] ?? r + 1}${c + 1}` });
    return out;
  }
  if (d.figure === "sectors") return Array.from({ length: d.sectors }, (_, i) => ({ id: `d${i + 1}`, text: String(i + 1) }));
  return [];
}
export function regionList(d: RegionDraft): Row[] {
  return d.figure === "image" ? d.boxes.map((b) => ({ id: b.id, text: b.text })) : shapeRegions(d);
}
/** Görsele dokunulan noktada yeni kutu (merkez = dokunma, kenar = size); 0–1 sınırına kırpılır. */
export function addImageBox(d: RegionDraft & { seq: number }, x: number, y: number, size = 0.2): RegionDraft & { seq: number } {
  const seq = d.seq + 1;
  const w = Math.min(1, Math.max(0.03, size));
  const bx = Math.min(1 - w, Math.max(0, x - w / 2)), by = Math.min(1 - w, Math.max(0, y - w / 2));
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return { ...d, seq, boxes: [...d.boxes, { id: `b${seq}`, text: String(d.boxes.length + 1), box: [r(bx), r(by), r(w), r(w)] }] };
}
export function resizeImageBox<D extends RegionDraft>(d: D, id: string, size: number): D {
  return {
    ...d,
    boxes: d.boxes.map((b) => {
      if (b.id !== id) return b;
      const cx = b.box[0] + b.box[2] / 2, cy = b.box[1] + b.box[3] / 2, w = Math.min(1, Math.max(0.03, size));
      const r = (n: number) => Math.round(n * 1000) / 1000;
      return { ...b, box: [r(Math.min(1 - w, Math.max(0, cx - w / 2))), r(Math.min(1 - w, Math.max(0, cy - w / 2))), r(w), r(w)] as [number, number, number, number] };
    }),
  };
}

export function buildPhase2Content(d: Phase2Draft): { payload: Record<string, unknown>; answer_key: Record<string, unknown> } {
  switch (d.type) {
    case "mark_text": {
      const max = optInt(d.maxSelect);
      const ids = new Set(d.tokens.map((t) => t.id));
      return { payload: { unit: d.unit, segments: segmentsOf(d), ...(max !== undefined ? { max_select: max } : {}) }, answer_key: { targets: d.targets.filter((x) => ids.has(x)) } };
    }
    case "error_fix": {
      const ids = new Set(d.tokens.map((t) => t.id));
      const errors = Object.fromEntries(Object.entries(d.errors).filter(([id]) => ids.has(id))
        .map(([id, acc]) => [id, { accepted: acc.split("|").map((s) => s.normalize("NFC").trim()).filter(Boolean) }]));
      return {
        payload: { unit: d.unit, segments: segmentsOf(d) },
        answer_key: { errors, fix_policy: d.reviewUnmatched ? "review_unmatched" : "closed", ...(d.caseInsensitive ? { case_insensitive: true } : {}) },
      };
    }
    case "multi_choice":
      return { payload: { options: trimRows(d.options), ...(d.tellCount ? { select_count: d.correct.length } : {}) }, answer_key: { correct: d.options.map((o) => o.id).filter((x) => d.correct.includes(x)) } };
    case "two_stage":
      return {
        payload: {
          stage1: { prompt: d.prompt1.trim(), options: trimRows(d.options1) },
          stage2: { prompt: d.prompt2.trim(), mode: d.mode2, ...(d.mode2 === "choice" ? { options: trimRows(d.options2) } : {}) },
        },
        answer_key: { stage1: d.correct1 ?? "", ...(d.mode2 === "choice" ? { stage2: d.correct2 ?? "" } : {}) },
      };
    case "region_select": {
      const regions = d.figure === "image" ? d.boxes.map((b) => ({ id: b.id, text: b.text.trim(), box: b.box })) : shapeRegions(d);
      const max = optInt(d.maxSelect);
      const figure = d.figure === "grid" ? { kind: "grid", rows: d.rows, cols: d.cols } : d.figure === "sectors" ? { kind: "sectors" } : { kind: "image", source: "question_media" };
      const ids = new Set(regions.map((r) => r.id));
      return {
        payload: { figure, regions, ...(max !== undefined ? { max_select: max } : {}) },
        answer_key: d.keyMode === "count" && d.figure !== "image"
          ? { count: optInt(d.count) ?? 0 }
          : { targets: regions.map((r) => r.id).filter((x) => d.targets.includes(x) && ids.has(x)) },
      };
    }
    case "clock": {
      const time = normalizeTime(d.time) ?? d.time.trim();
      return {
        payload: { mode: d.mode, display: d.display, step_minutes: d.step, ...(d.mode === "read" ? { shown_time: time } : {}) },
        answer_key: { time, ...(d.accept12h ? { accept_12h: true } : {}) },
      };
    }
  }
}
/** "8:30" / "08.30" / "8 30" → "08:30"; geçersiz → null. */
export function normalizeTime(s: string): string | null {
  const m = /^\s*(\d{1,2})\s*[:.\s]\s*(\d{2})\s*$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h <= 23 && min <= 59 ? `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` : null;
}

/**
 * 1–4. sınıfta çocuk saati 1–12 saat adımlayıcılarıyla girer; bu yüzden 12 saatlik okuma kabulü zorunludur
 * (`accept_12h` her zaman true). 5. sınıf ve üstünde veli seçer.
 */
export const clockRequires12h = (grade: number | null | undefined): boolean => typeof grade === "number" && grade >= 1 && grade <= 4;

export function phase2DraftErrors(d: Phase2Draft, opts: { hasImage?: boolean; stimulus?: Stimulus | null; grade?: number | null } = {}): string[] {
  const { payload, answer_key } = buildPhase2Content(d);
  const errs = new Set(questionContentErrors(d.type, opts.stimulus ? { ...payload, stimulus: opts.stimulus } : payload, answer_key));
  if (d.type === "clock" && clockRequires12h(opts.grade) && !d.accept12h) errs.add("clock_12h_required");
  if (d.type === "multi_choice" || d.type === "two_stage") {
    const rows = d.type === "multi_choice" ? d.options : [...d.options1, ...(d.mode2 === "choice" ? d.options2 : [])];
    if (rows.some((r) => !r.text.trim())) errs.add("row_empty");
  }
  if (d.type === "region_select" && d.figure === "image") {
    if (!opts.hasImage) errs.add("region_image_required");
    if (d.boxes.some((b) => !b.text.trim())) errs.add("row_empty");
  }
  if (d.type === "clock" && d.time.trim() && !normalizeTime(d.time)) errs.add("key_invalid");
  if ((d.type === "mark_text" || d.type === "error_fix") && d.tokens.length < 2) errs.add("segments_invalid");
  return [...errs].sort();
}

// ---------------------------------------------------------------------------------------------
// Uyaran (tablo / çubuk grafik): bütün yapılandırılmış türlere eklenebilir; alternatif metin zorunlu.
export interface StimulusDraft {
  kind: "none" | "table" | "bar_chart";
  caption: string;
  alt: string;
  /** Tablo: ilk satır sütun başlıkları, her satır "a | b | c". Grafik: her satır "Etiket: değer". */
  text: string;
  unit: string;
}
export const newStimulusDraft = (): StimulusDraft => ({ kind: "none", caption: "", alt: "", text: "", unit: "" });
const num = (s: string) => (/^-?\d+([.,]\d+)?$/.test(s.trim()) ? Number(s.trim().replace(",", ".")) : null);
/** Taslak → sözleşme nesnesi (doğrulama `stimulusErrors`/`questionContentErrors`). Yok → null. */
export function buildStimulus(d: StimulusDraft): Stimulus | null {
  if (d.kind === "none") return null;
  const lines = d.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const caption = d.caption.trim() ? { caption: d.caption.trim() } : {};
  if (d.kind === "table") {
    const [head, ...rows] = lines.map((l) => l.split("|").map((c) => c.trim()));
    return {
      kind: "table", ...caption, alt: d.alt.trim(),
      columns: head ?? [],
      rows: rows.map((r) => r.map((c) => num(c) ?? c)),
    } as Stimulus;
  }
  return {
    kind: "bar_chart", ...caption, alt: d.alt.trim(), ...(d.unit.trim() ? { unit: d.unit.trim() } : {}),
    bars: lines.map((l) => {
      const at = l.lastIndexOf(":");
      return { label: (at > 0 ? l.slice(0, at) : l).trim(), value: at > 0 ? num(l.slice(at + 1)) ?? Number.NaN : Number.NaN };
    }),
  } as Stimulus;
}
/** Var olan uyaran → taslak (önizleme/düzenleme için). */
export function stimulusDraftOf(s: Stimulus | null | undefined): StimulusDraft {
  if (!s) return newStimulusDraft();
  if (s.kind === "table") return { kind: "table", caption: s.caption ?? "", alt: s.alt, unit: "", text: [s.columns.join(" | "), ...s.rows.map((r) => r.join(" | "))].join("\n") };
  return { kind: "bar_chart", caption: s.caption ?? "", alt: s.alt, unit: s.unit ?? "", text: s.bars.map((b) => `${b.label}: ${b.value}`).join("\n") };
}
