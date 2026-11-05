#!/usr/bin/env node
// S04: kaynaklı eğitim takvimi tohumundan TASLAK takvim kayıtları.
//
// Varsayılan: kuru çalıştırma (DB'ye bağlanmaz). Tohumu okur, kayıtları kademe bazında açar, düşük güvenli
// kayıtları (ör. Düzce) atlar ve kaynaklarıyla raporlar.
// --execute: yalnız İZOLE/yerel bir veritabanında public.admin_import_education_calendar_seed(...,true) çağırır.
//   Sunucu yalnız eksik taslakları oluşturur, yeni il yerlerini pasif açar, hiçbir şeyi YAYIMLAMAZ.
//   Yayın her zaman yönetim panelinde ayrı adımdır.
// --server-preview: aynı RPC'yi p_execute=false ile çağırır (yazmaz).
//
// Kullanım:
//   node scripts/import-education-calendar-draft.mjs [--seed docs/learning/catalog/education-calendars/tr-2026-2027.json] [--json]
//   node scripts/import-education-calendar-draft.mjs --execute --admin-user <uuid> \
//        (--docker supabase_db_gina --database <izole_db> | --db-url postgresql://postgres:...@127.0.0.1:54322/<izole_db>)
// --admin-user: public.operations_members(role='content') ya da admins kaydı olan test kullanıcısı.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const seedPath = resolve(
  opt("--seed") ?? "docs/learning/catalog/education-calendars/tr-2026-2027.json",
);
const execute = args.includes("--execute");
const serverPreview = args.includes("--server-preview");
const asJson = args.includes("--json");
const seed = JSON.parse(readFileSync(seedPath, "utf8"));
if (seed.schema !== "gina.education-calendar-seed.v1")
  throw new Error(`unknown seed schema: ${seed.schema}`);

const STAGES = ["preschool", "primary", "middle", "high", "university"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function valueProblem(v, year) {
  if (!v || typeof v !== "object") return "no_calendar_value";
  const keys = Object.keys(v).sort().join(",");
  if (keys !== "ends_on,source_url,starts_on,terms,title,verified_on") return "calendar_value";
  if (!/^https:\/\/\S+$/.test(v.source_url) || ![v.starts_on, v.ends_on, v.verified_on].every((d) => ISO.test(d))) return "calendar_value";
  if (Number(v.starts_on.slice(0, 4)) !== year || v.ends_on <= v.starts_on) return "calendar_value";
  if (!Array.isArray(v.terms) || v.terms.length < 1 || v.terms.length > 8) return "calendar_value";
  let prev = null;
  for (const t of v.terms) {
    if (!ISO.test(t.starts_on) || !ISO.test(t.ends_on) || t.starts_on < v.starts_on || t.ends_on > v.ends_on || t.ends_on < t.starts_on || (prev && t.starts_on <= prev)) return "calendar_value";
    prev = t.ends_on;
  }
  return null;
}

// Yerel plan: sunucu kararının aynısı değil (var olan kayıtları bilmez) ama atlama/geçerlilik kuralları aynıdır.
const records = [];
for (const rec of seed.calendars) {
  for (const stage of Array.isArray(rec.stage) ? rec.stage : [rec.stage]) {
    let action = "create", reason = null;
    if (rec.confidence !== "high" && rec.confidence !== "medium") [action, reason] = ["skip", "low_confidence"];
    else if (!rec.calendar_value) [action, reason] = ["skip", "no_calendar_value"];
    else if (!STAGES.includes(stage) || rec.academic_year !== seed.academic_year) [action, reason] = ["invalid", "scope"];
    else if (!["country", "region"].includes(rec.place?.kind)) [action, reason] = ["invalid", "place"];
    else {
      const p = valueProblem(rec.calendar_value, seed.academic_year);
      if (p) [action, reason] = ["invalid", p];
    }
    records.push({
      seed_id: rec.id, place: rec.place?.name, place_kind: rec.place?.kind, stage, confidence: rec.confidence,
      action, reason, source_url: rec.calendar_value?.source_url ?? rec.source_url,
      verified_on: rec.calendar_value?.verified_on ?? null, terms: rec.calendar_value?.terms?.length ?? 0,
    });
  }
}
const count = (a) => records.filter((r) => r.action === a).length;
const plan = {
  mode: execute ? "execute" : serverPreview ? "server-preview" : "dry-run",
  seed: seedPath,
  academic_year: seed.academic_year,
  checked_at: seed.checked_at,
  counts: { create: count("create"), skipped: count("skip"), invalid: count("invalid") },
  skipped: records.filter((r) => r.action !== "create"),
  records,
  sources: (seed.sources ?? []).map((s) => ({ id: s.id, url: s.url, accessed_at: s.accessed_at })),
  published: false,
};

if (!execute && !serverPreview) {
  if (asJson) console.log(JSON.stringify(plan, null, 2));
  else {
    console.log(`Kuru çalıştırma — ${seedPath}`);
    console.log(`Yıl ${seed.academic_year}-${seed.academic_year + 1}, kaynak kontrolü ${seed.checked_at}`);
    console.log(`Taslak adayı: ${plan.counts.create} · atlanan: ${plan.counts.skipped} · geçersiz: ${plan.counts.invalid}`);
    for (const r of plan.skipped) console.log(`  atlandı: ${r.place} / ${r.stage} (${r.reason}, güven=${r.confidence})`);
    for (const r of records.filter((x) => x.action === "create"))
      console.log(`  taslak: ${r.place} / ${r.stage} · ${r.terms} dönem · ${r.verified_on} · ${r.source_url}`);
    console.log(`Kaynak sayısı: ${plan.sources.length}. Hiçbir şey yazılmadı ve yayımlanmadı.`);
  }
  process.exit(plan.counts.invalid ? 1 : 0);
}

// --- Veritabanı adımı: yalnız yerel/izole hedef ---
const adminUser = opt("--admin-user");
if (!/^[0-9a-f-]{36}$/.test(adminUser ?? "")) throw new Error("--admin-user <uuid> required");
const docker = opt("--docker");
const database = opt("--database");
const dbUrl = opt("--db-url");
let command;
if (docker) {
  if (!/^[a-z0-9_]+$/.test(database ?? "") || database === "postgres")
    throw new Error("--database <isolated_db> required (not 'postgres')");
  command = ["docker", ["exec", "-i", docker, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database]];
} else if (dbUrl) {
  const host = new URL(dbUrl).hostname;
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host))
    throw new Error(`refusing non-local database host: ${host}`);
  command = ["psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", dbUrl]];
} else throw new Error("--docker/--database or --db-url required");

const tag = `seed_${randomUUID().replace(/-/g, "")}`;
const body = JSON.stringify(seed);
if (body.includes(`$${tag}$`)) throw new Error("seed contains dollar-quote tag");
const sql = `begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','${adminUser}','role','authenticated','gina',json_build_object('role','parent'))::text, true);
select public.admin_import_education_calendar_seed('${randomUUID()}'::uuid, $${tag}$${body}$${tag}$::jsonb, ${execute ? "true" : "false"});
commit;
`;
const run = spawnSync(command[0], command[1], { input: sql, encoding: "utf8" });
if (run.status !== 0) {
  console.error(run.stderr.slice(-2000));
  process.exit(1);
}
const lines = run.stdout.trim().split("\n");
const result = JSON.parse(lines.at(-1));
if (asJson) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`${execute ? "Yürütüldü" : "Sunucu önizlemesi"} — yayımlandı: ${result.published}`);
  console.log(JSON.stringify(result.counts));
  for (const r of result.records.filter((x) => x.action !== "create"))
    console.log(`  ${r.action}: ${r.place_name} / ${r.stage}${r.reason ? ` (${r.reason})` : ""}`);
}
