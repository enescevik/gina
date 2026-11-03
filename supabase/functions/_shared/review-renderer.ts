import { readSourceBlob } from "./library-source.ts";
import { initWasm, Resvg } from "npm:@resvg/resvg-wasm@2.6.2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { inspectSource } from "./source-file.ts";

let ready: Promise<void> | undefined;
let fonts: Uint8Array[];
let fontCoverage: [number, number][];
const fontFamily = "Nunito, Noto Sans Math";
async function initialize() {
  ready ??= (async () => {
    const root = new URL("../prova-review/assets/", import.meta.url);
    const [wasm, buffer, math, coverage] = await Promise.all([
      Deno.readFile(new URL("resvg-2.6.2.wasm", root)),
      Deno.readFile(new URL("Nunito-SemiBold.ttf", root)),
      Deno.readFile(new URL("NotoSansMath-Regular.ttf", root)),
      Deno.readTextFile(new URL("font-coverage.json", root)),
    ]);
    fonts = [buffer, math];
    fontCoverage = JSON.parse(coverage);
    await initWasm(wasm);
  })();
  await ready;
}
const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(
    /"/g,
    "&quot;",
  ).replace(/'/g, "&apos;");
const number = (v: unknown, min: number, max: number): number => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) {
    throw new Error("invalid_notebook");
  }
  return v;
};
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) {
    throw new Error("invalid_notebook");
  }
  return v as Record<string, unknown>;
}
function text(v: unknown, max: number): string {
  if (typeof v !== "string" || v.length > max) {
    throw new Error("invalid_notebook");
  }
  return v;
}
const options = () => ({
  font: { fontBuffers: fonts, defaultFontFamily: "Nunito" },
  background: "#FFFEFA",
});
const shell = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1000" height="1400" viewBox="0 0 1000 1400">${content}</svg>`;

/** Pure trusted assembly: no external href, arbitrary SVG or parent annotation accepted. */
export async function notebookSvg(
  value: unknown,
  resolveImage: (source: string, question: string) => Promise<string>,
): Promise<string> {
  await initialize();
  const doc = object(value);
  if (
    doc.version !== 1 || doc.width !== 1000 || doc.height !== 1400 ||
    !Array.isArray(doc.elements) || doc.elements.length > 300 ||
    JSON.stringify(value).length > 600000
  ) throw new Error("invalid_notebook");
  const pieces: string[] = [
    '<rect width="1000" height="1400" fill="#FFFEFA"/>',
  ];
  let measureCount = 0;
  const measurements = new Map<string, number>();
  function measure(value: string, size: number) {
    const key = `${size}:${value}`;
    if (measurements.has(key)) return measurements.get(key)!;
    if (++measureCount > 2000) throw new Error("notebook_render_failed");
    const r = new Resvg(
      shell(
        `<text x="0" y="100" font-family="${fontFamily}" font-size="${size}">${
          escape(value)
        }</text>`,
      ),
      options(),
    );
    const b = r.getBBox();
    const width = b?.width ?? 0;
    b?.free();
    r.free();
    measurements.set(key, width);
    return width;
  }
  for (const [index, raw] of doc.elements.entries()) {
    const e = object(raw);
    if (e.type === "stroke" || e.type === "text") {
      if (
        !["#201951", "#6042DE", "#227D73", "#BA5348"].includes(String(e.color))
      ) throw new Error("invalid_notebook");
    }
    if (e.type === "stroke") {
      const size = number(e.size, 1, 20);
      if (
        !Array.isArray(e.points) || e.points.length < 1 ||
        e.points.length > 2000
      ) throw new Error("invalid_notebook");
      const points = e.points.map((p) => {
        if (!Array.isArray(p) || p.length !== 2) {
          throw new Error("invalid_notebook");
        }
        return [number(p[0], 0, 1000), number(p[1], 0, 1400)];
      });
      let path = `M${points[0][0]} ${points[0][1]}`;
      if (points.length === 1) path += "l.01 .01";
      else {
        for (let i = 1; i < points.length - 1; i++) {
          path += `Q${points[i][0]} ${points[i][1]} ${
            (points[i][0] + points[i + 1][0]) / 2
          } ${(points[i][1] + points[i + 1][1]) / 2}`;
        }
        path += `L${points.at(-1)![0]} ${points.at(-1)![1]}`;
      }
      pieces.push(
        `<path d="${path}" stroke="${e.color}" stroke-width="${size}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
      continue;
    }
    const x = number(e.x, 0, 950),
      y = number(e.y, 0, 1350),
      width = number(e.width, 40, 1000),
      height = number(e.height, 40, 1400);
    if (x + width > 1000 || y + height > 1400) {
      throw new Error("invalid_notebook");
    }
    const clip =
      `<clipPath id="piece${index}"><rect x="${x}" y="${y}" width="${width}" height="${height}"/></clipPath>`;
    if (e.type === "source") {
      const c = object(e.crop),
        cx = number(c.x, 0, 1),
        cy = number(c.y, 0, 1),
        cw = number(c.width, .000001, 1),
        ch = number(c.height, .000001, 1);
      if (cx + cw > 1.000001 || cy + ch > 1.000001) {
        throw new Error("invalid_notebook");
      }
      const uri = await resolveImage(
        text(e.sourceId, 36),
        text(e.questionId, 36),
      );
      if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(uri)) {
        throw new Error("source_not_ready");
      }
      pieces.push(
        `${clip}<g clip-path="url(#piece${index})"><image x="${
          x - cx * width / cw
        }" y="${y - cy * height / ch}" width="${width / cw}" height="${
          height / ch
        }" preserveAspectRatio="none" xlink:href="${uri}"/></g>`,
      );
    } else if (e.type === "text") {
      const size = number(e.size, 16, 64), content = text(e.text, 2000);
      // A missing glyph could change the meaning of an answer sent to AI.
      // Fail before provider use instead of rendering tofu or dropping a symbol.
      for (const character of content) {
        const code = character.codePointAt(0)!;
        if (
          !/[\n\r\t]/.test(character) &&
          !fontCoverage.some(([start, end]) => code >= start && code <= end)
        ) throw new Error("notebook_render_failed");
      }
      const lines: string[] = [];
      for (const paragraph of content.split("\n")) {
        let line = "";
        for (const word of paragraph.split(/\s+/)) {
          const candidate = line ? `${line} ${word}` : word;
          if (measure(candidate, size) <= width) line = candidate;
          else {
            if (line) lines.push(line);
            line = "";
            for (const character of word) {
              if (line && measure(line + character, size) > width) {
                lines.push(line);
                line = "";
              }
              line += character;
            }
          }
        }
        lines.push(line);
      }
      // Never silently hide part of the student's typed answer in the AI image.
      if (lines.length * size * 1.4 > height + 1) {
        throw new Error("notebook_render_failed");
      }
      pieces.push(
        `${clip}<text font-family="${fontFamily}" font-size="${size}" fill="${e.color}" clip-path="url(#piece${index})">${
          lines.map((line, i) =>
            `<tspan x="${x}" y="${y + size + i * size * 1.4}">${
              escape(line)
            }</tspan>`
          ).join("")
        }</text>`,
      );
    } else throw new Error("invalid_notebook");
  }
  return shell(pieces.join(""));
}
export async function renderSvg(svg: string): Promise<Uint8Array> {
  await initialize();
  const r = new Resvg(svg, options());
  try {
    const image = r.render();
    try {
      return image.asPng().slice();
    } finally {
      image.free();
    }
  } finally {
    r.free();
  }
}
export async function renderReviewNotebook(
  db: SupabaseClient,
  family: string,
  question: string,
  document: unknown,
): Promise<Uint8Array> {
  const images = new Map<string, string>();
  let total = 0;
  const svg = await notebookSvg(document, async (id, q) => {
    if (q !== question) throw new Error("source_not_ready");
    if (images.has(id)) return images.get(id)!;
    if (images.size >= 3) throw new Error("source_ai_limit");
    const [link, source] = await Promise.all([
      db.from("learning_source_links").select("source_id").eq("source_id", id)
        .eq("question_id", question).maybeSingle(),
      db.from("learning_sources").select(
        "object_path,mime,bytes,sha256,width,height",
      ).eq("id", id).eq("family_id", family).eq("kind", "question_image").eq(
        "status",
        "ready",
      ).single(),
    ]);
    if (link.error || !link.data || source.error || !source.data) {
      throw new Error("source_not_ready");
    }
    const s = source.data;
    total += s.bytes;
    if (total > 12 * 1024 * 1024 || s.width * s.height > 4_000_000) {
      throw new Error("source_ai_limit");
    }
    const blob = await readSourceBlob(db, id, s.object_path);
    if (blob.size !== s.bytes) throw new Error("source_not_ready");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const info = await inspectSource(bytes, s.mime);
    if (
      info.hash !== s.sha256 || info.width !== s.width ||
      info.height !== s.height
    ) throw new Error("source_not_ready");
    let binary = "";
    for (let at = 0; at < bytes.length; at += 8192) {
      binary += String.fromCharCode(...bytes.subarray(at, at + 8192));
    }
    const uri = `data:${s.mime};base64,${btoa(binary)}`;
    images.set(id, uri);
    return uri;
  });
  return renderSvg(svg);
}
