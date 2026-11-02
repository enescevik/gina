import { PDFDocument } from "npm:pdf-lib@1.17.1";

export const SOURCE_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;
export type SourceType = typeof SOURCE_TYPES[number];
export interface SourceInfo {
  mime: SourceType;
  bytes: number;
  hash: string;
  pages: number;
  width: number | null;
  height: number | null;
}
const fail = (): never => {
  throw new Error("source_invalid");
};
const dimensions = (width: number, height: number) => {
  if (
    !Number.isInteger(width) || !Number.isInteger(height) || width < 1 ||
    height < 1 || width > 8192 || height > 8192 || width * height > 16_000_000
  ) throw new Error("source_dimensions");
  return { width, height };
};
/** Bounded format validation; uploaded bytes are never executed or used as URLs. */
export async function inspectSource(
  bytes: Uint8Array,
  expectedMime: string,
): Promise<SourceInfo> {
  if (
    !SOURCE_TYPES.includes(expectedMime as SourceType) || bytes.length < 24 ||
    bytes.length > (expectedMime === "application/pdf" ? 10 : 4) * 1024 * 1024
  ) throw new Error("source_size_or_type");
  let width: number | null = null, height: number | null = null, pages = 1;
  if (expectedMime === "image/png") {
    if (
      ![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b) ||
      String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
    ) fail();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    ({ width, height } = dimensions(view.getUint32(16), view.getUint32(20)));
    // Walk bounded chunk lengths. Reject truncated or disguised files and animation.
    let at = 8, ended = false;
    while (at + 12 <= bytes.length) {
      const n = view.getUint32(at),
        kind = String.fromCharCode(...bytes.slice(at + 4, at + 8));
      if (n > bytes.length - at - 12 || kind === "acTL") fail();
      at += 12 + n;
      if (kind === "IEND") {
        if (n !== 0 || at !== bytes.length) fail();
        ended = true;
        break;
      }
    }
    if (!ended) fail();
  } else if (expectedMime === "image/jpeg") {
    if (
      bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 ||
      bytes[bytes.length - 1] !== 217
    ) fail();
    let at = 2;
    while (at + 4 <= bytes.length) {
      if (bytes[at++] !== 255) fail();
      while (bytes[at] === 255) at++;
      const marker = bytes[at++];
      if (marker === 218 || marker === 217) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const n = (bytes[at] << 8) | bytes[at + 1];
      if (n < 2 || at + n > bytes.length) fail();
      if ([192, 193, 194].includes(marker)) {
        if (n < 8) fail();
        ({ width, height } = dimensions(
          (bytes[at + 5] << 8) | bytes[at + 6],
          (bytes[at + 3] << 8) | bytes[at + 4],
        ));
        break;
      }
      at += n;
    }
    if (!width || !height) fail();
  } else {
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") fail();
    try {
      const pdf = await PDFDocument.load(bytes, {
        ignoreEncryption: false,
        updateMetadata: false,
        throwOnInvalidObject: true,
      });
      pages = pdf.getPageCount();
      if (pages < 1 || pages > 5) throw new Error("source_page_limit");
      for (const p of pdf.getPages()) {
        const { width: w, height: h } = p.getSize();
        if (
          !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 ||
          w > 3000 || h > 3000
        ) fail();
      }
    } catch (e) {
      if (e instanceof Error && e.message === "source_page_limit") throw e;
      throw new Error("source_pdf_invalid_or_encrypted");
    }
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  const hash = Array.from(
    new Uint8Array(digest),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
  return {
    mime: expectedMime as SourceType,
    bytes: bytes.length,
    hash,
    pages,
    width,
    height,
  };
}
