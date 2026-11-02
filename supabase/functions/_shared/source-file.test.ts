import { PDFDocument } from "npm:pdf-lib@1.17.1";
import { inspectSource } from "./source-file.ts";
const assert = (v: unknown) => {
  if (!v) throw Error("assertion failed");
};
async function rejects(bytes: Uint8Array, mime: string, code: string) {
  try {
    await inspectSource(bytes, mime);
  } catch (e) {
    assert(e instanceof Error && e.message === code);
    return;
  }
  throw Error("should reject");
}
Deno.test("source: recognizes PNG and hashes exact original bytes", async () => {
  const b = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=",
    ),
    (x) => x.charCodeAt(0),
  );
  const info = await inspectSource(b, "image/png");
  assert(info.width === 1 && info.height === 1 && info.hash.length === 64);
  await rejects(b.slice(0, -2), "image/png", "source_invalid");
  await rejects(b, "image/jpeg", "source_invalid");
});
Deno.test("source: rejects type spoofing, oversized images and excessive dimensions", async () => {
  await rejects(
    new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    "image/png",
    "source_invalid",
  );
  await rejects(
    new Uint8Array(4 * 1024 * 1024 + 1),
    "image/jpeg",
    "source_size_or_type",
  );
  const b = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=",
    ),
    (x) => x.charCodeAt(0),
  );
  new DataView(b.buffer).setUint32(16, 100000);
  await rejects(b, "image/png", "source_dimensions");
});
Deno.test("source: accepts five PDF pages and rejects six", async () => {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < 5; i++) pdf.addPage();
  assert(
    (await inspectSource(await pdf.save(), "application/pdf")).pages === 5,
  );
  pdf.addPage();
  await rejects(await pdf.save(), "application/pdf", "source_page_limit");
});
Deno.test("source: corrupt PDF does not reach provider", async () => {
  await rejects(
    new TextEncoder().encode("%PDF-1.7\nThis is not a valid document."),
    "application/pdf",
    "source_pdf_invalid_or_encrypted",
  );
});
