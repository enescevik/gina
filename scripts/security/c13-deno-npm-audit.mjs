#!/usr/bin/env node
// C13: supabase/functions/deno.lock içindeki npm girdilerini npm kayıt defterinin toplu
// duyuru uç noktasına (salt okunur POST) sorar. Gölge package-lock gerektirmez.
// Kullanım: node scripts/security/c13-deno-npm-audit.mjs [deno.lock yolu] > çıktı.json
import { readFileSync } from "node:fs";

const lockPath = process.argv[2] ?? "supabase/functions/deno.lock";
const lock = JSON.parse(readFileSync(lockPath, "utf8"));
const body = {};
for (const key of Object.keys(lock.npm ?? {})) {
  const at = key.lastIndexOf("@");
  const name = key.slice(0, at);
  const version = key.slice(at + 1).split("_")[0];
  (body[name] ??= []).push(version);
}
const res = await fetch("https://registry.npmjs.org/-/npm/v1/security/advisories/bulk", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
  signal: AbortSignal.timeout(20_000),
});
const advisories = res.ok ? await res.json() : null;
const out = {
  lock: lockPath,
  lockVersion: lock.version,
  npmEntries: Object.keys(lock.npm ?? {}).length,
  jsrEntries: Object.keys(lock.jsr ?? {}),
  queried: body,
  httpStatus: res.status,
  advisories,
  findingCount: advisories ? Object.values(advisories).reduce((n, list) => n + list.length, 0) : null,
};
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
process.exitCode = res.ok ? (out.findingCount ? 1 : 0) : 2;
