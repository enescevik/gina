/** Pure, escaped print layout shared by the mobile/web export path and tests. */
export interface BookletChoice {
  key: string;
  text: string;
}

export interface BookletQuestion {
  id: string;
  topic: string;
  kind: "multiple_choice" | "open_ended";
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
}

export interface BookletOptions {
  title: string;
  subtitle?: string;
  questions: BookletQuestion[];
  labels: BookletLabels;
  includeSolutions?: boolean;
  /** Açık uçlu soruda cevap için bırakılacak boş satır sayısı. */
  openLines?: number;
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
`;

export function buildBookletHtml(
  {
    title,
    subtitle,
    questions,
    labels,
    includeSolutions = true,
    openLines = 5,
  }: BookletOptions,
): string {
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
      const choices = q.kind === "multiple_choice" && q.choices?.length
        ? `<ul class="choices">${
          q.choices.map((c) =>
            `<li><b>${escapeHtml(c.key)})</b>${escapeHtml(c.text)}</li>`
          ).join("")
        }</ul>`
        : `<div class="lines">${
          "<div></div>".repeat(Math.max(1, openLines))
        }</div>`;
      const images = (q.images ?? []).map((image) => {
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
      const answer = q.kind === "multiple_choice"
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

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${
    escapeHtml(title)
  }</title><style>${STYLE}</style></head><body>${cover}<main>${body}</main>${key}</body></html>`;
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
