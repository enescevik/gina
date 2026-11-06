// QT-AI: yapılandırılmış soru üretimi — şema, payload/anahtar ayrımı, deterministik doğrulama, red-team ve eski
// davranış paritesi. Sağlayıcı sahtedir (sabit çıktı nesneleri); gerçek AI çağrısı yok.
import { assert, assertEquals } from "jsr:@std/assert";
import { PROMPT_VERSION, SCHEMA, SYSTEM_PROMPT } from "../prova-generate/generation-schema.ts";
import {
  COGNITIVE_DEMANDS,
  type GenerationContext,
  GenerationInvalidError,
  recoverGeneration,
  validateGenerationResult,
} from "./generation-result.ts";
import { DIFFICULTIES, sha256 } from "./prova.ts";
import { serviceClient } from "./supabase.ts";
import { isContractBody } from "./error-contract.ts";
import { aiStructured, type AiStructuredName, mutate } from "./structured-generation.fixture.ts";
import {
  legacyKindFor,
  parseInteractionTypes,
  splitStructuredQuestion,
  STRUCTURE_JSON_SCHEMAS,
  STRUCTURED_PROMPT,
  structuredGenerationSchema,
} from "./structured-generation.ts";

const vocab = { difficulties: DIFFICULTIES, cognitive: COGNITIVE_DEMANDS };
// deno-lint-ignore no-explicit-any
type Any = any;
const errorsOf = (q: unknown) => {
  const r = splitStructuredQuestion(q);
  return r.ok ? [] : r.errors;
};
const expectCode = (q: unknown, code: string, why: string) => {
  const errs = errorsOf(q);
  assert(errs.includes(code), `${why}: expected ${code}, got ${JSON.stringify(errs)}`);
};

// ---------------------------------------------------------------------------------------------------------------
Deno.test("legacy parity: provider schema and system prompt bytes equal v8 (base a5c648fb); only the version string moved", async () => {
  assertEquals(await sha256(JSON.stringify(SCHEMA)), "612ca930824fd43452af1bec4006e80af4e980bb9d256c5af369675273e54a2b");
  assertEquals(await sha256(SYSTEM_PROMPT), "0cf89dc70da4117d7b346bd8ded7e5f9fabbc0638ab8a976ed5a02966cf2be33");
  assertEquals(PROMPT_VERSION, "prova-generate/v9-structured-types");
});

Deno.test("request option: absent = legacy; malformed refused; written/OYSS refuses practice-only and multiple choice explicitly", () => {
  assertEquals(parseInteractionTypes(undefined, false), null);
  assertEquals(parseInteractionTypes(null, true), null);
  for (const bad of ["true_false", [], ["essay"], ["true_false", "true_false"], [1], new Array(9).fill("numeric")]) {
    assertEquals(parseInteractionTypes(bad, false), { error: "interaction_types_invalid" }, JSON.stringify(bad));
  }
  assertEquals(parseInteractionTypes(["true_false", "matching", "numeric"], false), { types: ["true_false", "matching", "numeric"] });
  assertEquals(parseInteractionTypes(["open_ended", "numeric"], true), { types: ["open_ended", "numeric"] });
  assertEquals(parseInteractionTypes(["open_ended", "true_false", "ordering"], true), {
    error: "interaction_type_not_allowed_for_track",
    details: { track: "meb_common", types: "true_false,ordering" },
  });
  assertEquals(parseInteractionTypes(["multiple_choice"], true), {
    error: "interaction_type_not_allowed_for_track",
    details: { track: "meb_common", types: "multiple_choice" },
  });
  assertEquals(legacyKindFor(["multiple_choice", "open_ended", "matching"]), "mixed");
  assertEquals(legacyKindFor(["open_ended", "numeric"]), "open_ended");
  assertEquals(legacyKindFor(["multiple_choice"]), "multiple_choice");
});

/** Şemadaki her nesne katı: additionalProperties false ve bütün alanlar zorunlu. */
function strictEverywhere(node: Any, path = "$"): string[] {
  const bad: string[] = [];
  if (Array.isArray(node)) node.forEach((n, i) => bad.push(...strictEverywhere(n, `${path}[${i}]`)));
  else if (node && typeof node === "object") {
    if (node.type === "object") {
      if (node.additionalProperties !== false) bad.push(path + " additionalProperties");
      if (JSON.stringify([...node.required].sort()) !== JSON.stringify(Object.keys(node.properties).sort())) bad.push(path + " required");
    }
    for (const [k, v] of Object.entries(node)) bad.push(...strictEverywhere(v, `${path}.${k}`));
  }
  return bad;
}
Deno.test("provider schema: one strict variant per requested type with explicit discriminant + schema_version", () => {
  const s: Any = structuredGenerationSchema(SCHEMA as Any, ["open_ended", "true_false", "matching"], vocab);
  const variants = s.properties.questions.items.anyOf;
  assertEquals(variants.length, 3);
  assertEquals(variants.map((v: Any) => v.properties.interaction_type.enum), [["open_ended"], ["true_false"], ["matching"]]);
  assertEquals(variants[0].properties.kind.enum, ["open_ended"], "legacy variant kind narrowed to the request");
  for (const v of variants.slice(1)) {
    assert(v.required.includes("interaction_type") && v.required.includes("schema_version") && v.required.includes("structure"));
    assert(!("choices" in v.properties) && !("rubric" in v.properties) && !("expected_answer" in v.properties));
  }
  assertEquals(strictEverywhere(s), []);
  for (const t of Object.keys(STRUCTURE_JSON_SCHEMAS)) {
    const only: Any = structuredGenerationSchema(SCHEMA as Any, [t as Any], vocab);
    assertEquals(only.properties.questions.items.properties.interaction_type.enum, [t], "single type is not wrapped in anyOf");
    assertEquals(strictEverywhere(only), [], t);
  }
  // Eski şema nesnesi değiştirilmez (aynı istek başka türle kurulduğunda bozulmaz).
  assert(!("interaction_type" in (SCHEMA.properties.questions.items.properties as Any)));
});
Deno.test("prompt appendix explains every type briefly for grades 1-4 and single-judgement statements", () => {
  for (const t of ["true_false", "fill_blank", "matching", "numeric", "ordering", "classification"]) assert(STRUCTURED_PROMPT.includes(t), t);
  assert(STRUCTURED_PROMPT.includes("1–4. sınıf (7–9 yaş)"));
  assert(STRUCTURED_PROMPT.includes("tek bir yargı"));
  assert(STRUCTURED_PROMPT.includes("orders kabul edilen BÜTÜN"));
});

// ---------------------------------------------------------------------------------------------------------------
const PAYLOAD_KEYS: Record<string, string[]> = {
  true_false: ["statements", "statements[].id", "statements[].text"],
  fill_blank: ["segments", "segments[].type", "segments[].text", "segments[].id", "input", "bank", "bank[].id", "bank[].text", "bank_reuse"],
  matching: ["left", "right", "policy", "left[].id", "left[].text", "right[].id", "right[].text"],
  numeric: ["units", "units[].id", "units[].text", "unit_required", "work_area"],
  ordering: ["items", "items[].id", "items[].text", "mode"],
  classification: ["items", "items[].id", "items[].text", "categories", "categories[].id", "categories[].text", "categories[].capacity"],
};
const paths = (o: Any, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => [
    p + k,
    ...(Array.isArray(v) ? v.flatMap((e) => (e && typeof e === "object" ? paths(e, `${p}${k}[].`) : [])) : []),
  ]);
for (const name of Object.keys(aiStructured) as AiStructuredName[]) {
  Deno.test("split " + name + ": valid, payload rebuilt from allowlist only, nothing private leaks", () => {
    const q = aiStructured[name]();
    const r = splitStructuredQuestion(q);
    assert(r.ok, JSON.stringify(r));
    const { payload, answer_key, interaction_type, schema_version } = r.value;
    assertEquals(schema_version, 1);
    for (const p of new Set(paths(payload))) assert(PAYLOAD_KEYS[interaction_type].includes(p), `${name}: payload path ${p}`);
    const json = JSON.stringify(payload);
    for (const secret of ["ÇÖZÜM-GİZLİ", "answer", "accepted", "tokens", "pairs", "orders", "category", "membership", "unit_factors", "prova-generate"]) {
      assert(!json.includes(secret), `${name}: payload contains ${secret}`);
    }
    assert(Object.keys(answer_key).length > 0);
  });
}
Deno.test("split keys equal the contract shapes", () => {
  const ok = (n: AiStructuredName) => {
    const r = splitStructuredQuestion(aiStructured[n]());
    assert(r.ok);
    return r.value;
  };
  assertEquals(ok("true_false").answer_key, { answers: { s1: true, s2: false, s3: true } });
  assertEquals(ok("fill_blank_bank").answer_key, { blanks: { b1: { tokens: ["w1"] } } });
  assertEquals(ok("fill_blank_bank").payload.bank_reuse, false);
  assertEquals(ok("fill_blank_keyboard").answer_key, { blanks: { b1: { accepted: ["7", "yedi"] } }, case_insensitive: true });
  assert(!("bank" in ok("fill_blank_keyboard").payload), "keyboard payload carries no bank");
  assertEquals(ok("matching").answer_key, { pairs: { l1: "r1", l2: "r2" } });
  assertEquals(ok("numeric_unit").answer_key, {
    value: "150", abs_tolerance: 0, rel_tolerance: 0, unit_weight: 0, process_required: false, unit: "cm", unit_factors: { cm: 1, m: 100 },
  });
  assertEquals(ok("numeric_plain").payload, { units: [], unit_required: false, work_area: true });
  assertEquals(ok("ordering_sentence").answer_key, { orders: [["w1", "w2", "w3"], ["w2", "w1", "w3"]] });
  assertEquals(ok("classification").payload.categories, [{ id: "c1", text: "Hayvan" }, { id: "c2", text: "Bitki", capacity: 2 }]);
  assertEquals(ok("classification").answer_key, { membership: { i1: "c1", i2: "c2", i3: "c1", i4: "c2" } });
});

// ---------------------------------------------------------------------------------------------------------------
// Red-team (sahte sağlayıcı çıktısı): her bozulma belirli bir sabit kodla reddedilir.
Deno.test("red-team: wrong / missing / contradictory pairs", () => {
  expectCode(mutate(aiStructured.matching(), (s) => (s.pairs[0].right = "r9")), "key_value_invalid", "pair to non-existent right");
  expectCode(mutate(aiStructured.matching(), (s) => (s.pairs[1].left = "l9")), "key_unknown_id", "pair from non-existent left");
  expectCode(mutate(aiStructured.matching(), (s) => s.pairs.pop()), "key_missing_id", "left without pair");
  expectCode(mutate(aiStructured.matching(), (s) => (s.pairs[1].right = "r1")), "key_not_one_to_one", "two lefts on one right");
  expectCode(mutate(aiStructured.matching(), (s) => s.pairs.push({ left: "l1", right: "r3" })), "duplicate_id", "contradictory second pair");
  expectCode(mutate(aiStructured.matching(), (s) => (s.right = s.right.slice(0, 1))), "sides_invalid", "too few right items");
  expectCode(mutate(aiStructured.matching(), (s) => (s.right[2].text = "kanı pompalar ")), "duplicate_text", "visually identical right items");
  expectCode(mutate(aiStructured.matching(), (s) => (s.left[1].id = "r1")), "duplicate_id", "id shared across sides");
});
Deno.test("red-team: multiple valid fills / unsolvable bank / blank misuse", () => {
  expectCode(mutate(aiStructured.fill_blank_bank(), (s) => s.bank.push({ id: "w3", text: "Buz" })), "duplicate_text", "two bank words spelled the same");
  expectCode(
    mutate(aiStructured.fill_blank_bank(), (s) => {
      s.segments.push({ type: "blank", text: "", id: "b2", accepted: [], tokens: ["w1"] });
    }),
    "bank_unsolvable",
    "two blanks need the same word without reuse",
  );
  expectCode(mutate(aiStructured.fill_blank_bank(), (s) => (s.segments[1].tokens = ["w9"])), "key_value_invalid", "token not in bank");
  expectCode(mutate(aiStructured.fill_blank_bank(), (s) => (s.segments[1].tokens = [])), "key_value_invalid", "blank without answer");
  expectCode(mutate(aiStructured.fill_blank_bank(), (s) => (s.segments[0].accepted = ["x"])), "segments_invalid", "answer hidden in text segment");
  expectCode(mutate(aiStructured.fill_blank_bank(), (s) => (s.segments[1].text = "buz")), "segments_invalid", "blank carrying visible text");
  expectCode(mutate(aiStructured.fill_blank_bank(), (s) => (s.bank = s.bank.slice(0, 1))), "bank_invalid", "bank of one word");
  expectCode(mutate(aiStructured.fill_blank_keyboard(), (s) => (s.segments[1].tokens = ["w1"])), "key_value_invalid", "bank token on keyboard blank");
  expectCode(mutate(aiStructured.fill_blank_keyboard(), (s) => s.bank.push({ id: "w1", text: "yedi" })), "bank_not_allowed", "bank on keyboard input");
  expectCode(mutate(aiStructured.fill_blank_keyboard(), (_s, q) => (q.stem = "Boşluğa yedi yaz.")), "payload_answer_leak", "keyboard answer in instructions");
  expectCode(
    mutate(aiStructured.fill_blank_keyboard(), (s) => s.segments.push({ type: "blank", text: "", id: "b1", accepted: ["x"], tokens: [] })),
    "duplicate_id",
    "duplicate blank id",
  );
});
Deno.test("red-team: several grammatical orders must be listed (or the item is refused)", () => {
  assert(splitStructuredQuestion(aiStructured.ordering_sentence()).ok, "listed alternative orders are accepted");
  const repeated = () =>
    mutate(aiStructured.ordering(), (s, q) => {
      q.stem = "Kelimeleri sıralayarak cümle kur.";
      s.mode = "sentence";
      s.items = [{ id: "a", text: "Bir" }, { id: "b", text: "kuş" }, { id: "c", text: "bir" }, { id: "d", text: "dala kondu." }];
      s.orders = [["a", "b", "c", "d"]];
    });
  expectCode(repeated(), "order_ambiguous", "identical words swapped but swap not accepted");
  const closed = mutate(repeated(), (s) => s.orders.push(["c", "b", "a", "d"]));
  assert(splitStructuredQuestion(closed).ok, "closure listed → accepted");
  expectCode(mutate(aiStructured.ordering(), (s) => (s.orders = [["a", "b"]])), "order_invalid", "order is not a permutation");
  expectCode(mutate(aiStructured.ordering(), (s) => (s.orders = [["a", "a", "c"]])), "order_invalid", "repeated id in order");
  expectCode(mutate(aiStructured.ordering(), (s) => s.orders.push(["a", "b", "c"])), "order_duplicate", "duplicate accepted order");
  expectCode(
    mutate(aiStructured.ordering(), (s) => (s.orders = [["a", "b", "c"], ["a", "c", "b"], ["b", "a", "c"], ["b", "c", "a"], ["c", "a", "b"], ["c", "b", "a"]])),
    "key_invalid",
    "more than five accepted orders",
  );
  expectCode(mutate(aiStructured.ordering(), (s) => (s.orders = [])), "key_invalid", "unsolvable: no accepted order");
});
Deno.test("red-team: overlapping / ambiguous categories", () => {
  expectCode(mutate(aiStructured.classification(), (s) => (s.categories[1].text = "hayvan")), "duplicate_text", "two categories with the same name");
  expectCode(mutate(aiStructured.classification(), (s) => s.items.push({ id: "i1", text: "Kedi", category: "c2" })), "duplicate_id", "item in two categories");
  expectCode(mutate(aiStructured.classification(), (s) => (s.items[3].text = "Papatya")), "duplicate_text", "same-looking item in both groups");
  expectCode(mutate(aiStructured.classification(), (s) => (s.items[0].category = "c9")), "key_value_invalid", "unknown category");
  expectCode(mutate(aiStructured.classification(), (s) => (s.items[0].category = "c2")), "capacity_exceeded", "capacity exceeded by key");
  expectCode(mutate(aiStructured.classification(), (s) => (s.categories[0].capacity = 40)), "capacity_invalid", "capacity out of range");
  expectCode(mutate(aiStructured.classification(), (s) => (s.categories = s.categories.slice(0, 1))), "categories_invalid", "single category");
});
Deno.test("red-team: items referring to a non-existent image", () => {
  expectCode(mutate(aiStructured.true_false(), (_s, q) => (q.stem = "Resimdeki hayvanlarla ilgili ifadeler doğru mu?")), "image_reference_unavailable", "stem");
  expectCode(mutate(aiStructured.classification(), (s) => (s.items[0].text = "Görseldeki kuş")), "image_reference_unavailable", "item text");
  expectCode(mutate(aiStructured.matching(), (s) => (s.left[0].text = "Şekildeki üçgen")), "image_reference_unavailable", "matching item");
  expectCode(mutate(aiStructured.ordering(), (_s, q) => (q.stem = "Şekle göre aşamaları sırala.")), "image_reference_unavailable", "şekle göre");
  // "bu şekilde" (= böyle) bir görsel değildir.
  assert(splitStructuredQuestion(mutate(aiStructured.ordering(), (_s, q) => (q.stem = "Aşamaları doğru şekilde sırala."))).ok);
});
Deno.test("red-team: unit errors", () => {
  expectCode(mutate(aiStructured.numeric_unit(), (s) => (s.unit_factors[1].factor = 10)), "unit_factors_invalid", "1 m = 10 cm");
  expectCode(mutate(aiStructured.numeric_unit(), (s) => s.unit_factors.pop()), "unit_factors_invalid", "missing factor for an offered unit");
  expectCode(mutate(aiStructured.numeric_unit(), (s) => (s.unit_factors[0].factor = 2)), "unit_factors_invalid", "answer unit factor not 1");
  expectCode(
    mutate(aiStructured.numeric_unit(), (s) => {
      s.units[1] = { id: "kg", text: "kg" };
      s.unit_factors[1] = { unit: "kg", factor: 1000 };
    }),
    "unit_factors_invalid",
    "length and mass mixed",
  );
  expectCode(mutate(aiStructured.numeric_unit(), (s) => (s.unit = "km")), "key_unit_invalid", "answer unit not offered");
  expectCode(mutate(aiStructured.numeric_unit(), (s) => (s.value = "yüz elli")), "key_value_invalid", "non-numeric value");
  expectCode(mutate(aiStructured.numeric_unit(), (s) => (s.rel_tolerance = 0.9)), "tolerance_invalid", "tolerance too wide");
  expectCode(mutate(aiStructured.numeric_unit(), (s) => s.unit_factors.push({ unit: "cm", factor: 1 })), "duplicate_id", "duplicate factor");
  expectCode(mutate(aiStructured.numeric_plain(), (s) => (s.unit = "cm")), "unit_not_required", "unit on unit-less question");
  expectCode(mutate(aiStructured.numeric_plain(), (s) => s.units.push({ id: "cm", text: "cm" })), "unit_not_required", "unit picker on unit-less");
  expectCode(mutate(aiStructured.numeric_unit(), (s) => (s.units = [])), "units_missing", "unit required without choices");
});
Deno.test("red-team: payload containing answers", () => {
  expectCode(mutate(aiStructured.true_false(), (s) => (s.statements[0].correct = true)), "statements_invalid", "extra correct flag on a statement");
  expectCode(mutate(aiStructured.true_false(), (s) => (s.statements[0].text = "Güneş bir yıldızdır. (Doğru)")), "payload_answer_leak", "answer in statement");
  expectCode(mutate(aiStructured.true_false(), (s) => (s.statements[1].text = "Ay kendi ışığını üretir - yanlış")), "payload_answer_leak", "trailing verdict");
  expectCode(mutate(aiStructured.matching(), (_s, q) => (q.stem = "Eşleştir. Doğru cevap: l1-r1")), "payload_answer_leak", "answer in stem");
  expectCode(mutate(aiStructured.true_false(), (s) => (s.answers = { s1: true })), "payload_unknown_field", "answers next to statements");
  expectCode(mutate(aiStructured.true_false(), (s) => (s.statements[0].answer = "doğru")), "key_value_invalid", "non-boolean verdict");
});
Deno.test("red-team: unknown fields / types / versions", () => {
  expectCode(mutate(aiStructured.true_false(), (_s, q) => (q.interaction_type = "essay")), "type_unknown", "unknown type");
  expectCode(mutate(aiStructured.true_false(), (_s, q) => (q.schema_version = 2)), "schema_version_unsupported", "future schema");
  expectCode(mutate(aiStructured.true_false(), (_s, q) => (q.hint = "ipucu")), "payload_unknown_field", "unknown top-level field");
  expectCode(mutate(aiStructured.true_false(), (_s, q) => delete q.solution), "payload_unknown_field", "missing required field");
  expectCode(mutate(aiStructured.numeric_unit(), (s) => (s.image_id = "img1")), "payload_unknown_field", "unknown structure field (image)");
  expectCode(mutate(aiStructured.true_false(), (s) => (s.statements[0].id = "S1")), "statements_invalid", "id breaks the id grammar");
  expectCode(mutate(aiStructured.true_false(), (s) => (s.statements[1].id = "s1")), "statements_invalid", "duplicate statement id");
});
Deno.test("red-team: oversize", () => {
  expectCode(mutate(aiStructured.true_false(), (s) => (s.statements[0].text = "a".repeat(501))), "statements_invalid", "statement > 500");
  expectCode(
    mutate(aiStructured.true_false(), (s) => (s.statements = Array.from({ length: 11 }, (_, i) => ({ id: `s${i}`, text: "İfade", answer: true })))),
    "statements_invalid",
    "more than 10 statements",
  );
  expectCode(
    mutate(aiStructured.fill_blank_keyboard(), (s) => {
      s.segments = [
        ...Array.from({ length: 30 }, () => ({ type: "text", text: "x".repeat(900), id: "", accepted: [], tokens: [] })),
        { type: "blank", text: "", id: "b1", accepted: ["7"], tokens: [] },
      ];
    }),
    "payload_invalid",
    "payload > 16 KB",
  );
});

// ---------------------------------------------------------------------------------------------------------------
// Bütün iş: doğrulama + kayıt satırları (sahte DB; complete_prova_generation_v2'ye giden p_rows).
const parent = { familyId: "family", userId: "actor" };
const base: GenerationContext = {
  schema: "gina.generation-context.v1",
  subject: "Hayat Bilgisi",
  grade: 2,
  total: 3,
  topics: [{ topic: "Canlılar", count: 3 }],
  kind: "open_ended",
  difficulty: "kolay",
  locale: "tr",
  scenarioCode: null,
  blueprintSource: null,
  blueprintSnapshot: null,
  draftScope: null,
  document: null,
  ai: { model: "mock-model", maxOutputTokens: 2000, promptVersion: "s" },
  promptVersion: PROMPT_VERSION,
  promptHash: "b".repeat(64),
  systemPrompt: "SYSTEM-GİZLİ",
  userPrompt: '{"scope":"PROMPT-GİZLİ"}',
  catalogueBound: false,
  interactionTypes: ["open_ended", "true_false", "matching"],
  writtenTrack: false,
};
const openEnded = {
  interaction_type: "open_ended",
  topic: "Canlılar",
  kind: "open_ended",
  difficulty: "kolay",
  stem: "Bitkiler neden suya ihtiyaç duyar?",
  choices: [],
  correct_key: "",
  distractor_notes: [],
  expected_answer: "Büyümek ve besin üretmek için.",
  solution: "Çözüm",
  explanation: "",
  source_urls: [],
};
const output = (questions: unknown[]) => ({ output: { questions, shared_sources: [] }, inputTokens: 5, outputTokens: 7 });
function db(recovery: unknown) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return Promise.resolve(name === "resume_prova_generation" ? { data: recovery, error: null } : { data: { ok: true }, error: null });
    },
    from: () => {
      throw Error("no table reads");
    },
  } as unknown as ReturnType<typeof serviceClient>;
  return { client, calls };
}
const rejectCodes = (r: unknown, c: GenerationContext) => {
  try {
    validateGenerationResult(r as Any, c);
  } catch (e) {
    assert(e instanceof Error && e.message === "ai_result_invalid");
    return e instanceof GenerationInvalidError ? e.codes : [];
  }
  throw new Error("expected rejection");
};

Deno.test("job: mixed legacy + structured rows; legacy row unchanged, structured row split into payload/answer_key", async () => {
  const r = output([openEnded, aiStructured.true_false(), aiStructured.matching()]);
  validateGenerationResult(r as Any, base);
  const f = db({ context: base, provider_result: r, lease: "lease" });
  const res = await recoverGeneration(f.client, parent, "id", {});
  assert(res);
  assertEquals(res.status, 200);
  const rows = f.calls[1].args.p_rows as Record<string, Any>[];
  assertEquals(f.calls[1].name, "complete_prova_generation_v2");
  assertEquals(rows.length, 3);
  // Eski satır: eski anahtarlar, ayırıcı/payload/anahtar yok (SQL eski dala gider).
  assertEquals(Object.keys(rows[0]), [
    "family_id", "grade", "subject", "topic", "scenario_code", "kind", "difficulty", "stem", "choices", "correct_key",
    "expected_answer", "solution", "explanation", "source_urls", "provenance", "created_by",
  ]);
  const tf = rows[1];
  assertEquals(tf.interaction_type, "true_false");
  assertEquals(tf.schema_version, 1);
  assertEquals(tf.payload, { statements: [{ id: "s1", text: "Güneş bir yıldızdır." }, { id: "s2", text: "Ay kendi ışığını üretir." }, { id: "s3", text: "Bitkiler büyümek için suya ihtiyaç duyar." }] });
  assertEquals(tf.answer_key, { answers: { s1: true, s2: false, s3: true } });
  for (const k of ["kind", "choices", "correct_key", "expected_answer", "structure"]) assert(!(k in tf), "structured row has no " + k);
  assertEquals(rows[2].answer_key, { pairs: { l1: "r1", l2: "r2" } });
  for (const row of rows.slice(1)) {
    const payload = JSON.stringify(row.payload);
    for (const secret of ["ÇÖZÜM-GİZLİ", "SYSTEM-GİZLİ", "PROMPT-GİZLİ", "mock-model", "pairs", "answers"]) assert(!payload.includes(secret), secret);
    assert(!JSON.stringify(row.provenance).includes('"answer_key"'), "key not duplicated into provenance");
    assertEquals(row.provenance.generator, "ai");
    assertEquals(row.provenance.prompt_version, "prova-generate/v9-structured-types");
  }
});
Deno.test("job: one invalid structured row rejects the whole job before saving (no complete, no charge) with fixed reason codes", async () => {
  const bad = output([openEnded, aiStructured.true_false(), mutate(aiStructured.matching(), (s) => (s.pairs[0].right = "r9"))]);
  assertEquals(rejectCodes(bad, base), ["key_value_invalid"]);
  const f = db({ context: base, provider_result: bad, lease: "lease" });
  const res = await recoverGeneration(f.client, parent, "id", {});
  assert(res);
  assertEquals(res.status, 502);
  const body = await res.json();
  assert(isContractBody(body));
  assertEquals(body.error, "ai_result_invalid");
  assertEquals(body.details, { reasons: "key_value_invalid" });
  assertEquals(f.calls.map((c) => c.name), ["resume_prova_generation"], "complete_prova_generation_v2 never called");
});
Deno.test("job: type not requested, practice type on written track, legacy row without discriminant, count mismatch", () => {
  assertEquals(rejectCodes(output([openEnded, aiStructured.true_false(), aiStructured.classification()]), base), ["interaction_type_not_requested"]);
  const written: GenerationContext = { ...base, interactionTypes: ["open_ended", "true_false", "matching"], writtenTrack: true };
  assertEquals(rejectCodes(output([openEnded, aiStructured.true_false(), aiStructured.matching()]), written), ["interaction_type_not_allowed_for_track"]);
  const { interaction_type: _drop, ...noTag } = openEnded;
  assertEquals(rejectCodes(output([noTag, aiStructured.true_false(), aiStructured.matching()]), base), []);
  assertEquals(rejectCodes(output([{ ...openEnded, interaction_type: "multiple_choice" }, aiStructured.true_false(), aiStructured.matching()]), base), []);
  assertEquals(rejectCodes(output([aiStructured.true_false(), aiStructured.matching()]), base), [], "fewer questions than requested");
  assertEquals(rejectCodes(output([openEnded, aiStructured.true_false(), mutate(aiStructured.matching(), (_s, q) => (q.topic = "Başka"))]), base), ["topic_invalid"]);
});
Deno.test("job: a legacy (pre-QT) context never accepts structured output, even if the model sends it", () => {
  const { interactionTypes: _a, writtenTrack: _b, ...legacy } = base;
  assertEquals(rejectCodes(output([openEnded, aiStructured.true_false(), aiStructured.matching()]), { ...legacy, kind: "mixed" }), []);
});
Deno.test("job: person names in structured child-visible text are flagged for parent review (not rejected)", async () => {
  const named = mutate(aiStructured.true_false(), (s) => (s.statements[0].text = "Ali her sabah süt içer."));
  const r = output([openEnded, named, aiStructured.matching()]);
  const f = db({ context: base, provider_result: r, lease: "lease" });
  const res = await recoverGeneration(f.client, parent, "id", {});
  assert(res && res.status === 200);
  const rows = f.calls[1].args.p_rows as Record<string, Any>[];
  const review = rows[1].provenance.content_review;
  assertEquals(review.flags[0].names, ["Ali"]);
  assertEquals(review.flags[0].fields, ["statements_s1"]);
  assertEquals(rows[2].provenance.content_review, undefined);
});
Deno.test("job: shared passage with a structured question keeps the self-contained stem contract", async () => {
  const r = {
    output: {
      shared_sources: [{ id: "P1", kind: "text", content: "Bir bahçede kedi, serçe ve papatya vardır." }],
      questions: [
        { ...openEnded, shared_source_id: "P1" },
        mutate(aiStructured.true_false(), (_s, q) => (q.shared_source_id = "P1")),
        aiStructured.matching(),
      ],
    },
    inputTokens: 1,
    outputTokens: 1,
  };
  const f = db({ context: base, provider_result: r, lease: "lease" });
  const res = await recoverGeneration(f.client, parent, "id", {});
  assert(res && res.status === 200);
  const rows = f.calls[1].args.p_rows as Record<string, Any>[];
  assert(rows[1].stem.startsWith("Ortak metin\nBir bahçede"));
  assertEquals(rows[1].provenance.shared_prompt, "Aşağıdaki ifadeler doğru mu, yanlış mı?");
  assertEquals(rows[1].provenance.shared_source_id, "P1");
});
