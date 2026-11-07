import { crosswordPayloadSchema, clueCells } from "./question-types";
/** Pure, escaped print layout shared by the mobile/web export path and tests. */
export interface BookletChoice {
  key: string;
  text: string;
}

export interface BookletQuestion {
  id: string;
  topic: string;
  kind: "multiple_choice" | "open_ended" | "structured";
  /** QT: yapılandırılmış soruda etkileşim türü + öğrenci içeriği (doğru cevap içermez). */
  interaction_type?: string | null;
  payload?: unknown;
  /** QT: özel anahtar (`get_question_answer_keys`). Yalnız cevap anahtarı nüshasında verilir. */
  answer_key?: unknown;
  difficulty: string;
  stem: string;
  choices: BookletChoice[] | null;
  correct_key: string | null;
  expected_answer: string | null;
  solution: string | null;
  images?: { dataUri: string; alt: string }[];
  context?: { group_id: string; title: string; body: string; prompt: string };
}

/** Arayüz metinleri çağıran ekrandan (i18n) gelir; kütüphane dilden bağımsızdır. */
export interface BookletLabels {
  answerKey: string;
  name: string;
  date: string;
  topics: string;
  questionCount: string;
  solution: string;
  expected: string;
  difficulty: (d: string) => string;
  /** QT: yapılandırılmış tür metinleri; verilmeyenler Türkçe varsayılana düşer. */
  structured?: Partial<StructuredBookletLabels>;
}

export interface BookletOptions {
  title: string;
  subtitle?: string;
  questions: BookletQuestion[];
  labels: BookletLabels;
  includeSolutions?: boolean;
  /** Açık uçlu soruda cevap için bırakılacak boş satır sayısı. */
  openLines?: number;
  /**
   * Hangi nüsha: öğrenci kitapçığı (cevap anahtarı bölümü HİÇ üretilmez), yalnız cevap anahtarı
   * ya da eski birleşik belge ("both", varsayılan; eski çağıranlar için).
   */
  copy?: "both" | "student" | "key";
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Satır sonlarını koruyarak kaçışlar. */
function multiline(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br/>");
}

const STYLE = `
@page { size: A4; margin: 16mm 14mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: "Nunito", -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #1F2937; font-size: 11.5pt; line-height: 1.45; }
h1, h2, h3 { font-family: "Baloo 2", "Nunito", -apple-system, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; }
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; page-break-after: always; break-after: page; }
.cover h1 { font-size: 30pt; color: #0B7F7F; }
.cover .sub { font-size: 14pt; margin-top: 6mm; color: #4A5A6A; }
.cover .meta { margin-top: 14mm; font-size: 11pt; color: #4A5A6A; }
.cover .fields { margin-top: 18mm; width: 120mm; text-align: left; }
.cover .fields div { border-bottom: 1px solid #9AA8B5; padding: 3mm 0 1mm; margin-bottom: 5mm; color: #4A5A6A; }
.q { break-inside: avoid; page-break-inside: avoid; margin-bottom: 7mm; }
.q figure { margin: 3mm 0 3mm 11mm; }
.q figure img { display: block; max-width: 145mm; max-height: 90mm; object-fit: contain; }
.q figcaption { font-size: 9pt; color: #625C85; }
.q .head { display: flex; gap: 3mm; align-items: baseline; }
.q .num { font-family: "Baloo 2", "Nunito", Arial, sans-serif; font-weight: 700; color: #0B7F7F; min-width: 8mm; }
.q .tag { font-size: 8.5pt; color: #6B7B8B; margin-left: 11mm; margin-bottom: 1.5mm; }
.choices { list-style: none; padding: 0; margin: 2mm 0 0 11mm; }
.choices li { margin: 1.2mm 0; }
.choices b { display: inline-block; width: 7mm; }
.lines { margin: 3mm 0 0 11mm; }
.lines div { border-bottom: 1px solid #C7D0D9; height: 8mm; }
.key { page-break-before: always; break-before: page; }
.key h2 { font-size: 18pt; color: #0B7F7F; margin-bottom: 5mm; }
.common { border: 1px solid #DCD0F4; border-radius: 3mm; padding: 4mm; margin-bottom: 5mm; background: #FCFAF6; break-inside: avoid; }
.common h2 { font-size: 15pt; margin-bottom: 2mm; }
.key table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
.key td, .key th { border: 1px solid #C7D0D9; padding: 2mm 3mm; vertical-align: top; text-align: left; }
.key th { background: #E6F4F4; }
.key .sol { color: #4A5A6A; font-size: 9.5pt; margin-top: 1mm; }
.q, .key td { overflow-wrap: anywhere; word-break: break-word; }
.qt { margin: 2.5mm 0 0 11mm; }
.qt .help { font-size: 9.5pt; color: #4A5A6A; margin-bottom: 2mm; }
.qt table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.qt td, .qt th { vertical-align: top; padding: 1.6mm 2mm; text-align: left; }
.qt .grid td, .qt .grid th { border: 1px solid #C7D0D9; }
.qt .grid th { background: #F3EFFA; font-family: "Baloo 2", "Nunito", Arial, sans-serif; }
.qt .lab { width: 11mm; white-space: nowrap; font-weight: 700; color: #5132BD; }
.qt .marks { width: 30mm; white-space: nowrap; }
.qt .sq { display: inline-block; width: 5.5mm; height: 5.5mm; border: 1.2px solid #4A5A6A; border-radius: 1mm; vertical-align: middle; margin: 0 1.2mm 0 2mm; }
.qt .slot { display: inline-block; min-width: 10mm; height: 7mm; border: 1.2px solid #4A5A6A; border-radius: 1.5mm; vertical-align: middle; margin-left: 2mm; }
.qt .blank { display: inline-block; min-width: 30mm; border-bottom: 1.2px solid #4A5A6A; height: 6mm; vertical-align: bottom; margin: 0 1mm; }
.qt .blank sup { font-size: 7.5pt; color: #5132BD; }
.qt .fill { line-height: 2.1; }
.qt .bank { border: 1px dashed #B8AED6; border-radius: 2mm; padding: 2mm 3mm; margin-top: 2mm; }
.qt .bank span { display: inline-block; border: 1px solid #DCD0F4; border-radius: 1.5mm; padding: 0.5mm 2.2mm; margin: 0.8mm 1mm; }
.qt .ans { display: flex; flex-wrap: wrap; gap: 3mm; align-items: center; margin-top: 1mm; }
.qt .ansbox { display: inline-block; width: 45mm; height: 9mm; border: 1.2px solid #4A5A6A; border-radius: 1.5mm; }
.qt .unitline { display: inline-block; width: 25mm; border-bottom: 1.2px solid #4A5A6A; height: 7mm; }
.qt .slots { display: flex; flex-wrap: wrap; gap: 2mm 4mm; margin-top: 2mm; }
.qt .cell { height: 9mm; }
.key ul { margin: 0; padding-left: 4mm; }
.key li { margin: 0.6mm 0; }
.key .note { color: #4A5A6A; font-size: 9pt; }
.qt .ci { display: inline-block; width: 5mm; height: 5mm; border: 1.2px solid #4A5A6A; border-radius: 50%; vertical-align: middle; margin-right: 2mm; }
.qt .sq { margin-left: 0; margin-right: 2mm; }
.qt .passage { line-height: 2.2; border: 1px solid #E4DCF1; border-radius: 2mm; padding: 2mm 3mm; }
.qt .stage { margin-bottom: 2mm; }
.qt .crossword-grid { width: auto; }
.qt .crossword-grid td { width: 8mm; height: 8mm; padding: 1mm; font-size: 8pt; }
.qt .crossword-grid td.closed { background: #D3CCDB; }
.qt .regiongrid { width: auto; max-width: 100%; }
.qt .rcell { width: 14mm; height: 14mm; text-align: center; vertical-align: middle; }
.qt .rl { font-size: 7pt; color: #9AA8B5; }
.qt svg.sectors, .qt svg.clock { width: 45mm; height: 45mm; display: block; margin: 1mm 0; }
.qt svg.chart { width: 120mm; max-width: 100%; display: block; }
.qt .stim { margin-bottom: 2mm; }
.qt .digital { display: inline-block; font-size: 20pt; font-weight: 700; border: 1.2px solid #4A5A6A; border-radius: 2mm; padding: 1mm 4mm; }
.qt .regimg { position: relative; display: inline-block; max-width: 145mm; }
.qt .regimg img { display: block; max-width: 145mm; max-height: 90mm; }
.qt .rbox { position: absolute; border: 1.5px dashed #5132BD; color: #5132BD; font-weight: 700; font-size: 9pt; padding: 0 1mm; box-sizing: border-box; }
`;

// ---------------------------------------------------------------------------------------------
// QT: yapılandırılmış türler kâğıtta (öğrenci) ve özel anahtarda
export interface StructuredBookletLabels {
  type: (t: string) => string;
  trueShort: string;
  falseShort: string;
  tfHelp: string;
  fillHelpBank: string;
  fillHelpBankReuse: string;
  fillHelpKeyboard: string;
  wordBank: string;
  matchingHelp: string;
  matchingHelpMany: string;
  numericAnswer: string;
  numericUnit: string;
  numericWork: string;
  orderingHelp: string;
  orderingHelpSentence: string;
  classificationHelp: string;
  capacity: (n: number) => string;
  acceptedOrder: (n: number) => string;
  conversion: (unit: string, factor: string, base: string) => string;
  tolerance: (abs: string) => string;
  relTolerance: (pct: string) => string;
  unitWeight: (pct: string) => string;
  processRequired: string;
  caseInsensitive: string;
  keyUnavailable: string;
  // Faz 2A/2B
  markHelp: (unit: "word" | "sentence", max?: number) => string;
  errorFixHelp: (unit: "word" | "sentence") => string;
  multiHelp: (count?: number) => string;
  stage: (n: number) => string;
  regionHelp: string;
  regionCountHelp: (n: number) => string;
  crosswordAcross?: string;
  crosswordDown?: string;
  clockRead: string;
  clockSet: string;
  clockTime: string;
  stimulusAlt: string;
  regionCount: (n: number) => string;
  accept12h: string;
  parentScores: string;
  fixPolicyReview: string;
}
export const DEFAULT_STRUCTURED_BOOKLET_LABELS: StructuredBookletLabels = {
  type: (t) => t,
  trueShort: "D",
  falseShort: "Y",
  tfHelp: "Her ifade doğruysa D, yanlışsa Y kutusunu işaretle.",
  fillHelpBank: "Boşlukları kutudaki kelimelerle doldur. Her kelimeyi bir kez kullan.",
  fillHelpBankReuse: "Boşlukları kutudaki kelimelerle doldur. Bir kelime birden çok kez kullanılabilir.",
  fillHelpKeyboard: "Boşlukları uygun kelimelerle doldur.",
  wordBank: "Kelimeler",
  matchingHelp: "Soldaki her öğenin kutusuna sağdaki eşinin harfini yaz. Sağda fazladan seçenek olabilir.",
  matchingHelpMany: "Soldaki her öğenin kutusuna sağdaki eşinin harfini yaz. Bir harf birden çok kez kullanılabilir.",
  numericAnswer: "Cevap",
  numericUnit: "Birim",
  numericWork: "İşlem",
  orderingHelp: "Öğeleri doğru sıraya koy; harflerini kutulara sırayla yaz.",
  orderingHelpSentence: "Kelimeleri sıraya koyarak cümleyi kur; harflerini kutulara sırayla yaz.",
  classificationHelp: "Her öğenin harfini ait olduğu grubun altına yaz.",
  capacity: (n) => `en çok ${n}`,
  acceptedOrder: (n) => `Kabul edilen sıra ${n}`,
  conversion: (unit, factor, base) => `1 ${unit} = ${factor} ${base}`,
  tolerance: (abs) => `±${abs} kabul`,
  relTolerance: (pct) => `%${pct} sapma kabul`,
  unitWeight: (pct) => `Birim puanın %${pct}'i`,
  processRequired: "İşlem gerekli: veli puanlar.",
  caseInsensitive: "Büyük/küçük harf fark etmez.",
  keyUnavailable: "Anahtar alınamadı",
  markHelp: (unit, max) => `Doğru ${unit === "word" ? "kelimelerin" : "cümlelerin"} altını çiz.${max ? ` En çok ${max} tane seç.` : ""}`,
  errorFixHelp: (unit) => `Hatalı ${unit === "word" ? "kelimelerin" : "cümlelerin"} altını çiz; doğrusunu aşağıdaki satırlara yaz.`,
  multiHelp: (count) => (count ? `${count} seçenek işaretle.` : "Doğru olanların hepsini işaretle."),
  stage: (n) => `${n}. aşama`,
  regionHelp: "Doğru bölgeleri boya ya da işaretle.",
  regionCountHelp: (n) => `${n} bölge`,
  clockRead: "Saat kaçı gösteriyor? Yaz.",
  clockSet: "Saati çiz ya da yaz.",
  clockTime: "Saat",
  stimulusAlt: "Uyaran açıklaması",
  regionCount: (n) => `${n} bölge boyanmalı (hangileri olduğu fark etmez)`,
  accept12h: "12 saatlik okuma da kabul (ör. 20:30 = 8:30).",
  parentScores: "Serbest cevap: veli değerlendirir.",
  fixPolicyReview: "Listede olmayan düzeltmeler veliye gider.",
};

type Entry = { id: string; text: string };
const entries = (v: unknown): Entry[] =>
  Array.isArray(v) ? v.flatMap((e) => (e && typeof e === "object" && typeof (e as Entry).id === "string" ? [{ id: (e as Entry).id, text: String((e as Entry).text ?? "") }] : [])) : [];
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {});
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const letter = (i: number) => LETTERS[i] ?? String(i + 1);

/** Kâğıtta sabit, cevabı ele vermeyen sıra: soru kimliğiyle tohumlanmış karıştırma (öğrenci + anahtar aynı). */
export function bookletOrder<T extends { id: string }>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const rand = () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  // Yazıldığı sırayla aynı kalırsa (çoğunlukla doğru sıra) bir kaydır.
  if (out.length > 1 && out.every((x, i) => x.id === items[i]!.id)) out.push(out.shift()!);
  return out;
}

interface StructuredLayout {
  tf: Entry[];
  segments: ({ type: "text"; text: string } | { type: "blank"; id: string })[];
  blankNo: Map<string, number>;
  bank: Entry[];
  left: Entry[];
  right: Entry[];
  items: Entry[];
  categories: (Entry & { capacity?: number })[];
}
function layoutOf(q: BookletQuestion): StructuredLayout {
  const p = obj(q.payload);
  type Seg = StructuredLayout["segments"][number];
  const segments = (Array.isArray(p.segments) ? p.segments as unknown[] : []).flatMap((s): Seg[] => {
    const o = obj(s);
    if (o.type === "text") return [{ type: "text", text: String(o.text ?? "") }];
    if (o.type === "blank" && typeof o.id === "string") return [{ type: "blank", id: o.id }];
    return [];
  });
  const blankNo = new Map<string, number>();
  for (const s of segments) if (s.type === "blank") blankNo.set(s.id, blankNo.size + 1);
  const type = q.interaction_type;
  return {
    tf: entries(p.statements),
    segments,
    blankNo,
    bank: bookletOrder(entries(p.bank), q.id + ":bank"),
    left: entries(p.left),
    right: bookletOrder(entries(p.right), q.id + ":right"),
    items: type === "ordering" || type === "classification" ? bookletOrder(entries(p.items), q.id + ":items") : [],
    categories: (Array.isArray(p.categories) ? p.categories : []).flatMap((c) => {
      const o = obj(c);
      return typeof o.id === "string" ? [{ id: o.id, text: String(o.text ?? ""), ...(typeof o.capacity === "number" ? { capacity: o.capacity } : {}) }] : [];
    }),
  };
}

const DATA_IMAGE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;
/** Tablo / çubuk grafik uyaranı (öğrenci nüshasında başlıkla; açıklaması anahtarda). */
function stimulusHtml(s: unknown): string {
  const o = obj(s);
  if (o.kind === "table" && Array.isArray(o.columns) && Array.isArray(o.rows)) {
    return `<div class="qt stim">${o.caption ? `<div class="help">${escapeHtml(o.caption)}</div>` : ""}<table class="grid"><thead><tr>${
      (o.columns as unknown[]).map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead><tbody>${
      (o.rows as unknown[][]).map((r) => `<tr>${(Array.isArray(r) ? r : []).map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  if (o.kind === "bar_chart" && Array.isArray(o.bars)) {
    const bars = (o.bars as { label: unknown; value: unknown }[]).map((b) => ({ label: String(b.label), value: Number(b.value) || 0 }));
    const max = Math.max(1, ...bars.map((b) => b.value));
    const w = 160, h = 70, bw = w / bars.length;
    const rects = bars.map((b, i) => {
      const bh = (b.value / max) * (h - 12);
      return `<rect x="${(i * bw + bw * 0.15).toFixed(2)}" y="${(h - bh).toFixed(2)}" width="${(bw * 0.7).toFixed(2)}" height="${bh.toFixed(2)}" fill="#B9A8EE"/>` +
        `<text x="${(i * bw + bw / 2).toFixed(2)}" y="${(h - bh - 1.5).toFixed(2)}" font-size="4" text-anchor="middle">${escapeHtml(b.value)}</text>` +
        `<text x="${(i * bw + bw / 2).toFixed(2)}" y="${h + 5}" font-size="4" text-anchor="middle">${escapeHtml(b.label)}</text>`;
    }).join("");
    return `<div class="qt stim">${o.caption ? `<div class="help">${escapeHtml(o.caption)}</div>` : ""}<svg class="chart" viewBox="0 0 ${w} ${h + 8}" role="img" aria-label="${escapeHtml(o.caption ?? "")}"><line x1="0" y1="${h}" x2="${w}" y2="${h}" stroke="#4A5A6A" stroke-width="0.4"/>${rects}</svg>${
      o.unit || o.y_label ? `<div class="help">${escapeHtml([o.y_label, o.unit].filter(Boolean).join(" · "))}</div>` : ""}</div>`;
  }
  return "";
}
/** Boş saat kadranı (set) ya da gösterilen saat (read). */
function clockFace(time?: string): string {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return `<text x="${(50 + 38 * Math.sin(a)).toFixed(1)}" y="${(53 - 38 * Math.cos(a)).toFixed(1)}" font-size="8" text-anchor="middle">${i === 0 ? 12 : i}</text>`;
  }).join("");
  let hands = "";
  const m = time ? /^(\d{2}):(\d{2})$/.exec(time) : null;
  if (m) {
    const hh = Number(m[1]) % 12, mm = Number(m[2]);
    const ha = ((hh + mm / 60) * Math.PI) / 6, ma = (mm * Math.PI) / 30;
    hands = `<line x1="50" y1="50" x2="${(50 + 22 * Math.sin(ha)).toFixed(1)}" y2="${(50 - 22 * Math.cos(ha)).toFixed(1)}" stroke="#201951" stroke-width="3" stroke-linecap="round"/>` +
      `<line x1="50" y1="50" x2="${(50 + 32 * Math.sin(ma)).toFixed(1)}" y2="${(50 - 32 * Math.cos(ma)).toFixed(1)}" stroke="#201951" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  return `<svg class="clock" viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="none" stroke="#4A5A6A" stroke-width="1.5"/>${ticks}${hands}<circle cx="50" cy="50" r="1.8" fill="#201951"/></svg>`;
}
function sectorsSvg(n: number): string {
  const paths = Array.from({ length: n }, (_, i) => {
    const a0 = (i * 2 * Math.PI) / n - Math.PI / 2, a1 = ((i + 1) * 2 * Math.PI) / n - Math.PI / 2, am = (a0 + a1) / 2;
    const p = (a: number, r: number) => `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`;
    return `<path d="M50,50 L${p(a0, 46)} A46,46 0 0 1 ${p(a1, 46)} Z" fill="none" stroke="#4A5A6A" stroke-width="0.8"/><text x="${p(am, 30).split(",")[0]}" y="${p(am, 30).split(",")[1]}" font-size="6" text-anchor="middle" fill="#5132BD">${i + 1}</text>`;
  }).join("");
  return `<svg class="sectors" viewBox="0 0 100 100">${paths}</svg>`;
}
function passageHtml(p: Record<string, unknown>): string {
  return (Array.isArray(p.segments) ? p.segments : []).map((seg) => multiline(obj(seg).text)).join("");
}
function crosswordBooklet(q: BookletQuestion, L: StructuredBookletLabels, teacher: boolean): string {
  const { stimulus: _stimulus, ...payload } = obj(q.payload);
  const parsed = crosswordPayloadSchema.safeParse(payload);
  if (!parsed.success) return "";
  const { rows, cols, clues } = parsed.data;
  const active = new Set(clues.flatMap(clueCells));
  const starts = new Map<string, number[]>();
  clues.forEach((clue, index) => {
    const first = clueCells(clue)[0]!;
    starts.set(first, [...(starts.get(first) ?? []), index + 1]);
  });
  const answers = teacher ? obj(obj(q.answer_key).answers) : {};
  const grid = teacher ? "" : `<table class="grid crossword-grid"><tbody>${Array.from({ length: rows }, (_, row) => `<tr>${
    Array.from({ length: cols }, (_, col) => {
      const id = `r${row + 1}_c${col + 1}`;
      return active.has(id) ? `<td>${starts.get(id)?.join(", ") ?? ""}</td>` : '<td class="closed"></td>';
    }).join("")
  }</tr>`).join("")}</tbody></table>`;
  const list = clues.map(clue => {
    const direction = clue.dir === "across" ? L.crosswordAcross ?? "Yatay" : L.crosswordDown ?? "Dikey";
    const key = teacher ? ` <b>${escapeHtml(answers[clue.id] ?? "—")}</b>` : "";
    return `<li>${escapeHtml(direction)} · ${escapeHtml(clue.text)} (${clue.length})${key}</li>`;
  }).join("");
  return `<div class="qt qt-crossword">${grid}<ol>${list}</ol></div>`;
}
function phase2StudentHtml(q: BookletQuestion, L: StructuredBookletLabels): string | null {
  const p = obj(q.payload);
  const help = (text: string) => `<div class="help">${escapeHtml(text)}</div>`;
  const opts = (arr: unknown, mark: "sq" | "ci") => `<table><tbody>${entries(arr).map((o, i) => `<tr><td><span class="${mark}"></span><b>${letter(i)})</b> ${escapeHtml(o.text)}</td></tr>`).join("")}</tbody></table>`;
  switch (q.interaction_type) {
    case "crossword": return crosswordBooklet(q, L, false);
    case "mark_text":
      return `<div class="qt qt-mark">${help(L.markHelp(p.unit === "sentence" ? "sentence" : "word", typeof p.max_select === "number" ? p.max_select : undefined))}<div class="passage">${passageHtml(p)}</div></div>`;
    case "error_fix":
      return `<div class="qt qt-fix">${help(L.errorFixHelp(p.unit === "sentence" ? "sentence" : "word"))}<div class="passage">${passageHtml(p)}</div><div class="lines" style="margin-left:0"><div></div><div></div><div></div></div></div>`;
    case "multi_choice":
      return `<div class="qt qt-multi">${help(L.multiHelp(typeof p.select_count === "number" ? p.select_count : undefined))}${opts(p.options, "sq")}</div>`;
    case "two_stage": {
      const s1 = obj(p.stage1), s2 = obj(p.stage2);
      return `<div class="qt qt-stage"><div class="stage"><b>${escapeHtml(L.stage(1))}:</b> ${multiline(s1.prompt)}${opts(s1.options, "ci")}</div><div class="stage"><b>${escapeHtml(L.stage(2))}:</b> ${multiline(s2.prompt)}${
        s2.mode === "choice" ? opts(s2.options, "ci") : `<div class="lines" style="margin-left:0"><div></div><div></div><div></div></div>`}</div></div>`;
    }
    case "region_select": {
      const f = obj(p.figure);
      const regions = entries(p.regions);
      if (f.kind === "grid") {
        const rows = Number(f.rows) || 1, cols = Number(f.cols) || 1;
        return `<div class="qt qt-region">${help(L.regionHelp)}<table class="grid regiongrid"><tbody>${Array.from({ length: rows }, (_, r) => `<tr>${Array.from({ length: cols }, (_, c) =>
          `<td class="rcell"><span class="rl">${escapeHtml(regions[r * cols + c]?.text ?? "")}</span></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      }
      if (f.kind === "sectors") return `<div class="qt qt-region">${help(L.regionHelp)}${sectorsSvg(regions.length)}</div>`;
      const img = q.images?.[0];
      const boxes = (Array.isArray(p.regions) ? p.regions : []).map((r, i) => {
        const b = obj(r).box as number[] | undefined;
        return Array.isArray(b) ? `<span class="rbox" style="left:${b[0]! * 100}%;top:${b[1]! * 100}%;width:${b[2]! * 100}%;height:${b[3]! * 100}%">${letter(i)}</span>` : "";
      }).join("");
      if (img && !DATA_IMAGE.test(img.dataUri)) throw new Error("invalid_booklet_image");
      return `<div class="qt qt-region">${help(L.regionHelp)}${img ? `<div class="regimg"><img src="${img.dataUri}" alt="${escapeHtml(img.alt)}"/>${boxes}</div>` : ""}<table><tbody>${
        regions.map((r, i) => `<tr><td><span class="sq"></span><b>${letter(i)})</b> ${escapeHtml(r.text)}</td></tr>`).join("")}</tbody></table></div>`;
    }
    case "clock": {
      const read = p.mode === "read";
      const shown = typeof p.shown_time === "string" ? p.shown_time : undefined;
      const face = p.display === "analog" ? clockFace(read ? shown : undefined) : read ? `<div class="digital">${escapeHtml(shown)}</div>` : "";
      return `<div class="qt qt-clock">${help(read ? L.clockRead : L.clockSet)}${face}<div class="ans"><b>${escapeHtml(L.clockTime)}:</b><span class="unitline"></span> : <span class="unitline"></span></div></div>`;
    }
    default:
      return null;
  }
}
function phase2KeyHtml(q: BookletQuestion, L: StructuredBookletLabels): string | null {
  const p = obj(q.payload), k = obj(q.answer_key);
  const li = (s: string) => `<li>${s}</li>`;
  const textOf = (arr: unknown, id: unknown) => entries(arr).find((e) => e.id === id)?.text ?? "—";
  const segs = (Array.isArray(p.segments) ? p.segments : []).map(obj).filter((s) => typeof s.id === "string").map((s) => ({ id: String(s.id), text: String(s.text) }));
  switch (q.interaction_type) {
    case "crossword": return crosswordBooklet(q, L, true);
    case "mark_text":
      return `<ul>${(Array.isArray(k.targets) ? k.targets : []).map((id) => li(`<b>${escapeHtml(segs.find((s) => s.id === id)?.text ?? "—")}</b>`)).join("")}</ul>`;
    case "error_fix":
      return `<ul>${Object.entries(obj(k.errors)).map(([id, v]) => li(`${escapeHtml(segs.find((s) => s.id === id)?.text ?? "—")} → <b>${
        (Array.isArray(obj(v).accepted) ? obj(v).accepted as unknown[] : []).map(escapeHtml).join(" / ")}</b>`)).join("")}</ul>${k.fix_policy === "review_unmatched" ? `<div class="note">${escapeHtml(L.fixPolicyReview)}</div>` : ""}`;
    case "multi_choice": {
      const options = entries(p.options);
      return `<b>${options.map((o, i) => ((k.correct as unknown[] | undefined)?.includes(o.id) ? letter(i) : null)).filter(Boolean).join(", ")}</b>`;
    }
    case "two_stage": {
      const s1 = obj(p.stage1), s2 = obj(p.stage2);
      const at = (arr: unknown, id: unknown) => entries(arr).findIndex((e) => e.id === id);
      return `<ul>${li(`${escapeHtml(L.stage(1))}: <b>${at(s1.options, k.stage1) >= 0 ? letter(at(s1.options, k.stage1)) : "—"}</b> · ${escapeHtml(textOf(s1.options, k.stage1))}`)}${
        li(`${escapeHtml(L.stage(2))}: ${s2.mode === "choice" ? `<b>${at(s2.options, k.stage2) >= 0 ? letter(at(s2.options, k.stage2)) : "—"}</b> · ${escapeHtml(textOf(s2.options, k.stage2))}` : escapeHtml(L.parentScores)}`)}</ul>`;
    }
    case "region_select": {
      const regions = entries(p.regions);
      const image = obj(p.figure).kind === "image";
      if (typeof k.count === "number") return `<b>${escapeHtml(L.regionCount(k.count))}</b>`;
      return `<b>${(Array.isArray(k.targets) ? k.targets : []).map((id) => {
        const i = regions.findIndex((r) => r.id === id);
        return i < 0 ? "—" : image ? `${letter(i)} (${escapeHtml(regions[i]!.text)})` : escapeHtml(regions[i]!.text);
      }).join(", ")}</b>`;
    }
    case "clock":
      return `<b>${escapeHtml(k.time)}</b>${k.accept_12h ? `<div class="note">${escapeHtml(L.accept12h)}</div>` : ""}`;
    default:
      return null;
  }
}

function structuredStudentHtml(q: BookletQuestion, L: StructuredBookletLabels): string {
  const stim = stimulusHtml(obj(q.payload).stimulus);
  return stim + (phase2StudentHtml(q, L) ?? structuredStudentBody(q, L));
}
function structuredKeyHtml(q: BookletQuestion, L: StructuredBookletLabels): string {
  if (!q.answer_key || typeof q.answer_key !== "object") return `<span class="note">${escapeHtml(L.keyUnavailable)}</span>`;
  const alt = obj(obj(q.payload).stimulus).alt;
  return (phase2KeyHtml(q, L) ?? structuredKeyBody(q, L)) + (typeof alt === "string" ? `<div class="note">${escapeHtml(L.stimulusAlt)}: ${escapeHtml(alt)}</div>` : "");
}

function structuredStudentBody(q: BookletQuestion, L: StructuredBookletLabels): string {
  const p = obj(q.payload);
  const l = layoutOf(q);
  const help = (text: string) => `<div class="help">${escapeHtml(text)}</div>`;
  switch (q.interaction_type) {
    case "true_false":
      return `<div class="qt qt-tf">${help(L.tfHelp)}<table class="grid"><tbody>${
        l.tf.map((s, i) =>
          `<tr><td class="lab">${letter(i).toLowerCase()})</td><td>${multiline(s.text)}</td><td class="marks"><span class="sq"></span>${escapeHtml(L.trueShort)}<span class="sq"></span>${escapeHtml(L.falseShort)}</td></tr>`
        ).join("")
      }</tbody></table></div>`;
    case "fill_blank": {
      const bank = p.input === "bank";
      const text = l.segments.map((s) => (s.type === "text" ? multiline(s.text) : `<span class="blank"><sup>${l.blankNo.get(s.id)}</sup></span>`)).join("");
      return `<div class="qt qt-fill">${help(bank ? (p.bank_reuse ? L.fillHelpBankReuse : L.fillHelpBank) : L.fillHelpKeyboard)}<div class="fill">${text}</div>${
        bank ? `<div class="bank"><b>${escapeHtml(L.wordBank)}:</b> ${l.bank.map((w) => `<span>${escapeHtml(w.text)}</span>`).join("")}</div>` : ""
      }</div>`;
    }
    case "matching": {
      const rows = Math.max(l.left.length, l.right.length);
      return `<div class="qt qt-match">${help(p.policy === "many_to_one" ? L.matchingHelpMany : L.matchingHelp)}<table><tbody>${
        Array.from({ length: rows }, (_, i) => {
          const a = l.left[i], b = l.right[i];
          return `<tr><td>${a ? `<b>${i + 1}.</b> ${escapeHtml(a.text)}<span class="slot"></span>` : ""}</td><td>${b ? `<b>${letter(i)})</b> ${escapeHtml(b.text)}` : ""}</td></tr>`;
        }).join("")
      }</tbody></table></div>`;
    }
    case "numeric": {
      const units = entries(p.units);
      return `<div class="qt qt-num"><div class="ans"><b>${escapeHtml(L.numericAnswer)}:</b><span class="ansbox"></span>${
        p.unit_required ? `<b>${escapeHtml(L.numericUnit)}:</b><span class="unitline"></span><span class="help">(${units.map((u) => escapeHtml(u.text)).join(", ")})</span>` : ""
      }</div>${p.work_area ? `<div class="help" style="margin-top:2mm">${escapeHtml(L.numericWork)}:</div><div class="lines" style="margin-left:0"><div></div><div></div><div></div><div></div></div>` : ""}</div>`;
    }
    case "ordering":
      return `<div class="qt qt-order">${help(p.mode === "sentence" ? L.orderingHelpSentence : L.orderingHelp)}<table><tbody>${
        l.items.map((it, i) => `<tr><td><b>${letter(i)})</b> ${escapeHtml(it.text)}</td></tr>`).join("")
      }</tbody></table><div class="slots">${l.items.map((_, i) => `<span>${i + 1}.<span class="slot"></span></span>`).join("")}</div>${
        p.mode === "sentence" ? `<div class="lines" style="margin-left:0"><div></div></div>` : ""
      }</div>`;
    case "classification": {
      const rows = Math.max(2, ...l.categories.map((c) => c.capacity ?? Math.ceil(l.items.length / Math.max(1, l.categories.length)) + 1));
      return `<div class="qt qt-class">${help(L.classificationHelp)}<table><tbody>${
        l.items.map((it, i) => `<tr><td><b>${letter(i)})</b> ${escapeHtml(it.text)}</td></tr>`).join("")
      }</tbody></table><table class="grid" style="margin-top:2mm"><thead><tr>${
        l.categories.map((c) => `<th>${escapeHtml(c.text)}${c.capacity ? ` <span class="help">(${escapeHtml(L.capacity(c.capacity))})</span>` : ""}</th>`).join("")
      }</tr></thead><tbody>${Array.from({ length: rows }, () => `<tr>${l.categories.map(() => `<td class="cell"></td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    default:
      return `<div class="lines"><div></div><div></div><div></div></div>`;
  }
}

function structuredKeyBody(q: BookletQuestion, L: StructuredBookletLabels): string {
  if (!q.answer_key || typeof q.answer_key !== "object") return `<span class="note">${escapeHtml(L.keyUnavailable)}</span>`;
  const k = obj(q.answer_key);
  const p = obj(q.payload);
  const l = layoutOf(q);
  const li = (s: string) => `<li>${s}</li>`;
  switch (q.interaction_type) {
    case "true_false": {
      const a = obj(k.answers);
      return `<ul>${l.tf.map((s, i) => li(`${letter(i).toLowerCase()}) <b>${escapeHtml(a[s.id] === true ? L.trueShort : a[s.id] === false ? L.falseShort : "—")}</b> · ${escapeHtml(s.text)}`)).join("")}</ul>`;
    }
    case "fill_blank": {
      const blanks = obj(k.blanks);
      const bank = entries(p.bank);
      return `<ul>${[...l.blankNo.entries()].map(([id, n]) => {
        const v = obj(blanks[id]);
        const words = Array.isArray(v.tokens)
          ? v.tokens.map((t) => bank.find((w) => w.id === t)?.text ?? "—")
          : Array.isArray(v.accepted) ? v.accepted.map(String) : [];
        return li(`(${n}) <b>${words.map(escapeHtml).join(" / ") || "—"}</b>`);
      }).join("")}</ul>${k.case_insensitive ? `<div class="note">${escapeHtml(L.caseInsensitive)}</div>` : ""}`;
    }
    case "matching": {
      const pairs = obj(k.pairs);
      return `<ul>${l.left.map((a, i) => {
        const at = l.right.findIndex((r) => r.id === pairs[a.id]);
        return li(`${i + 1} → <b>${at >= 0 ? letter(at) : "—"}</b> · ${escapeHtml(a.text)} — ${escapeHtml(at >= 0 ? l.right[at]!.text : "")}`);
      }).join("")}</ul>`;
    }
    case "numeric": {
      const units = entries(p.units);
      const unitText = (id: unknown) => units.find((u) => u.id === id)?.text ?? "";
      const notes: string[] = [];
      for (const [u, f] of Object.entries(obj(k.unit_factors))) if (u !== k.unit) notes.push(L.conversion(unitText(u), String(f), unitText(k.unit)));
      if (typeof k.abs_tolerance === "number" && k.abs_tolerance > 0) notes.push(L.tolerance(String(k.abs_tolerance)));
      if (typeof k.rel_tolerance === "number" && k.rel_tolerance > 0) notes.push(L.relTolerance(String(Math.round(k.rel_tolerance * 10000) / 100)));
      if (typeof k.unit_weight === "number" && k.unit_weight > 0) notes.push(L.unitWeight(String(Math.round(k.unit_weight * 10000) / 100)));
      if (k.process_required) notes.push(L.processRequired);
      return `<b>${escapeHtml(k.value)}${k.unit ? " " + escapeHtml(unitText(k.unit)) : ""}</b>${notes.length ? `<div class="note">${notes.map(escapeHtml).join(" · ")}</div>` : ""}`;
    }
    case "ordering": {
      const orders = Array.isArray(k.orders) ? k.orders : [];
      return `<ul>${orders.map((o, n) => li(`${escapeHtml(L.acceptedOrder(n + 1))}: <b>${(Array.isArray(o) ? o : []).map((id) => {
        const at = l.items.findIndex((x) => x.id === id);
        return at >= 0 ? letter(at) : "—";
      }).join(", ")}</b> · ${(Array.isArray(o) ? o : []).map((id) => escapeHtml(l.items.find((x) => x.id === id)?.text ?? "")).join(" ")}`)).join("")}</ul>`;
    }
    case "classification": {
      const m = obj(k.membership);
      return `<ul>${l.categories.map((c) => li(`${escapeHtml(c.text)}: <b>${l.items.map((it, i) => (m[it.id] === c.id ? letter(i) : null)).filter(Boolean).join(", ") || "—"}</b>`)).join("")}</ul>`;
    }
    default:
      return "—";
  }
}

export function buildBookletHtml(
  {
    title,
    subtitle,
    questions,
    labels,
    includeSolutions = true,
    openLines = 5,
    copy = "both",
  }: BookletOptions,
): string {
  const SL: StructuredBookletLabels = { ...DEFAULT_STRUCTURED_BOOKLET_LABELS, ...labels.structured };
  const topics = Array.from(new Set(questions.map((q) => q.topic)));

  const cover = `
<section class="cover">
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ""}
  <div class="meta">${escapeHtml(labels.questionCount)}<br/>${
    escapeHtml(labels.topics)
  }: ${escapeHtml(topics.join(", "))}</div>
  <div class="fields"><div>${escapeHtml(labels.name)}:</div><div>${
    escapeHtml(labels.date)
  }:</div></div>
</section>`;

  const body = questions
    .map((q, i) => {
      const choices = q.kind === "structured"
        ? structuredStudentHtml(q, SL)
        : q.kind === "multiple_choice" && q.choices?.length
        ? `<ul class="choices">${
          q.choices.map((c) =>
            `<li><b>${escapeHtml(c.key)})</b>${escapeHtml(c.text)}</li>`
          ).join("")
        }</ul>`
        : `<div class="lines">${
          "<div></div>".repeat(Math.max(1, openLines))
        }</div>`;
      // Görsel üzerinde bölge: görsel bölge katmanıyla birlikte cevap alanında basılır (iki kez değil).
      const regionImage = q.kind === "structured" && q.interaction_type === "region_select" && obj(obj(q.payload).figure).kind === "image";
      const images = (regionImage ? [] : q.images ?? []).map((image) => {
        if (
          !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(image.dataUri)
        ) throw new Error("invalid_booklet_image");
        return `<figure><img src="${image.dataUri}" alt="${
          escapeHtml(image.alt)
        }"/><figcaption>${escapeHtml(image.alt)}</figcaption></figure>`;
      }).join("");
      const common =
        q.context && questions[i - 1]?.context?.group_id !== q.context.group_id
          ? `<section class="common"><h2>${
            escapeHtml(q.context.title)
          }</h2><p>${multiline(q.context.body)}</p>${images}</section>`
          : "";
      return `
${common}
<div class="q">
  <div class="tag">${q.context ? escapeHtml(q.context.title) + " · " : ""}${
        escapeHtml(q.topic)
      } · ${escapeHtml(labels.difficulty(q.difficulty))}</div>
  <div class="head"><span class="num">${i + 1}.</span><span>${
        multiline(q.context?.prompt ?? q.stem)
      }</span></div>
  ${q.context ? "" : images}
  ${choices}
</div>`;
    })
    .join("");

  const keyRows = questions
    .map((q, i) => {
      const answer = q.kind === "structured"
        ? structuredKeyHtml(q, SL)
        : q.kind === "multiple_choice"
        ? `<b>${escapeHtml(q.correct_key)}</b>`
        : `${escapeHtml(labels.expected)}: ${multiline(q.expected_answer)}`;
      const sol = includeSolutions && q.solution
        ? `<div class="sol">${escapeHtml(labels.solution)}: ${
          multiline(q.solution)
        }</div>`
        : "";
      return `<tr><td>${i + 1}</td><td>${
        escapeHtml(q.topic)
      }</td><td>${answer}${sol}</td></tr>`;
    })
    .join("");

  const key = `
<section class="key">
  <h2>${escapeHtml(labels.answerKey)}</h2>
  <table><thead><tr><th>#</th><th>${escapeHtml(labels.topics)}</th><th>${
    escapeHtml(labels.answerKey)
  }</th></tr></thead><tbody>${keyRows}</tbody></table>
</section>`;

  const head = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${
    escapeHtml(title)
  }</title><style>${STYLE}${copy === "key" ? ".key{page-break-before:auto;break-before:auto}" : ""}</style></head><body>`;
  // Öğrenci nüshasında anahtar bölümü hiç üretilmez; anahtar nüshasında soru gövdesi yok.
  if (copy === "student") return `${head}${cover}<main>${body}</main></body></html>`;
  if (copy === "key") return `${head}${key}</body></html>`;
  return `${head}${cover}<main>${body}</main>${key}</body></html>`;
}

/** D4-4 — native PDF (WKWebView → CoreGraphics) için gömülü yazı tipi.
 * Kök neden: HTML'deki "Nunito"/"Baloo 2" WebView'da yüklü değil, metin sistem fontuna
 * (SF) düşüyor. Cihaz dili Türkçe iken SF'nin Türkçeye özel "i" glifi cmap'te karşılığı
 * olmayan bir glif; PDF yazıcısı bunu ToUnicode'suz MacRoman alt kümesine 0x21 koduyla
 * koyuyor, `pdftotext`/arama/kopyalama "i" yerine "!" okuyor (görsel doğru). Uygulamanın
 * kendi yazı tiplerini @font-face ile gömmek metin katmanını düzeltir. */
export interface BookletFont {
  family: "Nunito" | "Baloo 2";
  weight: 400 | 600 | 700 | 800;
  /** TTF baytlarının base64 hâli (data: öneki olmadan). */
  base64: string;
}

export function bookletFontFaceCss(fonts: readonly BookletFont[]): string {
  return fonts
    .filter((f) => /^[A-Za-z0-9+/]+={0,2}$/.test(f.base64))
    .map((f) =>
      `@font-face { font-family: "${f.family}"; font-style: normal; font-weight: ${f.weight}; src: url(data:font/ttf;base64,${f.base64}) format("truetype"); }`
    )
    .join("\n");
}

/** Hazır kitapçık HTML'ine yazı tiplerini ekler; yazı tipi yoksa HTML'i aynen döndürür. */
export function withBookletFonts(
  html: string,
  fonts: readonly BookletFont[],
): string {
  const css = bookletFontFaceCss(fonts);
  if (!css || !html.includes("</head>")) return html;
  return html.replace("</head>", `<style>${css}</style></head>`);
}
