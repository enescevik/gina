/**
 * H02: server-side port of scripts/extract-meb-scenarios.py + build-curriculum-candidates.py + prepare-curriculum-review.py
 * (the `extraction_result` path of scripts/fetch-curriculum-sources.py). Same input bytes → the same review-only
 * candidate bundle as the Python extractor (parity proven on the 16 official 2026–2027/1 files, see
 * scripts/test-meb-extract-parity.py). Reads only ZIP/XML: no formula evaluation, no external links, no macros,
 * no DTD/entities; workbook text is data, never an instruction. Nothing here approves, publishes or picks a scenario.
 *
 * Python semantics reproduced on purpose: Unicode `\s`/`\d`/`\b` of `re`, `str.split()` whitespace, `int()` of
 * Unicode digits, dict insertion order, first-maximum `max()`, code point string ordering.
 * Deliberate differences (fail closed, never a different candidate): DOCTYPE/entity declarations, non-UTF-8 XML,
 * ZIP64/encrypted/non-deflate entries are refused; inputs that crash the Python tool (TypeError/IndexError) are a
 * recorded `failed` verdict here.
 */

export const EXTRACTOR_VERSION = "extract-meb-scenarios@h02-deno";
const MAX_EXPANSION = 40_000_000;
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** Python ValueError/KeyError/BadZipFile/ParseError: a reasoned `failed` verdict (message mirrors Python's str(e)). */
export class ExtractError extends Error {}
const fail = (message: string): never => {
  throw new ExtractError(message);
};

// ---------------------------------------------------------------- Python text semantics
const WS = "\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const S = `[${WS}]`;
const D = "\\p{Nd}";
const WORD = "[\\p{L}\\p{N}_]";
const SPLIT = new RegExp(`${S}+`, "u");
const ND = /^\p{Nd}$/u;
/** `" ".join(text.split())` */
export const collapse = (t: string) => t.split(SPLIT).filter(Boolean).join(" ");
const strip = (t: string) => t.replace(new RegExp(`^${S}+|${S}+$`, "gu"), "");
/** Value of one Unicode decimal digit: Nd characters come in contiguous 0–9 runs (Unicode stability policy). */
function digitValue(ch: string) {
  const cp = ch.codePointAt(0)!;
  let k = 0;
  while (k < 64 && cp - k - 1 >= 0 && ND.test(String.fromCodePoint(cp - k - 1))) k++;
  return k % 10;
}
/** Python `int(str)` (base 10): surrounding whitespace, sign, single underscores, Unicode digits. */
export function pyInt(text: string): number {
  const m = new RegExp(`^${S}*([+-]?)(${D}+(?:_${D}+)*)${S}*$`, "u").exec(text);
  if (!m) return fail(`invalid literal for int() with base 10: ${pyRepr(text)}`);
  let n = 0;
  for (const ch of m[2]) if (ch !== "_") n = n * 10 + digitValue(ch);
  return m[1] === "-" ? -n : n;
}
const pyRepr = (s: string) => (s.includes("'") && !s.includes('"') ? `"${s}"` : `'${s.replace(/'/g, "\\'")}'`);
/** Code point order (Python str comparison), not UTF-16 unit order. */
export function cmp(a: string, b: string) {
  const x = Array.from(a), y = Array.from(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
    if (d) return d;
  }
  return x.length - y.length;
}
const lower = (s: string) => s.toLowerCase();

// Patterns of extract-meb-scenarios.py, Python-Unicode equivalent.
const RX = {
  coord: /^([A-Z]+)([0-9]+)$/,
  grade: new RegExp(`(?<!${WORD})(1[0-2]|[1-9])${S}*\\.?${S}*[SsSİıiI]`, "u"),
  gradeOnly: /^(1[0-2]|[1-9])$/,
  scenario: new RegExp(`^Senaryo${S}+${D}+$`, "iu"),
  code: new RegExp(`^((?:[A-ZÇĞİÖŞÜ]+(?:\\.[A-ZÇĞİÖŞÜ]+)*[.${WS}]*)?${D}+(?:\\.[A-Za-z0-9]+)+\\.?)${S}`, "u"),
  exam: new RegExp(`Dönem${S}+${D}+\\.${S}*Ortak`, "iu"),
  digits: new RegExp(`^${D}+$`, "u"),
  count: new RegExp(`^[1-9]${D}?$`, "u"),
  stem: /^[a-z0-9_]{1,60}$/,
  year: /^20\d{2}-20\d{2}$/,
  examScope: /^([12])\. Dönem ([12])\. Ortak Yazılı Sınav$/,
  sha: /^[a-f0-9]{64}$/,
  cell: /^[A-Z]+[1-9][0-9]*$/,
};

const COORDS = new Map<string, [number, number]>();
function coord(value: string | null): [number, number] {
  if (typeof value !== "string") return fail("expected string or bytes-like object, got 'NoneType'");
  const known = COORDS.get(value);
  if (known) return known;
  const m = RX.coord.exec(value);
  if (!m) return fail("cell_reference");
  let col = 0;
  for (const letter of m[1]) col = col * 26 + letter.charCodeAt(0) - 64;
  const result: [number, number] = [col, Number(m[2])];
  if (COORDS.size > 200_000) COORDS.clear();
  COORDS.set(value, result);
  return result;
}

// ---------------------------------------------------------------- ZIP (Python zipfile subset)
interface ZipEntry {
  name: string;
  method: number;
  flags: number;
  crc: number;
  compressed: number;
  size: number;
  offset: number;
}
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export class Zip {
  readonly entries = new Map<string, ZipEntry>();
  private view: DataView;
  private concat = 0;
  constructor(private body: Uint8Array) {
    this.view = new DataView(body.buffer, body.byteOffset, body.byteLength);
    const eocd = this.findEocd();
    const v = this.view;
    if (v.getUint16(eocd + 4, true) !== 0 || v.getUint16(eocd + 6, true) !== 0) fail("zip_multidisk_unsupported");
    const count = v.getUint16(eocd + 10, true), cdSize = v.getUint32(eocd + 12, true), cdOffset = v.getUint32(eocd + 16, true);
    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) fail("zip64_unsupported");
    // zipfile tolerates data prepended to the archive ("concat"); the directory end tells where it really starts.
    this.concat = eocd - cdSize - cdOffset;
    let pos = cdOffset + this.concat;
    if (pos < 0) fail("Bad offset for central directory");
    const end = pos + cdSize;
    const decoder = new TextDecoder("utf-8", { fatal: false });
    while (pos < end) {
      if (pos + 46 > end) fail("Truncated central directory");
      if (v.getUint32(pos, true) !== 0x02014b50) fail("Bad magic number for central directory");
      const flags = v.getUint16(pos + 8, true), method = v.getUint16(pos + 10, true);
      const crc = v.getUint32(pos + 16, true), compressed = v.getUint32(pos + 20, true), size = v.getUint32(pos + 24, true);
      const nameLen = v.getUint16(pos + 28, true), extraLen = v.getUint16(pos + 30, true), commentLen = v.getUint16(pos + 32, true);
      const offset = v.getUint32(pos + 42, true);
      const raw = body.subarray(pos + 46, pos + 46 + nameLen);
      // zipfile: UTF-8 when flag bit 11 is set, otherwise cp437 (ASCII is identical in both).
      const name = flags & 0x800 ? decoder.decode(raw) : cp437(raw);
      if (compressed === 0xffffffff || size === 0xffffffff || offset === 0xffffffff) fail("zip64_unsupported");
      this.entries.set(name, { name, method, flags, crc, compressed, size, offset });
      pos += 46 + nameLen + extraLen + commentLen;
    }
  }
  private findEocd() {
    const b = this.body;
    if (b.length < 22) fail("File is not a zip file");
    const sig = (i: number) => b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06;
    if (sig(b.length - 22) && b[b.length - 2] === 0 && b[b.length - 1] === 0) return b.length - 22;
    // zipfile: last signature within the final 64 KiB + 22 bytes; a record cut short is "not a zip file".
    for (let i = b.length - 4; i >= Math.max(0, b.length - 65536 - 22); i--) {
      if (sig(i)) return i + 22 <= b.length ? i : fail("File is not a zip file");
    }
    return fail("File is not a zip file");
  }
  names() {
    return [...this.entries.keys()];
  }
  totalSize() {
    let n = 0;
    for (const e of this.entries.values()) n += e.size;
    return n;
  }
  async read(name: string): Promise<Uint8Array> {
    const e = this.entries.get(name);
    if (!e) return fail(`"There is no item named ${pyRepr(name)} in the archive"`);
    const v = this.view, at = e.offset + this.concat;
    if (at < 0 || at + 30 > this.body.length) fail("Truncated file header");
    if (v.getUint32(at, true) !== 0x04034b50) fail("Bad magic number for file header");
    const localFlags = v.getUint16(at + 6, true);
    const localRaw = this.body.subarray(at + 30, at + 30 + v.getUint16(at + 26, true));
    const localName = localFlags & 0x800 ? new TextDecoder().decode(localRaw) : cp437(localRaw);
    if (localName !== e.name) fail(`File name in directory ${pyRepr(e.name)} and header ${pyRepr(localName)} differ.`);
    if (e.flags & 0x1) fail(`File ${pyRepr(name)} is encrypted, password required for extraction`);
    const nameLen = v.getUint16(at + 26, true), extraLen = v.getUint16(at + 28, true);
    const start = at + 30 + nameLen + extraLen;
    if (start + e.compressed > this.body.length) fail("Truncated file header");
    const data = this.body.subarray(start, start + e.compressed);
    let out: Uint8Array;
    if (e.method === 0) out = data.slice(0, e.size);
    else if (e.method === 8) out = await inflateRaw(data, e.size, name);
    else return fail("compression_unsupported");
    if (out.length !== e.size || crc32(out) !== e.crc) fail(`Bad CRC-32 for file ${pyRepr(name)}`);
    return out;
  }
}
const CP437_HIGH =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";
const cp437 = (raw: Uint8Array) => Array.from(raw, (b) => (b < 128 ? String.fromCharCode(b) : CP437_HIGH[b - 128])).join("");

/** Raw DEFLATE with a hard output cap: a lying size field cannot expand past the declared size. */
async function inflateRaw(data: Uint8Array, size: number, name: string) {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const out = new Uint8Array(size);
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (total + value.length > size) {
        await reader.cancel().catch(() => {});
        return fail(`Bad CRC-32 for file ${pyRepr(name)}`);
      }
      out.set(value, total);
      total += value.length;
    }
  } catch (e) {
    if (e instanceof ExtractError) throw e;
    return fail("Error -3 while decompressing data");
  }
  return out.subarray(0, total);
}

// ---------------------------------------------------------------- XML (ElementTree subset, namespace-aware)
export interface XmlElement {
  ns: string | null;
  local: string;
  attrs: Map<string, string>; // "{ns}local" or "local"
  children: (XmlElement | string)[];
}
const NAME = /^[A-Za-z_À-￿][\w.\-·À-￿]*(?::[A-Za-z_À-￿][\w.\-·À-￿]*)?$/;
const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
function decodeRefs(s: string, at: number) {
  return s.replace(/&([^;&<]*);|&/g, (m, body: string | undefined) => {
    if (body === undefined) return fail(`not well-formed (invalid token): offset ${at}`);
    if (body in ENTITIES) return ENTITIES[body];
    const num = /^#(?:x([0-9a-fA-F]+)|([0-9]+))$/.exec(body);
    if (num) {
      const cp = num[1] ? parseInt(num[1], 16) : parseInt(num[2], 10);
      if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) || (cp < 0x20 && ![9, 10, 13].includes(cp))) {
        return fail(`reference to invalid character number: offset ${at}`);
      }
      return String.fromCodePoint(cp);
    }
    return fail(`undefined entity ${m}: offset ${at}`);
  });
}
/** Parses one UTF-8 XML document like expat + ElementTree (comments/PIs dropped, CDATA literal, CRLF → LF). */
export function parseXml(bytes: Uint8Array): XmlElement {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return fail("not well-formed (invalid token): line 1, column 0");
  }
  text = text.replace(/\r\n?/g, "\n");
  const decl = /^<\?xml\s[^?]*\?>/.exec(text);
  if (decl) {
    const enc = /encoding\s*=\s*["']([^"']+)["']/.exec(decl[0]);
    if (enc && !/^utf-?8$/i.test(enc[1])) fail("xml_encoding_unsupported");
  }
  let i = 0;
  const stack: { el: XmlElement; scope: Map<string, string>; qname: string }[] = [];
  let root: XmlElement | null = null;
  const top = () => stack[stack.length - 1];
  while (i < text.length) {
    const lt = text.indexOf("<", i);
    const chunk = lt < 0 ? text.slice(i) : text.slice(i, lt);
    if (chunk) {
      if (!stack.length) {
        if (chunk.trim()) fail(root ? `junk after document element: offset ${i}` : `syntax error: offset ${i}`);
      } else {
        if (chunk.includes("]]>")) fail(`not well-formed (invalid token): offset ${i}`);
        top().el.children.push(decodeRefs(chunk, i));
      }
    }
    if (lt < 0) break;
    i = lt;
    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end < 0) fail(`unclosed token: offset ${i}`);
      i = end + 3;
    } else if (text.startsWith("<![CDATA[", i)) {
      const end = text.indexOf("]]>", i + 9);
      if (end < 0 || !stack.length) fail(`unclosed CDATA section: offset ${i}`);
      top().el.children.push(text.slice(i + 9, end));
      i = end + 3;
    } else if (text.startsWith("<?", i)) {
      const end = text.indexOf("?>", i + 2);
      if (end < 0) fail(`unclosed token: offset ${i}`);
      i = end + 2;
    } else if (text.startsWith("<!", i)) {
      // DOCTYPE / entity declarations are refused (no entity expansion of any kind).
      return fail("xml_doctype_rejected");
    } else if (text.startsWith("</", i)) {
      const end = text.indexOf(">", i);
      if (end < 0) fail(`unclosed token: offset ${i}`);
      const qname = text.slice(i + 2, end).trim();
      const open = stack.pop();
      if (!open || open.qname !== qname) fail(`mismatched tag: offset ${i}`);
      if (!stack.length) root = open!.el;
      i = end + 1;
    } else {
      // Start tag: name, attributes (quoted values may contain '>'), optional self-close.
      let j = i + 1;
      const nameMatch = /^[^\s/>]+/.exec(text.slice(j, j + 512));
      if (!nameMatch) return fail(`not well-formed (invalid token): offset ${i}`);
      const qname = nameMatch[0];
      if (!NAME.test(qname)) fail(`not well-formed (invalid token): offset ${i}`);
      j += qname.length;
      const rawAttrs: [string, string][] = [];
      let selfClose = false;
      for (;;) {
        const ws = /^\s*/.exec(text.slice(j, j + 4096))![0];
        j += ws.length;
        if (text[j] === ">") {
          j++;
          break;
        }
        if (text.startsWith("/>", j)) {
          selfClose = true;
          j += 2;
          break;
        }
        if (!ws.length) fail(`not well-formed (invalid token): offset ${j}`);
        const am = /^([^\s=/>]+)\s*=\s*(["'])/.exec(text.slice(j, j + 1024));
        if (!am) return fail(`not well-formed (invalid token): offset ${j}`);
        if (!NAME.test(am[1])) fail(`not well-formed (invalid token): offset ${j}`);
        const vStart = j + am[0].length;
        const vEnd = text.indexOf(am[2], vStart);
        if (vEnd < 0) fail(`unclosed token: offset ${j}`);
        const rawValue = text.slice(vStart, vEnd);
        if (rawValue.includes("<")) fail(`not well-formed (invalid token): offset ${vStart}`);
        if (rawAttrs.some(([n]) => n === am[1])) fail(`duplicate attribute: offset ${j}`);
        // Attribute-value normalization: literal tab/newline become spaces; character references are kept.
        rawAttrs.push([am[1], decodeRefs(rawValue.replace(/[\t\n]/g, " "), vStart)]);
        j = vEnd + 1;
      }
      if (!stack.length && root) fail(`junk after document element: offset ${i}`);
      const scope = new Map(stack.length ? top().scope : [["xml", "http://www.w3.org/XML/1998/namespace"]]);
      for (const [n, v] of rawAttrs) {
        if (n === "xmlns") scope.set("", v);
        else if (n.startsWith("xmlns:")) scope.set(n.slice(6), v);
      }
      const resolve = (q: string, isAttr: boolean): { ns: string | null; local: string } => {
        const c = q.indexOf(":");
        if (c < 0) return { ns: isAttr ? null : (scope.get("") || null), local: q };
        const prefix = q.slice(0, c);
        if (!scope.has(prefix)) return fail(`unbound prefix: offset ${i}`);
        return { ns: scope.get(prefix)!, local: q.slice(c + 1) };
      };
      const name = resolve(qname, false);
      const attrs = new Map<string, string>();
      for (const [n, v] of rawAttrs) {
        if (n === "xmlns" || n.startsWith("xmlns:")) continue;
        const a = resolve(n, true);
        const key = a.ns ? `{${a.ns}}${a.local}` : a.local;
        if (attrs.has(key)) fail(`duplicate attribute: offset ${i}`);
        attrs.set(key, v);
      }
      const el: XmlElement = { ns: name.ns, local: name.local, attrs, children: [] };
      if (stack.length) top().el.children.push(el);
      if (selfClose) {
        if (!stack.length) root = el;
      } else stack.push({ el, scope, qname });
      i = j;
    }
  }
  if (stack.length || !root) fail(stack.length ? "unclosed token" : "no element found: line 1, column 0");
  return root!;
}
const isEl = (n: XmlElement | string): n is XmlElement => typeof n !== "string";
const kids = (el: XmlElement, ns: string | null, local: string) =>
  el.children.filter((c): c is XmlElement => isEl(c) && c.ns === ns && c.local === local);
const find = (el: XmlElement, ns: string, local: string) => kids(el, ns, local)[0] ?? null;
/** ElementTree `.text`: character data before the first child element. */
function textOf(el: XmlElement) {
  let s = "";
  for (const c of el.children) {
    if (isEl(c)) break;
    s += c;
  }
  return s;
}
/** ElementTree `itertext()`. */
function iterText(el: XmlElement): string {
  return el.children.map((c) => (isEl(c) ? iterText(c) : c)).join("");
}
function descendants(el: XmlElement, ns: string, local: string, out: XmlElement[] = []) {
  for (const c of el.children) {
    if (!isEl(c)) continue;
    if (c.ns === ns && c.local === local) out.push(c);
    descendants(c, ns, local, out);
  }
  return out;
}

/** posixpath.normpath */
export function normpath(p: string) {
  if (!p) return ".";
  const initial = p.startsWith("/") ? (p.startsWith("//") && !p.startsWith("///") ? 2 : 1) : 0;
  const out: string[] = [];
  for (const comp of p.split("/")) {
    if (!comp || comp === ".") continue;
    if (comp !== ".." || (!initial && !out.length) || (out.length && out[out.length - 1] === "..")) out.push(comp);
    else if (out.length) out.pop();
  }
  const joined = "/".repeat(initial) + out.join("/");
  return joined || ".";
}

// ---------------------------------------------------------------- extract-meb-scenarios.py :: sheets / extract
type Cells = Map<string | null, string>;
type Merge = [string, [number, number], [number, number]];
async function* sheets(zip: Zip): AsyncGenerator<[string | null, Cells, Merge[], Set<string | null>]> {
  if (zip.totalSize() > MAX_EXPANSION) fail("workbook_expansion_limit");
  let strings: string[] = [];
  if (zip.entries.has("xl/sharedStrings.xml")) {
    strings = kids(parseXml(await zip.read("xl/sharedStrings.xml")), NS, "si").map(iterText);
  }
  const rels = new Map<string | null, string | null>();
  for (const r of parseXml(await zip.read("xl/_rels/workbook.xml.rels")).children.filter(isEl)) {
    if (r.attrs.get("TargetMode") !== "External") rels.set(r.attrs.get("Id") ?? null, r.attrs.get("Target") ?? null);
  }
  const workbook = parseXml(await zip.read("xl/workbook.xml"));
  for (const group of kids(workbook, NS, "sheets")) {
    for (const sheet of kids(group, NS, "sheet")) {
      const rid = sheet.attrs.get(`{${REL}}id`) ?? null;
      if (!rels.has(rid)) fail(rid === null ? "None" : pyRepr(rid));
      let target = rels.get(rid);
      if (typeof target !== "string") return fail("'NoneType' object has no attribute 'startswith'");
      target = target.startsWith("/") ? target.replace(/^\/+/, "") : normpath("xl/" + target);
      if (!target.startsWith("xl/worksheets/")) fail("worksheet_path");
      const root = parseXml(await zip.read(target));
      const cells: Cells = new Map(), formulas = new Set<string | null>();
      for (const data of descendants(root, NS, "sheetData")) {
        for (const row of kids(data, NS, "row")) {
          for (const cell of kids(row, NS, "c")) {
            const ref = cell.attrs.get("r") ?? null;
            const value = find(cell, NS, "v"), inline = find(cell, NS, "is");
            let text = value ? textOf(value) : inline ? iterText(inline) : "";
            if (cell.attrs.get("t") === "s") {
              let n = pyInt(text);
              if (n < 0) n += strings.length;
              if (n < 0 || n >= strings.length) fail("list index out of range");
              text = strings[n];
            }
            cells.set(ref, collapse(text));
            if (find(cell, NS, "f")) formulas.add(ref);
          }
        }
      }
      const merges: Merge[] = [];
      for (const group2 of kids(root, NS, "mergeCells")) {
        for (const merge of kids(group2, NS, "mergeCell")) {
          const ref = merge.attrs.get("ref");
          if (ref === undefined) fail("'NoneType' object has no attribute 'split'");
          const parts = ref!.split(":");
          if (parts.length !== 2) fail(`${parts.length < 2 ? "not enough" : "too many"} values to unpack (expected 2${parts.length < 2 ? `, got ${parts.length}` : ""})`);
          merges.push([parts[0], coord(parts[0]), coord(parts[1])]);
        }
      }
      yield [sheet.attrs.get("name") ?? null, cells, merges, formulas];
    }
  }
}

export interface Outcome {
  cell: string | null;
  text: string;
  code: string | null;
}
export interface Block {
  count: number;
  count_cell: string | null;
  outcomes: Outcome[];
}
export interface Scenario {
  id: string;
  grade: number;
  subject: string;
  sheet: string | null;
  scenario: string;
  exam: string | null;
  source_url: string;
  source_sha256: string;
  header_cell: string | null;
  question_count: number;
  blocks: Block[];
  warnings: string[];
  review_status: "pending_source_review";
  publishable: false;
}
export interface Issue {
  sheet: string | null;
  cell?: string | null;
  reason: string;
}
export interface ExtractSource {
  sha256: string;
  label: string;
  resolved_url: string;
  academic_year?: string;
  term?: number;
  stem?: string;
}

export async function sha256Hex(bytes: Uint8Array) {
  const d = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
const maxBy = <T>(items: T[], key: (t: T) => number) => items.reduce((best, x) => (key(x) > key(best) ? x : best));
function maxTuple(items: [number, string][]) {
  return items.reduce((best, x) => (x[0] > best[0] || (x[0] === best[0] && cmp(x[1], best[1]) > 0) ? x : best));
}

/** extract-meb-scenarios.py :: extract(source, directory) on in-memory bytes. */
export async function extract(source: ExtractSource, body: Uint8Array): Promise<{ scenarios: Scenario[]; issues: Issue[] }> {
  if ((await sha256Hex(body)) !== source.sha256) fail("source_hash_changed");
  const year = source.academic_year ?? "2026-2027", term = source.term ?? 1;
  const stem = source.stem || "source";
  if (!RX.year.test(year) || ![1, 2].includes(term) || !RX.stem.test(stem)) fail("source_scope_invalid");
  const zip = new Zip(body);
  const result: Scenario[] = [], issues: Issue[] = [];
  for await (const [name, cells, merges, formulas] of sheets(zip)) {
    if (typeof name !== "string") fail("expected string or bytes-like object, got 'NoneType'");
    const gradeMatch = RX.grade.exec(name!) ?? RX.gradeOnly.exec(name!);
    if (!gradeMatch) {
      issues.push({ sheet: name, reason: "grade_unresolved" });
      continue;
    }
    const grade = Number(gradeMatch[1]);
    const header = [...cells].filter(([, text]) => RX.scenario.test(text));
    for (const [scenarioRef, label] of header) {
      const [col, headerRow] = coord(scenarioRef);
      const outcomeHeaders: [number, number][] = [];
      for (const [ref, text] of cells) {
        const [c, r] = coord(ref);
        if (r < headerRow && (lower(text).includes("kazan") || lower(text).includes("öğrenme çıktı"))) outcomeHeaders.push([c, r]);
      }
      if (!outcomeHeaders.length) {
        issues.push({ sheet: name, cell: scenarioRef, reason: "outcome_column_unresolved" });
        continue;
      }
      const outcomeCol = maxBy(outcomeHeaders, (h) => h[1])[0];
      const outcomes = new Map<number, Outcome>();
      for (const [ref, text] of cells) {
        const [c, row] = coord(ref);
        if (c === outcomeCol && row > headerRow && text && !text.toUpperCase().startsWith("TOPLAM")) {
          const code = RX.code.exec(text);
          outcomes.set(row, { cell: ref, text, code: code ? code[1].replace(/\.+$/, "") : null });
        }
      }
      const examCandidates: [number, string][] = [];
      for (const [ref, text] of cells) {
        const [c, row] = coord(ref);
        if (row < headerRow && RX.exam.test(text)) {
          const endCol = merges.find(([start]) => start === ref)?.[2][0] ?? c;
          if (c <= col && col <= endCol) examCandidates.push([row, text]);
        }
      }
      const exam = examCandidates.length ? maxTuple(examCandidates)[1] : null;
      const blocks: Block[] = [], warnings: string[] = [];
      if (!exam) warnings.push("exam_header_unresolved");
      const lastOutcomeRow = outcomes.size ? Math.max(...outcomes.keys()) : 0;
      for (const [ref, text] of cells) {
        const [c, row] = coord(ref);
        if (c !== col || row <= headerRow || !text) continue;
        const anchor = merges.find(([a]) => a === ref);
        const span: [[number, number], [number, number]] = anchor ? [anchor[1], anchor[2]] : [[c, row], [c, row]];
        const related: Outcome[] = [];
        for (let r = row; r < span[1][1] + 1; r++) if (outcomes.has(r)) related.push(outcomes.get(r)!);
        if (!related.length) {
          if (RX.digits.test(text) && row <= lastOutcomeRow) warnings.push("count_without_outcome:" + ref);
          continue;
        }
        if (formulas.has(ref) || !RX.count.test(text) || span[1][0] !== col) {
          warnings.push("ambiguous_count:" + ref);
          continue;
        }
        if (related.some((o) => o.code === null)) warnings.push("uncoded_outcome:" + ref);
        blocks.push({ count: pyInt(text), count_cell: ref, outcomes: related });
      }
      if (!blocks.length) warnings.push("empty_scenario");
      result.push({
        id: `tr-${year}-t${term}-${stem}-g${grade}-${lower(String(scenarioRef))}`,
        grade,
        subject: source.label,
        sheet: name,
        scenario: label,
        exam,
        source_url: source.resolved_url,
        source_sha256: source.sha256,
        header_cell: scenarioRef,
        question_count: blocks.reduce((n, b) => n + b.count, 0),
        blocks,
        warnings,
        review_status: "pending_source_review",
        publishable: false,
      });
    }
  }
  return { scenarios: result, issues };
}

// ---------------------------------------------------------------- build-curriculum-candidates.py + prepare-curriculum-review.py
interface ExtractionData {
  academic_year: string;
  term: number;
  sources: { sha256: string; resolved_url: string }[];
  issues: (Issue & { file: string })[];
  scenarios: Scenario[];
}
/** Only what prepare() consumes from build(): every validation, plus per-outcome review reasons. */
function buildReasons(data: ExtractionData) {
  const sources = new Set<string>();
  for (const s of data.sources) {
    const key = JSON.stringify([s.resolved_url, s.sha256]);
    if (!RX.sha.test(s.sha256) || sources.has(key)) fail("invalid_source");
    sources.add(key);
  }
  const outcomes = new Map<string, { code: string | null; variants: Set<string> }>();
  const scenarioOutcomes = new Map<string, string[][]>();
  const seen = new Set<string>();
  for (const sc of data.scenarios) {
    if (seen.has(sc.id)) fail("duplicate_scenario");
    seen.add(sc.id);
    if (!Number.isInteger(sc.grade) || sc.grade < 1 || sc.grade > 12 || !strip(sc.subject)) fail("invalid_scope");
    if (!sources.has(JSON.stringify([sc.source_url, sc.source_sha256]))) fail("unregistered_source");
    const scope = [data.academic_year, data.term, sc.grade, sc.subject];
    const blocks: string[][] = [];
    for (const b of sc.blocks) {
      if (!Number.isInteger(b.count) || b.count < 1 || !b.outcomes.length) fail("invalid_count_block");
      const ids: string[] = [];
      for (const item of b.outcomes) {
        const wording = strip(item.text);
        if (!wording || typeof item.cell !== "string" || !RX.cell.test(item.cell)) fail("invalid_outcome_evidence");
        const identity = item.code ? [item.code] : [null, sc.source_sha256, sc.sheet, item.cell];
        const oid = JSON.stringify([...scope, ...identity]);
        const o = outcomes.get(oid) ?? { code: item.code, variants: new Set<string>() };
        o.variants.add(wording);
        outcomes.set(oid, o);
        ids.push(oid);
      }
      blocks.push(ids);
    }
    if (sc.blocks.reduce((n, b) => n + b.count, 0) !== sc.question_count) fail("question_count_mismatch");
    scenarioOutcomes.set(sc.id, blocks);
  }
  const reasons = new Map<string, string[]>();
  for (const [oid, o] of outcomes) {
    const r = ["source_review_required"];
    if (!o.code) r.push("uncoded_source_instruction");
    if (o.variants.size > 1) r.push("wording_conflict");
    reasons.set(oid, r);
  }
  return { reasons, scenarioOutcomes };
}

export interface ReviewCandidate {
  key: string;
  academic_year: string;
  term: number;
  exam: number;
  grade: number;
  subject: string;
  source_url: string;
  source_sha256: string;
  sheet: string | null;
  header_cell: string | null;
  question_count: number;
  blocks: Block[];
  label: string;
  review_reasons: string[];
}
export function prepare(data: ExtractionData): { schema: "gina.curriculum-review.v1"; candidates: ReviewCandidate[] } {
  const { reasons: outcomeReasons, scenarioOutcomes } = buildReasons(data);
  const candidates: ReviewCandidate[] = [];
  for (const s of data.scenarios) {
    if (typeof s.exam !== "string") fail("exam_scope_unresolved");
    const match = RX.examScope.exec(s.exam!);
    if (!match || Number(match[1]) !== data.term) fail("exam_scope_unresolved");
    const reasons = new Set(["source_review_required", "programme_and_school_scope_required", ...s.warnings]);
    for (const ids of scenarioOutcomes.get(s.id)!) for (const oid of ids) for (const r of outcomeReasons.get(oid)!) reasons.add(r);
    for (const issue of data.issues) if (s.source_url.endsWith("/" + issue.file)) reasons.add(`source_issue:${issue.sheet}:${issue.reason}`);
    candidates.push({
      key: s.id,
      academic_year: data.academic_year,
      term: data.term,
      exam: Number(match![2]),
      grade: s.grade,
      subject: s.subject,
      source_url: s.source_url,
      source_sha256: s.source_sha256,
      sheet: s.sheet,
      header_cell: s.header_cell,
      question_count: s.question_count,
      blocks: s.blocks,
      label: s.scenario,
      review_reasons: [...reasons].sort(cmp),
    });
  }
  return { schema: "gina.curriculum-review.v1", candidates };
}

/** PurePosixPath(urlsplit(url).path).stem.lower() */
export function urlStem(url: string) {
  const rest = url.replace(/^[A-Za-z][A-Za-z0-9+.-]*:/, "");
  const afterNetloc = rest.startsWith("//") ? rest.slice(2).replace(/^[^/?#]*/, "") : rest;
  const path = afterNetloc.split(/[?#]/)[0];
  const parts = path.split("/").filter(Boolean);
  const name = parts.length ? parts[parts.length - 1] : "";
  const dot = name.lastIndexOf(".");
  return lower(dot > 0 && dot < name.length - 1 ? name.slice(0, dot) : name);
}

export interface QueueItem {
  sha256: string;
  label: string;
  resolved_url: string;
  school_year: string;
  term: number;
}
export interface ExtractionResult {
  outcome: "done" | "failed";
  extractor: string;
  scenarios: number;
  issues: number;
  error: string | null;
  bundle: ReturnType<typeof prepare> | null;
}
const failedResult = (error: string, issues = 0): ExtractionResult => ({
  outcome: "failed",
  extractor: EXTRACTOR_VERSION,
  scenarios: 0,
  issues,
  error: Array.from(error).slice(0, 300).join(""),
  bundle: null,
});

/** fetch-curriculum-sources.py :: extraction_result — the payload of admin_record_curriculum_extraction. */
export async function extractionResult(item: QueueItem, body: Uint8Array): Promise<ExtractionResult> {
  if ((await sha256Hex(body)) !== item.sha256) return failedResult("hash_changed_since_fetch");
  const source = {
    sha256: item.sha256,
    label: item.label,
    resolved_url: item.resolved_url,
    academic_year: item.school_year,
    term: Number(item.term),
    stem: urlStem(item.resolved_url),
  };
  let bundle, issues: Issue[];
  try {
    const extracted = await extract(source, body);
    issues = extracted.issues;
    bundle = prepare({
      academic_year: item.school_year,
      term: Number(item.term),
      sources: [{ sha256: source.sha256, resolved_url: source.resolved_url }],
      issues: issues.map((i) => ({ file: source.stem + ".xlsx", ...i })),
      scenarios: extracted.scenarios,
    });
  } catch (e) {
    // Every exception is a reasoned verdict; unexpected ones (Python would crash) are labelled, not hidden.
    return failedResult("extract:" + (e instanceof ExtractError ? e.message : "unexpected:" + (e instanceof Error ? e.name : "error")));
  }
  if (!bundle.candidates.length) return failedResult("no_scenarios_found", issues.length);
  return { outcome: "done", extractor: EXTRACTOR_VERSION, scenarios: bundle.candidates.length, issues: issues.length, error: null, bundle };
}

/** json.dumps(sort_keys=True, ensure_ascii=False, separators=(",", ":")) — parity fingerprints only. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).filter((k) => (value as Record<string, unknown>)[k] !== undefined).sort(cmp);
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson((value as Record<string, unknown>)[k])).join(",") + "}";
}
