// scripts/restore-database.mjs: plan, maskeleme ve dry-run güvenlik kapıları. Hiçbir veritabanına bağlanmaz.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPlan,
  conninfoDbname,
  COUNT_TABLES,
  DEFAULT_PRIVILEGE_GRANT,
  DEFAULT_PRIVILEGE_REVOKE,
  listMigrations,
  redactConninfo,
} from "./restore-database.mjs";

const scripts = dirname(fileURLToPath(import.meta.url));
const root = join(scripts, "..");
const migrations = join(root, "supabase/migrations");

test("bağlantı dizesi maskelenir: parola ve sorgu parametreleri asla çıktıya girmez", () => {
  const url = "postgresql://postgres:S3cret-Value@db.example.invalid:5432/gina_prod?sslmode=require&password=x";
  const red = redactConninfo(url);
  assert.ok(!red.includes("S3cret"), red);
  assert.ok(!red.includes("sslmode"), red);
  assert.equal(red, "postgresql://postgres@db.example.invalid:5432/gina_prod");
  assert.equal(redactConninfo("dbname=gina_x user=postgres password=hidden host=localhost"), "dbname=gina_x user=postgres host=localhost");
  assert.equal(redactConninfo(""), "<yok>");
});

test("veritabanı adı URL yolundan veya dbname= anahtarından okunur", () => {
  assert.equal(conninfoDbname("postgresql://u:p@h/gina_q03r_abc_audit"), "gina_q03r_abc_audit");
  assert.equal(conninfoDbname("dbname=gina_q03r_abc_audit user=postgres"), "gina_q03r_abc_audit");
  assert.equal(conninfoDbname("user=postgres"), null);
});

test("plan: migration'lardan şema varsayılan; şema dökümünde ACL koruması (Q03-BK-3) planda yazılı", () => {
  const base = { conn: "dbname=t user=postgres", superuserConn: null, dataDump: "/tmp/veri.dump", schemaDump: null, skipSchema: false, migrations, migrationsFrom: null, triggerMode: "replica", expectedCounts: null };
  const plan = buildPlan(base);
  assert.deepEqual(plan.map((s) => s.step), ["preflight", "schema", "truncate", "data", "acl-check", "verify"]);
  const schema = plan.find((s) => s.step === "schema");
  assert.ok(schema.migrations.includes("20261106150000_rls_grant_hygiene.sql"));
  assert.equal(schema.migrations.length, listMigrations(migrations).length);
  assert.match(plan.find((s) => s.step === "data").detail, /session_replication_role = replica/);

  const dump = buildPlan({ ...base, schemaDump: "/tmp/sema.dump" }).find((s) => s.step === "schema");
  assert.ok(dump.detail.includes(DEFAULT_PRIVILEGE_REVOKE));
  assert.ok(dump.detail.includes(DEFAULT_PRIVILEGE_GRANT));
  assert.ok(dump.detail.indexOf(DEFAULT_PRIVILEGE_REVOKE) < dump.detail.indexOf("pg_restore"));
  assert.ok(dump.detail.indexOf("pg_restore") < dump.detail.indexOf(DEFAULT_PRIVILEGE_GRANT));

  assert.match(buildPlan({ ...base, triggerMode: "disable-user" }).find((s) => s.step === "data").detail, /tatbikatta denenmedi/);
  assert.ok(listMigrations(migrations, "20261106150000").length >= 1);
  assert.ok(COUNT_TABLES.includes("auth.users") && COUNT_TABLES.includes("storage.objects"));
});

test("CLI dry-run: plan yazar, bağlanmaz, rapor dosyasında parola yok", () => {
  const dir = mkdtempSync(join(tmpdir(), "gina-restore-"));
  try {
    const report = join(dir, "rapor.json");
    const out = execFileSync("node", ["scripts/restore-database.mjs", "--conn", "postgresql://postgres:TopSecret@127.0.0.1:1/nope", "--data-dump", "/tmp/veri.dump", "--report", report], { cwd: root, encoding: "utf8" });
    assert.match(out, /dry-run/);
    assert.match(out, /hiçbir şey çalıştırılmadı/);
    assert.ok(!out.includes("TopSecret"));
    const json = JSON.parse(readFileSync(report, "utf8"));
    assert.equal(json.mode, "dry-run");
    assert.ok(!JSON.stringify(json).includes("TopSecret"));
    assert.equal(json.plan.length, 6);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CLI execute: --target-confirm veritabanı adıyla eşleşmezse hiçbir komut çalışmadan durur", () => {
  const r = spawnSync("node", ["scripts/restore-database.mjs", "--conn", "dbname=gina_x user=postgres", "--data-dump", "/tmp/veri.dump", "--execute", "--target-confirm", "gina_y", "--exec-prefix", "/nonexistent/never-run"], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /eşleşmiyor/);
  const r2 = spawnSync("node", ["scripts/restore-database.mjs", "--conn", "dbname=gina_x user=postgres", "--data-dump", "/tmp/veri.dump", "--execute"], { cwd: root, encoding: "utf8" });
  assert.equal(r2.status, 2);
});

test("CLI: zorunlu argümanlar ve tetikleyici modu doğrulanır", () => {
  const r = spawnSync("node", ["scripts/restore-database.mjs", "--data-dump", "/tmp/x.dump"], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--conn zorunlu/);
  const r2 = spawnSync("node", ["scripts/restore-database.mjs", "--conn", "dbname=a", "--data-dump", "/tmp/x.dump", "--trigger-mode", "yolo"], { cwd: root, encoding: "utf8" });
  assert.equal(r2.status, 2);
  const tmp = mkdtempSync(join(tmpdir(), "gina-restore-"));
  try {
    writeFileSync(join(tmp, "20260101000000_a.sql"), "select 1;");
    writeFileSync(join(tmp, "20260102000000_b.sql"), "select 1;");
    writeFileSync(join(tmp, "notes.txt"), "x");
    assert.deepEqual(listMigrations(tmp), ["20260101000000_a.sql", "20260102000000_b.sql"]);
    assert.deepEqual(listMigrations(tmp, "20260102"), ["20260102000000_b.sql"]);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
