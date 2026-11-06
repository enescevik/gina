// QT-AI: Edge kopyası `supabase/functions/_shared/question-structure.ts` ile core `questionContentErrors`
// (packages/core/src/question-types/authoring.ts) çıktılarının BİREBİR eşitliği. Core modülü uzantısız göreli import
// kullandığı için yalnız bu bayraklarla çalışır (CI'daki Deno testleri fixtures üzerinden beklenen kodları denetler):
//   deno run --no-check --unstable-sloppy-imports --no-lock scripts/qt-structure-parity.ts
import { questionContentErrors as core } from "../packages/core/src/question-types/authoring.ts";
import { parseNumberInput as coreNumber } from "../packages/core/src/question-types/number.ts";
import { parseNumberInput as edgeNumber, questionContentErrors as edge } from "../supabase/functions/_shared/question-structure.ts";
import { splitStructuredQuestion } from "../supabase/functions/_shared/structured-generation.ts";
import { aiStructured, mutate } from "../supabase/functions/_shared/structured-generation.fixture.ts";
import fixtures from "../packages/core/src/question-types/fixtures.json" with { type: "json" };

// Edge yalnız AI'ın ürettiği türleri bilir (1A/1B/2A/2B); Faz 3 ve diğerleri orada bilerek `type_unknown`.
const EDGE_TYPES = new Set(["true_false", "fill_blank", "matching", "numeric", "ordering", "classification", "mark_text", "error_fix", "multi_choice", "two_stage", "region_select", "clock"]);
const cases: { name: string; type: string; payload: unknown; key: unknown }[] = fixtures.content.filter((c) => EDGE_TYPES.has(c.type)).map((c) => ({ ...c }));
// Model biçiminden ayrılmış payload/anahtarlar ve onların bozulmuş (ağırlık, eksik kimlik, boş anahtar) türevleri.
for (const [name, make] of Object.entries(aiStructured)) {
  const r = splitStructuredQuestion(make());
  if (!r.ok) throw new Error("fixture invalid: " + name);
  const { interaction_type: type, payload, answer_key: key } = r.value;
  cases.push({ name: "ai " + name, type, payload, key });
  cases.push({ name: "ai " + name + " empty key", type, payload, key: {} });
  cases.push({ name: "ai " + name + " key extra", type, payload, key: { ...key, extra: 1 } });
  cases.push({ name: "ai " + name + " payload extra", type, payload: { ...payload, extra: 1 }, key });
}
cases.push({ name: "mutated matching", type: "matching", ...(() => {
  const q = mutate(aiStructured.matching(), (s) => (s.pairs[0].right = "r9")) as { structure: { left: unknown; right: unknown; policy: unknown } };
  return { payload: { left: q.structure.left, right: q.structure.right, policy: q.structure.policy }, key: { pairs: { l1: "r9", l2: "r2" } } };
})() });
let diffs = 0;
for (const c of cases) {
  const a = JSON.stringify(core(c.type, c.payload, c.key)), b = JSON.stringify(edge(c.type, c.payload, c.key));
  if (a !== b) {
    diffs++;
    console.log("DIFF", c.name, a, b);
  }
}
for (const [input] of fixtures.numbers as [string, unknown][]) {
  if (coreNumber(input) !== edgeNumber(input)) {
    diffs++;
    console.log("DIFF number", input);
  }
}
console.log(`questionContentErrors cases: ${cases.length}, numbers: ${fixtures.numbers.length}, differences: ${diffs}`);
if (diffs) Deno.exit(1);
