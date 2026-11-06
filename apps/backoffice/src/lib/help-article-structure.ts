// Help articles keep a single `body` text column on the server. Structured
// answers (short answer, numbered steps, links) are serialized into that text
// with fixed headings so that the mobile/web reader and older plain-text
// articles both stay readable. Older free-text bodies parse as `null` and are
// shown unchanged.
export type ArticleLink = { label: string; url: string };
export type ArticleStructure = {
  short: string;
  steps: string[];
  links: ArticleLink[];
};
type Locale = "tr" | "en";
const headings = {
  tr: { short: "Kısa cevap", steps: "Adımlar", links: "Bağlantılar" },
  en: { short: "Short answer", steps: "Steps", links: "Links" },
} as const;
export const sectionTitle = (locale: Locale, k: keyof typeof headings.tr) =>
  headings[locale][k];
const keyOf = (line: string): keyof typeof headings.tr | null => {
  const t = line.replace(/^##\s+/, "").trim().toLocaleLowerCase("tr");
  for (const l of ["tr", "en"] as const) {
    for (const k of ["short", "steps", "links"] as const) {
      if (headings[l][k].toLocaleLowerCase("tr") === t) return k;
    }
  }
  return null;
};
export function parseArticle(body: string): ArticleStructure | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  if (!lines.length || !/^##\s+/.test(lines[0] ?? "") || !keyOf(lines[0]!)) {
    return null;
  }
  const out: ArticleStructure = { short: "", steps: [], links: [] };
  const short: string[] = [];
  let section: keyof typeof headings.tr | null = null;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      const k = keyOf(line);
      if (!k) return null; // unknown heading: keep as free text
      section = k;
      continue;
    }
    if (section === "short") short.push(line);
    else if (section === "steps") {
      const m = /^\d+\.\s?(.*)$/.exec(line);
      if (m) out.steps.push(m[1] ?? "");
      else if (line.trim()) return null;
    } else if (section === "links") {
      const m = /^-\s\[(.*)\]\((.*)\)$/.exec(line);
      if (m) out.links.push({ label: m[1] ?? "", url: m[2] ?? "" });
      else if (line.trim()) return null;
    }
  }
  // One blank line separates sections; keep everything else so typing a
  // trailing space or newline is not swallowed while editing.
  if (
    short.length > 1 && short.at(-1) === "" &&
    (out.steps.length || out.links.length)
  ) short.pop();
  out.short = short.join("\n");
  return out;
}
export function serializeArticle(s: ArticleStructure, locale: Locale) {
  const parts = [
    `## ${headings[locale].short}`,
    s.short.replace(/^##/gm, "# #"),
  ];
  if (s.steps.length) {
    parts.push(
      "",
      `## ${headings[locale].steps}`,
      ...s.steps.map((step, i) => `${i + 1}. ${step.replace(/\n/g, " ")}`),
    );
  }
  if (s.links.length) {
    parts.push(
      "",
      `## ${headings[locale].links}`,
      ...s.links.map((l) =>
        `- [${l.label.replace(/[\[\]\n]/g, " ")}](${
          l.url.replace(/[()\s]/g, "")
        })`
      ),
    );
  }
  return parts.join("\n");
}
export const fromFreeText = (body: string): ArticleStructure => ({
  short: body.trim(),
  steps: [],
  links: [],
});
// Links shown to families must be https or the app's own deep links.
export const linkProblem = (l: ArticleLink) =>
  !l.label.trim()
    ? "Bağlantı metni boş"
    : !/^(https:\/\/[^\s]+|gina:\/\/[^\s]+|\/[a-z0-9/_-]*)$/i.test(l.url)
    ? "Adres https://, gina:// veya / ile başlamalı"
    : null;
export function structureProblems(s: ArticleStructure) {
  const p: string[] = [];
  if (s.short.trim().length < 10) p.push("Kısa cevap en az 10 karakter olmalı");
  if (s.short.length > 400) {
    p.push("Kısa cevap 400 karakteri geçmesin; ayrıntıyı adımlara taşıyın");
  }
  if (s.steps.some((x) => !x.trim())) p.push("Boş adım var");
  s.links.forEach((l, i) => {
    const e = linkProblem(l);
    if (e) p.push(`Bağlantı ${i + 1}: ${e}`);
  });
  return p;
}
