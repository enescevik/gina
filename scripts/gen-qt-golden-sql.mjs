#!/usr/bin/env node
// QT01: packages/core/src/question-types/fixtures.json → supabase/tests/140_qt_scoring_golden.test.sql
// Aynı örnekler core sözleşme testlerinde de kullanılır; SQL puanlama otoritesi bu dosyayla doğrulanır.
// Kullanım: node scripts/gen-qt-golden-sql.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fx = JSON.parse(readFileSync(join(root, "packages/core/src/question-types/fixtures.json"), "utf8"));
const lit = (v) => v === null || v === undefined ? "null" : `'${String(v).replaceAll("'", "''")}'`;
const j = (v) => v === null || v === undefined ? "null::jsonb" : `${lit(JSON.stringify(v))}::jsonb`;
const out = [
  "-- OTOMATİK ÜRETİLDİ: node scripts/gen-qt-golden-sql.mjs (kaynak: packages/core/src/question-types/fixtures.json)",
  "-- QT01 SQL puanlama golden testleri: içerik doğrulama, cevap doğrulama, puan/sınır/kötüye kullanım, sayı ayrıştırma.",
  "begin;",
  "select no_plan();",
];
for (const c of fx.content) {
  const call = `gina.qt_question_errors(${lit(c.type)}, 1, ${j(c.payload)}, ${j(c.key)})`;
  if (c.valid) out.push(`select is(${call}, '{}'::text[], ${lit("content valid: " + c.name)});`);
  else for (const e of c.errors) out.push(`select ok(${lit(e)} = any(${call}), ${lit(`content rejects (${e}): ${c.name}`)});`);
}
for (const a of fx.answers) {
  const call = `gina.qt_answer_errors(${lit(a.type)}, ${j(a.payload)}, ${j(a.answer)})`;
  if (a.valid) out.push(`select is(${call}, '{}'::text[], ${lit("answer valid: " + a.name)});`);
  else out.push(`select ok(${lit(a.error)} = any(${call}), ${lit(`answer rejects (${a.error}): ${a.name}`)});`);
}
for (const s of fx.scoring) {
  const call = `gina.qt_score(${lit(s.type)}, ${j(s.payload)}, ${j(s.key)}, ${j(s.answer)})`;
  const score = s.expect.score === null ? "null::numeric" : `${s.expect.score}::numeric`;
  out.push(`select is(round((${call}->>'score')::numeric, 4), ${score}, ${lit("score: " + s.name)});`);
  out.push(`select is(${call}->>'answer_state', ${lit(s.expect.answer_state)}, ${lit("answer_state: " + s.name)});`);
  out.push(`select is(${call}->>'outcome', ${lit(s.expect.outcome)}, ${lit("outcome: " + s.name)});`);
  out.push(`select ok((${call}->>'score') is null or ((${call}->>'score')::numeric between 0 and 100), ${lit("0-100 bound: " + s.name)});`);
  out.push(`select is(${call}, ${call}, ${lit("deterministic: " + s.name)});`);
}
for (const [input, value] of fx.numbers) {
  out.push(`select is(gina.qt_parse_number(${lit(input)}), ${value === null ? "null::numeric" : `${value}::numeric`}, ${lit("parse_number: " + JSON.stringify(input))});`);
}
out.push("select * from finish();", "rollback;", "");
const target = join(root, "supabase/tests/140_qt_scoring_golden.test.sql");
const text = out.join("\n");
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== text) { console.error("140_qt_scoring_golden.test.sql güncel değil"); process.exit(1); }
  console.log("ok");
} else { writeFileSync(target, text); console.log(`yazıldı: ${out.length} satır`); }
