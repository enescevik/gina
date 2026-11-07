// QT-AI: Edge kopyası (question-structure.ts) ile core `questionContentErrors` paritesi, ortak fixtures.json üzerinden.
// Aynı dosya SQL golden testini (supabase/tests/140) üretir; üç taraf aynı örneklerle denetlenir.
// Birebir çıktı eşitliği (core modülünü doğrudan çalıştırarak) ayrıca: `deno run --no-check --unstable-sloppy-imports
// --no-lock scripts/qt-structure-parity.ts`.
import { assert, assertEquals } from "jsr:@std/assert";
import fixtures from "../../../packages/core/src/question-types/fixtures.json" with { type: "json" };
import { parseNumberInput, questionContentErrors } from "./question-structure.ts";

// Edge, AI'ın üretebildiği türleri doğrular: 1A/1B + Faz 2A (mark_text, error_fix, multi_choice, two_stage) +
// Faz 2B (clock, region_select) ve her türde isteğe bağlı uyaran (stimulus). 2A/2B sunucuda enabled=false gelir;
// Edge doğrulayıcı yine kabul eder (açılınca çalışsın), üretim isteği ise kapalı türü sağlayıcıdan önce reddeder.
// Kütüphaneye özel türler AI üretiminde açıkça type_unknown döner.
const AI_TYPES = new Set([
  "true_false", "fill_blank", "matching", "numeric", "ordering", "classification",
  "mark_text", "error_fix", "multi_choice", "two_stage", "region_select", "clock", "crossword",
]);
const aiCases = fixtures.content.filter((c) => AI_TYPES.has(c.type));
Deno.test("non-AI phase types are refused explicitly by the Edge validator", () => {
  const others = fixtures.content.filter((c) => !AI_TYPES.has(c.type));
  assert(others.length > 0);
  for (const c of others) assertEquals(questionContentErrors(c.type, c.payload, c.key), ["type_unknown"], c.name);
});
Deno.test("fixture scope covers every AI type including 2A/2B and stimulus", () => {
  for (const t of AI_TYPES) assert(aiCases.some((c) => c.type === t), t);
  assert(aiCases.some((c) => c.payload && typeof c.payload === "object" && "stimulus" in c.payload), "stimulus fixtures");
});
for (const c of aiCases) {
  Deno.test("core fixture parity: " + c.name, () => {
    const errs = questionContentErrors(c.type, c.payload, c.key);
    if (c.valid) assertEquals(errs, []);
    else for (const e of c.errors ?? []) assert(errs.includes(e), `${c.name}: ${JSON.stringify(errs)} lacks ${e}`);
  });
}
Deno.test("core fixture parity: number parsing equals SQL qt_parse_number", () => {
  for (const [input, value] of fixtures.numbers as [string, string | null][]) {
    const got = parseNumberInput(input);
    if (value === null) assertEquals(got, null, JSON.stringify(input));
    else assert(got !== null && Math.abs(got - Number(value)) < 1e-10, JSON.stringify(input));
  }
});
Deno.test("schema version other than 1 and unknown type are refused", () => {
  assertEquals(questionContentErrors("true_false", {}, {}, 2), ["schema_version_unsupported"]);
  assertEquals(questionContentErrors("essay", { a: 1 }, { b: 1 }), ["type_unknown"]);
});
