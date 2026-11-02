import { notebookSvg, renderSvg } from "./review-renderer.ts";
const doc = (elements: unknown[]) => ({
  version: 1,
  width: 1000,
  height: 1400,
  elements,
});
const id = "70000000-0000-4000-8000-000000000001";
const stroke = {
  id,
  type: "stroke",
  size: 4,
  color: "#201951",
  points: [[10, 20], [30, 40], [50, 60]],
};
const text = {
  id,
  type: "text",
  x: 50,
  y: 200,
  width: 800,
  height: 140,
  size: 32,
  color: "#201951",
  text: "6 + 8 + 10 = 24 cm",
};
const unused = () => Promise.reject(new Error("unexpected source"));
async function digest(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice())),
  )
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function rejects(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch {
    return;
  }
  throw new Error("accepted invalid notebook");
}
Deno.test("review renderer: original curved strokes and typed Turkish text become 1000×1400 PNG", async () => {
  const svg = await notebookSvg(
    doc([stroke, { ...text, text: "Üçgenin çevresi: 24 cm" }]),
    unused,
  );
  if (
    !svg.includes("M10 20Q30 40 40 50L50 60") ||
    !svg.includes("Üçgenin çevresi")
  ) throw new Error("content lost");
  const png = await renderSvg(svg);
  const view = new DataView(png.buffer, png.byteOffset);
  if (
    png[0] !== 137 || view.getUint32(16) !== 1000 || view.getUint32(20) !== 1400
  ) throw new Error("bad PNG");
});
Deno.test("review renderer: every notebook math symbol renders distinct visible ink", async () => {
  const seen = new Set([
    await digest(await renderSvg(await notebookSvg(doc([]), unused))),
  ]);
  for (const symbol of "+−×÷=≠≈<>≤≥°∠∥⊥√π²³½¼→Δ") {
    const png = await renderSvg(
      await notebookSvg(doc([{ ...text, text: symbol }]), unused),
    );
    const hash = await digest(png);
    if (seen.has(hash)) throw new Error(`missing/duplicate glyph: ${symbol}`);
    seen.add(hash);
  }
});
Deno.test("review renderer: unsupported glyphs fail closed and bundled font coverage is pinned", async () => {
  try {
    await notebookSvg(doc([{ ...text, text: "2 🦄 + 3" }]), unused);
    throw new Error("unsupported glyph accepted");
  } catch (error) {
    if (
      !(error instanceof Error) || error.message !== "notebook_render_failed"
    ) {
      throw error;
    }
  }
  const root = new URL("../prova-review/assets/", import.meta.url);
  const provenance = JSON.parse(
    await Deno.readTextFile(new URL("provenance.json", root)),
  );
  for (
    const name of [
      "Nunito-SemiBold.ttf",
      "NotoSansMath-Regular.ttf",
      "font-coverage.json",
    ]
  ) {
    if (
      await digest(await Deno.readFile(new URL(name, root))) !==
        provenance.checksums[name]
    ) throw new Error(`font coverage provenance changed: ${name}`);
  }
});
Deno.test("review renderer: source crop uses immutable question reference and fixed frame", async () => {
  let asked = "";
  const source = {
    id,
    type: "source",
    sourceId: id,
    questionId: id,
    x: 50,
    y: 80,
    width: 300,
    height: 200,
    crop: { x: .25, y: .1, width: .5, height: .5 },
  };
  const svg = await notebookSvg(doc([source]), (s, q) => {
    asked = `${s}:${q}`;
    return Promise.resolve(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfS8AAAAASUVORK5CYII=",
    );
  });
  if (
    asked !== `${id}:${id}` ||
    !svg.includes('x="-100" y="40" width="600" height="400"') ||
    !svg.includes("clip-path")
  ) throw new Error("crop changed");
});
Deno.test("review renderer: escapes text and blocks external images/unknown schema", async () => {
  const svg = await notebookSvg(
    doc([{ ...text, text: '<script>alert("x")</script>' }]),
    unused,
  );
  if (svg.includes("<script>")) throw new Error("markup injection");
  await rejects(() => notebookSvg({ ...doc([]), version: 2 }, unused));
  await rejects(() =>
    notebookSvg(doc([{ ...stroke, points: [[1001, 0]] }]), unused)
  );
  await rejects(() =>
    notebookSvg(
      doc([{ ...text, height: 40, text: "lengthy text ".repeat(100) }]),
      unused,
    )
  );
  await rejects(() =>
    notebookSvg(
      doc([{
        id,
        type: "source",
        sourceId: id,
        questionId: id,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        crop: { x: 0, y: 0, width: 1, height: 1 },
      }]),
      () => Promise.resolve("https://private.invalid/image"),
    )
  );
});
