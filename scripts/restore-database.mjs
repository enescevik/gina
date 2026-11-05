#!/usr/bin/env node
// GINA veritabanı geri yükleme reçetesi (Q03 §4, Q03-BK-1/BK-2/BK-3). Varsayılan: DRY-RUN — yalnız planı yazar.
// Gerçek çalıştırma için `--execute --target-confirm <dbname>` ikisi birden gerekir; hedef veritabanının adı
// bağlantı dizesindekiyle birebir eşleşmelidir. Betik hiçbir zaman sır yazmaz (bağlantı dizesi maskelenir).
//
// Adımlar (docs/security/RESTORE-RUNBOOK.md):
//   1. preflight   hedefe bağlan, sürüm/rol/süper kullanıcı durumunu oku
//   2. schema      şema migration'lardan (varsayılan) — veya --schema-dump ile şema dökümünden; o durumda döküm boyunca
//                  varsayılan fonksiyon ayrıcalığı kaldırılır ve sonra geri verilir (Q03-BK-3)
//   3. truncate    migration tohumlarını boşalt (public/gina tüm tablolar + storage.objects/buckets)
//   4. data        pg_restore --data-only -f - | psql, aynı oturumda session_replication_role=replica (süper kullanıcı)
//                  — veya --trigger-mode disable-user (sahip yetkisi; FK denetimi açık kalır; tatbikatta denenmedi)
//   5. acl-check   scripts/security/post-restore-acl-check.sql → 0 satır beklenir; NULL ACL fonksiyon yok; kapalı tetikleyici yok
//   6. verify      tablo sayımları (--expected-counts ile karşılaştırma), ilişki/yetim sorguları
//
// Kullanım:
//   node scripts/restore-database.mjs --conn "<conninfo>" --data-dump /yol/veri.dump            # dry-run (plan)
//   node scripts/restore-database.mjs --conn "<conninfo>" --data-dump ... --execute --target-confirm <dbname> \
//        [--superuser-conn "<conninfo>"] [--schema-dump /yol/sema.dump] [--migrations supabase/migrations] \
//        [--migrations-from 20261029200000] [--trigger-mode replica|disable-user] [--exec-prefix "docker exec -i supabase_db_gina"] \
//        [--expected-counts sayim.json] [--report rapor.json]
// Parolayı bağlantı dizesine yazmayın; PGPASSWORD / ~/.pgpass kullanın. --exec-prefix verildiğinde psql/pg_restore o
// komutun içinde çalışır (döküm dosyası yolu o ortamın dosya sistemine göredir).

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export const COUNT_TABLES = [
  "auth.users", "auth.identities", "public.families", "public.family_members", "public.children", "public.devices",
  "public.learning_sources", "storage.objects", "public.notes", "gina.note_changes", "public.audit_log",
];

export const RELATION_CHECKS = {
  orphan_family_members: "select count(*) from public.family_members m left join auth.users u on u.id=m.user_id where u.id is null",
  orphan_devices: "select count(*) from public.devices d left join auth.users u on u.id=d.auth_user_id where d.auth_user_id is not null and u.id is null",
  orphan_families_created_by: "select count(*) from public.families f left join auth.users u on u.id=f.created_by where f.created_by is not null and u.id is null",
  learning_sources_without_storage_object: "select count(*) from public.learning_sources s left join storage.objects o on o.name=s.object_path and o.bucket_id='gina-private-sources' where s.object_path is not null and o.id is null",
  note_changes_without_note: "select count(*) from gina.note_changes c left join public.notes n on n.id=c.note_id where n.id is null",
};

export const DEFAULT_PRIVILEGE_REVOKE = "alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, service_role;";
export const DEFAULT_PRIVILEGE_GRANT = "alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;";

export const TRUNCATE_SEEDS_SQL = `do $$ declare r record; begin
  for r in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where c.relkind='r' and n.nspname in ('public','gina') loop
    execute format('truncate table %I.%I cascade', r.nspname, r.relname); -- TRUNCATE satır tetikleyicisi çalıştırmaz
  end loop; end $$;
truncate table storage.objects, storage.buckets cascade; -- migration kovayı tohumlar; döküm kendi satırını getirir`;

/** Bağlantı dizesini günlük için maskeler: parola ve sorgu parametreleri gider, yalnız kullanıcı/host/dbname kalır. */
export function redactConninfo(conn) {
  if (!conn) return "<yok>";
  if (/^postgres(ql)?:\/\//i.test(conn)) {
    try {
      const u = new URL(conn);
      return `${u.protocol}//${u.username ? u.username + "@" : ""}${u.host}${u.pathname}`;
    } catch { return "<geçersiz url>"; }
  }
  return conn.split(/\s+/).filter((kv) => /^(dbname|user|host|port)=/i.test(kv)).join(" ") || "<kv conninfo>";
}

/** Bağlantı dizesinden veritabanı adını çıkarır (URL yolu veya dbname=). */
export function conninfoDbname(conn) {
  if (!conn) return null;
  if (/^postgres(ql)?:\/\//i.test(conn)) {
    try { return decodeURIComponent(new URL(conn).pathname.replace(/^\//, "")) || null; } catch { return null; }
  }
  const m = /(?:^|\s)dbname=("?)([^"\s]+)\1/.exec(conn);
  return m ? m[2] : null;
}

export function listMigrations(dir, from) {
  return readdirSync(dir).filter((f) => f.endsWith(".sql") && (!from || f >= from)).sort();
}

/** Çalıştırılacak adımların açıklaması (dry-run çıktısı ve test için). Sır içermez. */
export function buildPlan(o) {
  const steps = [];
  steps.push({ step: "preflight", detail: `hedef ${redactConninfo(o.conn)}; süper kullanıcı bağlantısı: ${o.superuserConn ? redactConninfo(o.superuserConn) : "aynı"}` });
  if (o.skipSchema) steps.push({ step: "schema", detail: "atlandı (--skip-schema)" });
  else if (o.schemaDump) {
    steps.push({ step: "schema", detail: `şema dökümü ${o.schemaDump}: önce "${DEFAULT_PRIVILEGE_REVOKE}" → pg_restore --no-owner --role=postgres → sonra "${DEFAULT_PRIVILEGE_GRANT}" (Q03-BK-3)` });
  } else {
    const files = listMigrations(o.migrations, o.migrationsFrom);
    steps.push({ step: "schema", detail: `${files.length} migration psql ile sırayla (${files[0] ?? "-"} … ${files[files.length - 1] ?? "-"})`, migrations: files });
  }
  steps.push({ step: "truncate", detail: "public/gina tüm tablolar + storage.objects/buckets TRUNCATE (tohumlar dökümden geri gelir)" });
  steps.push({
    step: "data",
    detail: o.triggerMode === "replica"
      ? `(echo 'set session_replication_role = replica;'; pg_restore --data-only -f - ${o.dataDump}) | psql  [süper kullanıcı]`
      : `alter table … disable trigger user → pg_restore --data-only ${o.dataDump} → enable trigger user  [sahip yetkisi; FK denetimi açık; tatbikatta denenmedi]`,
  });
  steps.push({ step: "acl-check", detail: "scripts/security/post-restore-acl-check.sql → 0 satır; NULL ACL (tetikleyici dışı) fonksiyon 0; tgenabled='D' tetikleyici 0" });
  steps.push({ step: "verify", detail: `${COUNT_TABLES.length} tablo sayımı${o.expectedCounts ? " (beklenenle karşılaştırılır)" : ""}, ${Object.keys(RELATION_CHECKS).length} ilişki/yetim sorgusu` });
  return steps;
}

// ---------------------------------------------------------------------------------------------------------------
function parse(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      conn: { type: "string" },
      "superuser-conn": { type: "string" },
      "data-dump": { type: "string" },
      "schema-dump": { type: "string" },
      "skip-schema": { type: "boolean", default: false },
      migrations: { type: "string", default: join(ROOT, "supabase/migrations") },
      "migrations-from": { type: "string" },
      "trigger-mode": { type: "string", default: "replica" },
      "exec-prefix": { type: "string" },
      "expected-counts": { type: "string" },
      report: { type: "string" },
      execute: { type: "boolean", default: false },
      "target-confirm": { type: "string" },
    },
  });
  if (!values.conn) throw new Error("--conn zorunlu");
  if (!values["data-dump"]) throw new Error("--data-dump zorunlu (auth+storage+public+gina --data-only -Fc dökümü)");
  if (!["replica", "disable-user"].includes(values["trigger-mode"])) throw new Error("--trigger-mode replica|disable-user");
  return {
    conn: values.conn, superuserConn: values["superuser-conn"] || null, dataDump: values["data-dump"], schemaDump: values["schema-dump"] || null,
    skipSchema: values["skip-schema"], migrations: values.migrations, migrationsFrom: values["migrations-from"] || null,
    triggerMode: values["trigger-mode"], execPrefix: values["exec-prefix"] ? values["exec-prefix"].split(/\s+/) : [],
    expectedCounts: values["expected-counts"] || null, report: values.report || null, execute: values.execute, targetConfirm: values["target-confirm"] || null,
  };
}

function makeRunner(o) {
  const run = (args, { input, allowError = false, shell = false } = {}) => {
    const argv = shell ? [...o.execPrefix, "sh", "-c", args] : [...o.execPrefix, ...args];
    const r = spawnSync(argv[0], argv.slice(1), { input, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    const errors = (r.stderr || "").split("\n").filter((l) => /ERROR|FATAL|error:/.test(l)).map((l) => l.replace(/\s+$/, "").slice(0, 240));
    if (r.status !== 0 && !allowError) {
      throw new Error(`komut başarısız (${argv.slice(o.execPrefix.length, o.execPrefix.length + 1).join(" ")}): ${errors.slice(0, 5).join(" | ") || "ayrıntı yok"}`);
    }
    return { status: r.status, stdout: (r.stdout || "").trim(), errors };
  };
  const psql = (conn, sql, opts = {}) => run(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-d", conn], { input: sql, ...opts });
  return { run, psql };
}

export function main(argv = process.argv.slice(2)) {
  const o = parse(argv);
  const plan = buildPlan(o);
  const report = { mode: o.execute ? "execute" : "dry-run", target: redactConninfo(o.conn), trigger_mode: o.triggerMode, plan, steps: {}, ok: null };
  console.log(`restore-database: ${report.mode} — hedef ${report.target}`);
  for (const s of plan) console.log(`  [${s.step}] ${s.detail}`);
  if (!o.execute) {
    console.log("Plan yazıldı; hiçbir şey çalıştırılmadı. Çalıştırmak için: --execute --target-confirm <dbname>");
    if (o.report) writeFileSync(o.report, JSON.stringify(report, null, 1) + "\n");
    return 0;
  }
  const dbname = conninfoDbname(o.conn);
  if (!dbname || o.targetConfirm !== dbname) {
    console.error(`restore-database: --target-confirm "${o.targetConfirm ?? ""}" bağlantıdaki veritabanı adıyla ("${dbname ?? "?"}") eşleşmiyor; durduruldu.`);
    return 2;
  }
  const { run, psql } = makeRunner(o);
  const su = o.superuserConn || o.conn;
  const t0 = Date.now();
  try {
    // 1. preflight
    const pre = psql(o.conn, "select version(); select current_user; select rolsuper from pg_roles where rolname=current_user;").stdout.split("\n");
    const suIs = psql(su, "select rolsuper from pg_roles where rolname=current_user;").stdout;
    report.steps.preflight = { version: pre[0]?.split(",")[0], user: pre[1], user_is_superuser: pre[2] === "t", superuser_conn_is_superuser: suIs === "t" };
    if (o.triggerMode === "replica" && suIs !== "t") throw new Error("replica modu süper kullanıcı ister; --superuser-conn verin veya --trigger-mode disable-user");
    console.log(`[preflight] ${report.steps.preflight.version}; rol ${pre[1]} (süper: ${pre[2]})`);

    // 2. schema
    if (o.skipSchema) {
      report.steps.schema = { skipped: true };
    } else if (o.schemaDump) {
      psql(su, DEFAULT_PRIVILEGE_REVOKE);
      const r = run(["pg_restore", "-d", o.conn, "--no-owner", "--role=postgres", o.schemaDump], { allowError: true });
      psql(su, DEFAULT_PRIVILEGE_GRANT);
      const real = r.errors.filter((e) => !e.includes('schema "public" already exists'));
      report.steps.schema = { from: "schema-dump", exit: r.status, errors: real.slice(0, 10), default_function_privileges_removed_during_restore: true };
      if (real.length) throw new Error("şema dökümü hatalı: " + real.slice(0, 3).join(" | "));
    } else {
      const files = listMigrations(o.migrations, o.migrationsFrom);
      for (const f of files) psql(o.conn, readFileSync(join(o.migrations, f), "utf8"));
      report.steps.schema = { from: "migrations", applied: files.length, first: files[0], last: files[files.length - 1] };
    }
    console.log(`[schema] ${JSON.stringify(report.steps.schema)}`);

    // 3. truncate seeds
    report.steps.truncate = { before: counts(psql, su) };
    psql(su, TRUNCATE_SEEDS_SQL);
    console.log("[truncate] tohum tabloları boşaltıldı");

    // 4. data
    if (o.triggerMode === "replica") {
      const cmd = `(echo 'set session_replication_role = replica;'; pg_restore --data-only -f - ${shq(o.dataDump)}) | psql -X -q -v ON_ERROR_STOP=1 -d ${shq(su)}`;
      const r = run(cmd, { shell: true, allowError: true });
      report.steps.data = { mode: "replica", exit: r.status, errors: r.errors.slice(0, 10) };
      if (r.status !== 0) throw new Error("veri geri yüklemesi başarısız: " + r.errors.slice(0, 3).join(" | "));
    } else {
      const toggle = (state) => psql(o.conn, `do $$ declare r record; begin for r in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','gina') loop execute format('alter table %I.%I ${state} trigger user', r.nspname, r.relname); end loop; end $$;`);
      toggle("disable");
      const r = run(["pg_restore", "--data-only", "--exit-on-error", "-d", o.conn, o.dataDump], { allowError: true });
      toggle("enable");
      report.steps.data = { mode: "disable-user", exit: r.status, errors: r.errors.slice(0, 10) };
      if (r.status !== 0) throw new Error("veri geri yüklemesi başarısız: " + r.errors.slice(0, 3).join(" | "));
    }
    console.log(`[data] tamam (${report.steps.data.mode})`);

    // 5. ACL / trigger check
    const aclSql = readFileSync(join(ROOT, "scripts/security/post-restore-acl-check.sql"), "utf8");
    const aclRows = psql(su, aclSql).stdout.split("\n").filter(Boolean);
    const nullAcl = psql(su, "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','gina') and p.prokind='f' and p.proacl is null and p.prorettype <> 'trigger'::regtype").stdout;
    const disabled = psql(su, "select count(*) from pg_trigger where not tgisinternal and tgenabled='D'").stdout;
    report.steps.acl_check = { anon_executable_beyond_allowlist: aclRows, null_acl_non_trigger_functions: Number(nullAcl), triggers_disabled: Number(disabled) };
    const aclOk = aclRows.length === 0 && nullAcl === "0" && disabled === "0";
    console.log(`[acl-check] anon fazlalığı ${aclRows.length}, NULL ACL ${nullAcl}, kapalı tetikleyici ${disabled} → ${aclOk ? "geçti" : "BAŞARISIZ"}`);

    // 6. verify
    const after = counts(psql, su);
    const relations = Object.fromEntries(Object.entries(RELATION_CHECKS).map(([k, q]) => [k, Number(psql(su, q).stdout)]));
    let countsOk = true, expected = null;
    if (o.expectedCounts) {
      expected = JSON.parse(readFileSync(o.expectedCounts, "utf8"));
      countsOk = Object.entries(expected).every(([t, n]) => after[t] === Number(n));
    }
    const relationsOk = Object.values(relations).every((n) => n === 0);
    report.steps.verify = { counts: after, expected, counts_match_expected: o.expectedCounts ? countsOk : null, relations, relations_ok: relationsOk };
    console.log(`[verify] sayımlar ${JSON.stringify(after)}; ilişkiler ${JSON.stringify(relations)}`);
    report.ok = aclOk && countsOk && relationsOk;
  } catch (error) {
    report.error = String(error.message).slice(0, 600);
    report.ok = false;
    console.error(`restore-database: ${report.error}`);
  }
  report.duration_ms = Date.now() - t0;
  if (o.report) writeFileSync(o.report, JSON.stringify(report, null, 1) + "\n");
  console.log(`restore-database: ${report.ok ? "BAŞARILI" : "BAŞARISIZ"} (${report.duration_ms} ms)`);
  return report.ok ? 0 : 1;
}

function counts(psql, conn) {
  const out = {};
  for (const t of COUNT_TABLES) {
    const r = psql(conn, `select count(*) from ${t}`, { allowError: true });
    out[t] = r.status === 0 ? Number(r.stdout) : null;
  }
  return out;
}

function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try { process.exit(main()); } catch (error) { console.error(`restore-database: ${error.message}`); process.exit(2); }
}
