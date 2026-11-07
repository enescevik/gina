/**
 * Official MEB/ÖDSGM source acquisition policy (M01). Mirrors scripts/fetch-curriculum-sources.py.
 * HTTPS only; allow-listed official hosts; `meb.ai` only as a redirect hop for links read from the official
 * index page; every hop re-checks host + resolved public IPs; 15 s / 5 MB; bounded ZIP directory inspection.
 * Nothing inside a page or workbook is executed or treated as an instruction.
 */
/**
 * Index page live-checked on 2026-11-05 (M01). The Edge Function no longer reads this map: it resolves the page
 * from the admin-managed registry (`get_curriculum_source_target`), seeded with this same row. Kept as the
 * reference value for tests and the Python operator tool.
 */
export const INDEX_PAGES: Record<string, string> = {
  "oyss:2026-2027:1":
    "https://odsgm.meb.gov.tr/www/1donem-konu-soru-dagilim-tablolari-2026-2027/icerik/1724",
};
export const FINAL_HOSTS = ["odsgm.meb.gov.tr", "meb.gov.tr", "cdn.eba.gov.tr"];
export const REDIRECT_ONLY_HOSTS = ["meb.ai"];
export const MAX_HOPS = 5;
export const TIMEOUT_MS = 15_000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_PAGE_BYTES = 2 * 1024 * 1024;
export const MAX_ZIP_ENTRIES = 500;
export const MAX_ZIP_EXPANSION = 40_000_000;
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ACCEPTED_MIMES = new Set([
  XLSX_MIME,
  "application/octet-stream",
  "application/zip",
]);

export class PolicyError extends Error {}
const fail = (code: string): never => {
  throw new PolicyError(code);
};

export type Resolver = (host: string) => Promise<string[]>;
export type Transport = (
  url: string,
  init: { signal: AbortSignal; redirect: "manual" },
) => Promise<Response>;

export function hostAllowed(host: string, final: boolean) {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (!h) return false;
  if (FINAL_HOSTS.some((a) => h === a || h.endsWith("." + a))) return true;
  return !final && REDIRECT_ONLY_HOSTS.includes(h);
}

/** Rejects loopback, private, link-local, multicast, unspecified, reserved and IPv4-mapped equivalents. */
export function ipIsPublic(address: string): boolean {
  let ip = address.trim().toLowerCase();
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) ip = mapped[1];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if ([a, b].some((n) => n > 255)) return false;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (!ip.includes(":")) return false;
  const expanded = ip.replace(/^\[|\]$/g, "");
  if (expanded === "::" || expanded === "::1") return false;
  const head = expanded.split(":")[0] || "0";
  const first = parseInt(head.padStart(4, "0"), 16);
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link local
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (expanded.startsWith("::") || expanded.startsWith("0:")) return false;
  return true;
}

export async function checkUrl(
  raw: string,
  final: boolean,
  resolve: Resolver,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail("url_invalid");
  }
  if (url.protocol !== "https:") fail("https_required");
  if (url.username || url.password || (url.port && url.port !== "443")) {
    fail("url_authority_rejected");
  }
  if (!hostAllowed(url.hostname, final)) {
    fail("host_not_allowed:" + url.hostname);
  }
  let addresses: string[];
  try {
    addresses = await resolve(url.hostname);
  } catch (e) {
    // Fail closed: a runtime without a DNS API cannot prove the address is public, so nothing is requested.
    if (e instanceof PolicyError && e.message === "dns_unavailable") {
      return fail("dns_unavailable:" + url.hostname);
    }
    return fail("dns_failed:" + url.hostname);
  }
  if (!addresses.length || !addresses.every(ipIsPublic)) {
    fail("non_public_address:" + url.hostname);
  }
  return url;
}

export const denoResolver: Resolver = async (host) => {
  const api = (Deno as unknown as { resolveDns?: unknown }).resolveDns;
  if (typeof api !== "function") throw new PolicyError("dns_unavailable");
  const results = await Promise.allSettled([
    Deno.resolveDns(host, "A"),
    Deno.resolveDns(host, "AAAA"),
  ]);
  const addresses = results.flatMap((r) =>
    r.status === "fulfilled" ? r.value : []
  );
  if (!addresses.length) throw new PolicyError("dns_failed:" + host);
  return addresses;
};

async function readBounded(response: Response, max: number, signal?: AbortSignal) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > max) fail("size_limit");
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  // C13-SCAN-3: a stalled body must not outlive the request deadline, whatever the transport does with the signal.
  const aborted = new Promise<never>((_, reject) => {
    const stop = () => {
      reject(new DOMException("aborted", "AbortError"));
      reader.cancel().catch(() => {});
    };
    if (signal?.aborted) stop();
    else signal?.addEventListener("abort", stop, { once: true });
  });
  aborted.catch(() => {});
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { value, done } = signal ? await Promise.race([reader.read(), aborted]) : await reader.read();
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      fail("size_limit");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export interface FetchedSource {
  finalUrl: string;
  chain: { url: string; status: number }[];
  mime: string;
  body: Uint8Array;
}
/** Follows at most MAX_HOPS redirects manually; each hop validated before any request is sent. */
export async function fetchWithPolicy(
  start: string,
  options: {
    transport?: Transport;
    resolve?: Resolver;
    maxBytes?: number;
    timeoutMs?: number;
  } = {},
): Promise<FetchedSource> {
  const transport = options.transport ?? ((u, init) => fetch(u, init));
  const resolve = options.resolve ?? denoResolver;
  const maxBytes = options.maxBytes ?? MAX_FILE_BYTES;
  const chain: { url: string; status: number }[] = [];
  let current = start;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    await checkUrl(current, false, resolve);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? TIMEOUT_MS,
    );
    let response: Response;
    try {
      response = await transport(current, {
        signal: controller.signal,
        redirect: "manual",
      });
    } catch (e) {
      clearTimeout(timer);
      fail(
        controller.signal.aborted
          ? "timeout"
          : "network_error:" + (e instanceof Error ? e.name : "unknown"),
      );
    }
    // C13-SCAN-3: the same deadline covers the body read (a slow body after fast headers cannot hang the worker).
    try {
      chain.push({ url: current, status: response!.status });
      if ([301, 302, 303, 307, 308].includes(response!.status)) {
        const location = response!.headers.get("location");
        await response!.body?.cancel();
        if (!location) fail("redirect_without_location");
        current = new URL(location!, current).toString();
        continue;
      }
      if (response!.status !== 200) fail("http_status:" + response!.status);
      await checkUrl(current, true, resolve);
      let body: Uint8Array;
      try {
        body = await readBounded(response!, maxBytes, controller.signal);
      } catch (e) {
        if (e instanceof PolicyError) throw e;
        return fail(controller.signal.aborted ? "timeout" : "network_error:" + (e instanceof Error ? e.name : "unknown"));
      }
      const mime = (response!.headers.get("content-type") ?? "").split(";")[0]
        .trim().toLowerCase();
      return { finalUrl: current, chain, mime, body };
    } finally {
      clearTimeout(timer);
    }
  }
  return fail("too_many_redirects");
}

export interface WorkbookInspection {
  mime: string;
  entries: number;
  expansion: number;
  flags: string[];
}
/** ZIP central directory only: names and sizes. No decompression, no XML, no formulas, no macros. */
export function inspectXlsx(
  body: Uint8Array,
  mime: string,
): WorkbookInspection {
  if (mime && !ACCEPTED_MIMES.has(mime)) fail("mime_rejected:" + mime);
  if (body.length < 22 || body[0] !== 0x50 || body[1] !== 0x4b) {
    fail("not_a_zip");
  }
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let eocd = -1;
  for (let i = body.length - 22; i >= Math.max(0, body.length - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) fail("zip_eocd_missing");
  const count = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (count > MAX_ZIP_ENTRIES) fail("zip_entries_limit");
  if (cdOffset + cdSize > body.length) fail("zip_directory_invalid");
  const names: string[] = [];
  let pos = cdOffset, expansion = 0;
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (pos + 46 > body.length || view.getUint32(pos, true) !== 0x02014b50) {
      fail("zip_directory_invalid");
    }
    const uncompressed = view.getUint32(pos + 24, true);
    const nameLen = view.getUint16(pos + 28, true);
    const extraLen = view.getUint16(pos + 30, true);
    const commentLen = view.getUint16(pos + 32, true);
    const name = decoder.decode(body.subarray(pos + 46, pos + 46 + nameLen));
    if (name.startsWith("/") || name.split("/").includes("..")) {
      fail("zip_path_rejected");
    }
    expansion += uncompressed;
    if (expansion > MAX_ZIP_EXPANSION) fail("workbook_expansion_limit");
    names.push(name);
    pos += 46 + nameLen + extraLen + commentLen;
  }
  if (!names.includes("xl/workbook.xml")) fail("workbook_missing");
  const flags: string[] = [];
  if (names.some((n) => n.toLowerCase().endsWith("vbaproject.bin"))) {
    flags.push("macro_present");
  }
  if (names.some((n) => n.startsWith("xl/externalLinks/"))) {
    flags.push("external_links_present");
  }
  return { mime: mime || XLSX_MIME, entries: names.length, expansion, flags };
}

export interface IndexLink {
  href: string;
  text: string;
}
// Decode exactly once: replacement output is not parsed as another entity.
const HTML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const decodeEntities = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => HTML_ENTITIES[name]);
/** Anchors and publish/update dates. Page text is data; it never widens the host policy. */
export function parseIndex(page: string) {
  const links: IndexLink[] = [];
  for (
    const m of page.matchAll(
      /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    )
  ) {
    links.push({
      href: decodeEntities(m[1]).trim(),
      text: decodeEntities(m[2].replace(/<[^>]+>/g, " ")).split(/\s+/).join(
        " ",
      ).trim(),
    });
  }
  const dates: { published?: string; updated?: string } = {};
  for (
    const [pattern, key] of [
      [/yay[ıi]n[^0-9]{0,40}(\d{1,2})[./](\d{1,2})[./](\d{4})/i, "published"],
      [/g[üu]ncelle[^0-9]{0,40}(\d{1,2})[./](\d{1,2})[./](\d{4})/i, "updated"],
    ] as const
  ) {
    const m = page.match(pattern);
    if (m) {
      dates[key] = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
  }
  return { links, dates };
}

export function normalizeSubject(value: string) {
  return value.toLocaleLowerCase("tr").replace(/i̇/g, "i").replace(/\s+/g, " ")
    .trim();
}
/** Links whose visible text names the subject. Several matches (e.g. ortaokul/lise İngilizce) stay ambiguous. */
export function matchSubjectLinks(links: IndexLink[], subject: string) {
  const wanted = normalizeSubject(subject);
  const aliases = new Set([wanted]);
  if (wanted === "matematik") aliases.add("ilköğretim matematik");
  if (wanted === "fen bilimleri") aliases.add("fen");
  return links.filter((l) => aliases.has(normalizeSubject(l.text)));
}

export async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes as Uint8Array<ArrayBuffer>,
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("");
}
