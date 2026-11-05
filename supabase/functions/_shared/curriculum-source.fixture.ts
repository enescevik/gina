/** Test-only helpers: a stored (uncompressed) ZIP builder and in-memory transports for the source policy. */
import type { Resolver, Transport } from "./curriculum-source.ts";

export function buildZip(
  entries: { name: string; size?: number; declaredSize?: number }[],
): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const data = new Uint8Array(e.size ?? 1);
    const size = e.declaredSize ?? data.length;
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const cdSize = centrals.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cdSize + 22);
  let at = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

export const workbook = (extra: string[] = [], size = 1) =>
  buildZip([{ name: "xl/workbook.xml" }, ...extra.map((name) => ({ name, size }))]);

export const publicResolver: Resolver = () => Promise.resolve(["193.140.1.1"]);

export type Route = { status: number; headers?: Record<string, string>; body?: Uint8Array | string };
export function transportFor(routes: Record<string, Route>) {
  const calls: string[] = [];
  const transport: Transport = (url) => {
    calls.push(url);
    const route = routes[url];
    if (!route) return Promise.reject(new TypeError("unroutable"));
    const body = typeof route.body === "string" ? new TextEncoder().encode(route.body) : route.body ?? new Uint8Array();
    return Promise.resolve(
      new Response(route.status === 204 ? null : body as Uint8Array<ArrayBuffer>, { status: route.status, headers: route.headers ?? {} }),
    );
  };
  return { transport, calls };
}
