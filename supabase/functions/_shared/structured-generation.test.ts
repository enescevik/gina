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
  disabledInteractionTypes,
  legacyKindFor,
  parseInteractionTypes,
  splitStructuredQuestion,
  STRUCTURE_JSON_SCHEMAS,
  STRUCTURED_PROMPT,
  STRUCTURED_PROMPT_VERSION,
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
Deno.test("legacy provider schema stays stable and the quality prompt is explicitly versioned", async () => {
  assertEquals(await sha256(JSON.stringify(SCHEMA)), "612ca930824fd43452af1bec4006e80af4e980bb9d256c5af369675273e54a2b");
  assertEquals(await sha256(SYSTEM_PROMPT), "2e64e9026588966beb96f38244cec83e8c4772b635d2148d574d9535cc6d09fd");
  assertEquals(PROMPT_VERSION, "prova-generate/v11-quality-controls");
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
  mark_text: ["unit", "segments", "segments[].id", "segments[].text", "max_select"],
  error_fix: ["unit", "segments", "segments[].id", "segments[].text"],
  multi_choice: ["options", "options[].id", "options[].text", "select_count"],
  two_stage: [
    "stage1", "stage1.prompt", "stage1.options", "stage1.options[].id", "stage1.options[].text",
    "stage2", "stage2.prompt", "stage2.mode", "stage2.options", "stage2.options[].id", "stage2.options[].text",
  ],
  region_select: ["figure", "figure.kind", "figure.rows", "figure.cols", "regions", "regions[].id", "regions[].text", "max_select"],
  clock: ["mode", "display", "step_minutes", "shown_time"],
};
const STIMULUS_PATHS = [
  "stimulus", "stimulus.kind", "stimulus.caption", "stimulus.alt", "stimulus.columns", "stimulus.rows",
  "stimulus.bars", "stimulus.bars[].label", "stimulus.bars[].value", "stimulus.x_label", "stimulus.y_label", "stimulus.unit",
];
const paths = (o: Any, p = ""): string[] =>
  Object.entries(o).flatMap(([k, v]) => [
    p + k,
    ...(Array.isArray(v) ? v.flatMap((e) => (e && typeof e === "object" && !Array.isArray(e) ? paths(e, `${p}${k}[].`) : [])) : []),
    ...(v && typeof v === "object" && !Array.isArray(v) ? paths(v, `${p}${k}.`) : []),
  ]);
for (const name of Object.keys(aiStructured) as AiStructuredName[]) {
  Deno.test("split " + name + ": valid, payload rebuilt from allowlist only, nothing private leaks", () => {
    const q = aiStructured[name]();
    const r = splitStructuredQuestion(q);
    assert(r.ok, JSON.stringify(r));
    const { payload, answer_key, interaction_type, schema_version } = r.value;
    assertEquals(schema_version, 1);
    for (const p of new Set(paths(payload))) {
      assert([...PAYLOAD_KEYS[interaction_type]!, ...STIMULUS_PATHS].includes(p), `${name}: payload path ${p}`);
    }
    const json = JSON.stringify(payload);
    for (
      const secret of [
        "ÇÖZÜM-GİZLİ", "answer", "accepted", "tokens", "pairs", "orders", "category", "membership", "unit_factors", "prova-generate",
        "targets", "errors", "correct", "key_mode", "accept_12h", '"none"',
      ]
    ) {
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
    assertEquals(row.provenance.prompt_version, "prova-generate/v11-quality-controls");
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

// ---------------------------------------------------------------------------------------------------------------
// Faz 2A / 2B / uyaran (QT-AI v10)
Deno.test("2A/2B: practice-only on written/OYSS, prompt appendix and base quality prompt versioned separately", () => {
  const all: Any[] = ["mark_text", "error_fix", "multi_choice", "two_stage", "region_select", "clock"];
  assertEquals(parseInteractionTypes(all, false), { types: all });
  assertEquals(parseInteractionTypes(["open_ended", ...all], true), {
    error: "interaction_type_not_allowed_for_track",
    details: { track: "meb_common", types: all.join(",") },
  });
  assertEquals(STRUCTURED_PROMPT_VERSION, "prova-generate/v11-quality-structured-phase2");
  assertEquals(PROMPT_VERSION, "prova-generate/v11-quality-controls", "legacy route uses the versioned quality prompt");
  for (const t of [...all, "stimulus"]) assert(STRUCTURED_PROMPT.includes(t), t);
  assert(STRUCTURED_PROMPT.includes("Görsel/resim üzerinde bölge asla yok"));
  const s: Any = structuredGenerationSchema(SCHEMA as Any, all as Any, vocab);
  assertEquals(strictEverywhere(s), []);
  const region = s.properties.questions.items.anyOf.find((v: Any) => v.properties.interaction_type.enum[0] === "region_select");
  assertEquals(region.properties.structure.properties.figure.properties.kind.enum, ["grid", "sectors"], "no image regions in the AI schema");
  for (const v of s.properties.questions.items.anyOf) assertEquals(v.properties.stimulus.properties.kind.enum, ["none", "table", "bar_chart"]);
});
Deno.test("2A/2B: disabled types are refused before any provider call; read failure is not treated as enabled", async () => {
  const table = (rows: unknown, error: unknown = null) => ({
    from: (t: string) => {
      assertEquals(t, "interaction_types");
      return { select: () => ({ in: (_c: string, v: string[]) => Promise.resolve({ data: error ? null : (rows as Any[]).filter((r) => v.includes(r.type)), error }) }) };
    },
  });
  const rows = [{ type: "true_false", enabled: true }, { type: "mark_text", enabled: false }, { type: "clock", enabled: false }];
  assertEquals(await disabledInteractionTypes(table(rows), ["open_ended", "true_false", "mark_text", "clock"]), ["mark_text", "clock"]);
  assertEquals(await disabledInteractionTypes(table(rows), ["true_false"]), []);
  assertEquals(await disabledInteractionTypes(table(rows), ["multiple_choice"]), [], "legacy types need no lookup");
  assertEquals(await disabledInteractionTypes(table(rows, { message: "x" }), ["true_false"]), null);
  assertEquals(await disabledInteractionTypes(table([{ type: "mark_text", enabled: true }]), ["mark_text", "two_stage"]), ["two_stage"], "unknown row = disabled");
});
Deno.test("2A/2B split keys equal the core contract shapes", () => {
  const ok = (n: AiStructuredName) => {
    const r = splitStructuredQuestion(aiStructured[n]());
    assert(r.ok, n + JSON.stringify(r));
    return r.value as Any;
  };
  assertEquals(ok("mark_text").answer_key, { targets: ["w3", "w4"] });
  assertEquals(ok("mark_text").payload.segments[1], { text: " " }, "non-selectable piece has no id");
  assertEquals(ok("error_fix").answer_key, { errors: { w2: { accepted: ["herkes"] } }, fix_policy: "review_unmatched", case_insensitive: true });
  assertEquals(ok("multi_choice").answer_key, { correct: ["a", "c"] });
  assert(!("select_count" in ok("multi_choice").payload));
  assertEquals(ok("two_stage").answer_key, { stage1: "a", stage2: "c" });
  assertEquals(ok("region_grid").payload.figure, { kind: "grid", rows: 2, cols: 2 });
  assertEquals(ok("region_grid").answer_key, { count: 3 });
  assertEquals(ok("region_sectors").payload.figure, { kind: "sectors" });
  assertEquals(ok("clock_read").payload, { mode: "read", display: "analog", step_minutes: 15, shown_time: "03:15" });
  assertEquals(ok("clock_set").payload, { mode: "set", display: "analog", step_minutes: 30 });
  assertEquals(ok("clock_set").answer_key, { time: "07:30", accept_12h: true });
  assertEquals(ok("numeric_table").payload.stimulus, {
    kind: "table", caption: "Sınıf mevcutları", alt: "İki satırlı tablo: 2-A sınıfında 23, 2-B sınıfında 24 öğrenci var.", columns: ["Sınıf", "Öğrenci"], rows: [["2-A", "23"], ["2-B", "24"]],
  });
  assertEquals(Object.keys(ok("multi_choice_chart").payload.stimulus), ["kind", "alt", "x_label", "y_label", "unit", "bars"], "empty caption dropped");
  assert(!("stimulus" in ok("true_false").payload), "kind none → no stimulus");
});
Deno.test("red-team 2A mark_text: targets not in text, all targets, unit mismatch, ambiguous twins, stem lists answers", () => {
  expectCode(mutate(aiStructured.mark_text(), (s) => (s.targets = ["w9"])), "key_value_invalid", "target not in the text");
  expectCode(mutate(aiStructured.mark_text(), (s) => (s.targets = ["w1", "w2", "w3", "w4"])), "selection_balance_invalid", "every segment a target");
  expectCode(mutate(aiStructured.mark_text(), (s) => (s.targets = [])), "selection_balance_invalid", "no target");
  expectCode(mutate(aiStructured.mark_text(), (s) => (s.segments[0].text = "Küçük kedi")), "segment_unit_mismatch", "two words in a word segment");
  expectCode(mutate(aiStructured.mark_text(), (s) => (s.segments[2].text = "koştu")), "duplicate_text", "same word marked once, unmarked once");
  expectCode(mutate(aiStructured.mark_text(), (_s, q) => (q.stem = "Şu sözcükleri işaretle: koştu, zıpladı.")), "payload_answer_leak", "stem lists the targets");
  expectCode(mutate(aiStructured.mark_text(), (s) => (s.max_select = 1)), "max_select_invalid", "limit below target count");
});
Deno.test("red-team 2A error_fix: 'error' that is actually correct, fix in stem, no error, ambiguous twin", () => {
  expectCode(mutate(aiStructured.error_fix(), (s) => (s.errors = [{ id: "w3", accepted: ["erken"] }])), "error_not_wrong", "correct word marked as error");
  expectCode(mutate(aiStructured.error_fix(), (s) => (s.errors[0].accepted = ["herkes", "Herkez"])), "error_not_wrong", "shown spelling also accepted");
  expectCode(mutate(aiStructured.error_fix(), (_s, q) => (q.stem = "herkes sözcüğünü doğru yaz.")), "payload_answer_leak", "fix in instructions");
  expectCode(mutate(aiStructured.error_fix(), (s) => (s.errors = [])), "selection_balance_invalid", "no error at all");
  expectCode(mutate(aiStructured.error_fix(), (s) => (s.errors[0].id = "w9")), "key_unknown_id", "error on unknown segment");
  expectCode(mutate(aiStructured.error_fix(), (s) => s.errors.push({ id: "w2", accepted: ["herkes"] })), "duplicate_id", "duplicate error entry");
  expectCode(mutate(aiStructured.error_fix(), (s) => (s.segments[4].text = "herkez")), "duplicate_text", "same wrong spelling, only one flagged");
  expectCode(mutate(aiStructured.error_fix(), (s) => (s.find_weight = 2)), "weights_invalid", "find weight out of range");
});
Deno.test("red-team 2A multi_choice: all-correct, none, select_count mismatch, duplicate options", () => {
  expectCode(mutate(aiStructured.multi_choice(), (s) => (s.correct = ["a", "b", "c", "d"])), "selection_balance_invalid", "all options correct");
  expectCode(mutate(aiStructured.multi_choice(), (s) => (s.correct = [])), "selection_balance_invalid", "no correct option");
  expectCode(mutate(aiStructured.multi_choice(), (s) => (s.select_count = 3)), "select_count_mismatch", "told 3, key has 2");
  expectCode(mutate(aiStructured.multi_choice(), (s) => (s.options[3].text = "kedi")), "duplicate_text", "same-looking options");
  expectCode(mutate(aiStructured.multi_choice(), (s) => (s.options = s.options.slice(0, 2))), "options_invalid", "two options only");
});
Deno.test("red-team 2A two_stage: stage 2 reveals stage 1, mode/key mismatch, shared ids", () => {
  expectCode(mutate(aiStructured.two_stage(), (s) => (s.stage2.prompt = "Su neden katı hâle geçer?")), "stage_reveals_answer", "stage 2 prompt names the answer");
  expectCode(mutate(aiStructured.two_stage(), (s) => (s.stage2.options[0].text = "Katı olduğu için.")), "stage_reveals_answer", "stage 2 option names the answer");
  expectCode(mutate(aiStructured.two_stage(), (s) => (s.stage2.options[1].id = "a")), "stage_invalid", "stage 2 reuses a stage 1 id");
  expectCode(mutate(aiStructured.two_stage(), (s) => (s.stage1_answer = "z")), "key_value_invalid", "unknown stage 1 answer");
  expectCode(mutate(aiStructured.two_stage(), (s) => (s.stage2.mode = "text")), "stage_invalid", "text mode with options");
  expectCode(mutate(aiStructured.two_stage(), (s) => { s.stage2.mode = "text"; s.stage2.options = []; }), "key_value_invalid", "text mode with a stage 2 key");
  const text = mutate(aiStructured.two_stage(), (s) => { s.stage2.mode = "text"; s.stage2.options = []; s.stage2_answer = ""; });
  const r = splitStructuredQuestion(text);
  assert(r.ok);
  assertEquals(r.value.answer_key, { stage1: "a" });
  assertEquals(r.value.payload.stage2, { prompt: "Seçimini hangi bilgi destekler?", mode: "text" });
});
Deno.test("red-team 2B clock: read shown_time ≠ key, off-step key, stem states the time, digital read, set with shown time", () => {
  expectCode(mutate(aiStructured.clock_read(), (s) => (s.time = "03:30")), "clock_invalid", "read: shown time differs from key");
  expectCode(mutate(aiStructured.clock_read(), (s) => { s.time = "03:10"; s.shown_time = "03:10"; }), "key_not_on_step", "key off the 15-minute step");
  expectCode(mutate(aiStructured.clock_read(), (_s, q) => (q.stem = "Saat 3:15'i gösteriyor; saati yaz.")), "payload_answer_leak", "read stem says the time");
  expectCode(mutate(aiStructured.clock_read(), (s) => (s.display = "digital")), "clock_trivial", "copying a digital clock");
  expectCode(mutate(aiStructured.clock_set(), (s) => (s.shown_time = "07:30")), "clock_invalid", "set mode shows the answer");
  expectCode(mutate(aiStructured.clock_set(), (s) => (s.time = "7:30")), "key_invalid", "malformed time");
  expectCode(mutate(aiStructured.clock_set(), (s) => (s.step_minutes = 10)), "clock_invalid", "unsupported step");
});
Deno.test("red-team 2B region_select: count ≥ parts, fraction vs parts, image figure, grid size, duplicate labels", () => {
  expectCode(mutate(aiStructured.region_grid(), (s) => (s.count = 4)), "key_value_invalid", "count equals the number of parts");
  expectCode(mutate(aiStructured.region_grid(), (s) => (s.count = 5)), "key_value_invalid", "count above the number of parts");
  expectCode(mutate(aiStructured.region_grid(), (s) => (s.count = 2)), "fraction_mismatch", "3/4 asked, 2 of 4 keyed");
  expectCode(mutate(aiStructured.region_sectors(), (_s, q) => (q.stem = "Dairenin dörtte birini boya.")), "fraction_mismatch", "1/4 of 6 slices");
  expectCode(mutate(aiStructured.region_sectors(), (_s, q) => (q.stem = "6 eş parçadan 2 tanesini boya.")), "fraction_mismatch", "2 of 6 asked, 3 keyed");
  assert(splitStructuredQuestion(mutate(aiStructured.region_sectors(), (_s, q) => (q.stem = "Dairenin altıda üçünü boya."))).ok, "3/6 of 6, count 3");
  expectCode(mutate(aiStructured.region_grid(), (s) => (s.figure.kind = "image")), "figure_invalid", "image regions never from AI");
  expectCode(mutate(aiStructured.region_grid(), (s) => (s.figure.cols = 3)), "figure_invalid", "2x3 grid with 4 regions");
  expectCode(mutate(aiStructured.region_sectors(), (s) => (s.figure.rows = 2)), "figure_invalid", "sectors with rows");
  expectCode(mutate(aiStructured.region_grid(), (s) => (s.regions[1].text = "1. satır 1. sütun")), "duplicate_text", "duplicate region label");
  expectCode(mutate(aiStructured.region_grid(), (s) => { s.key_mode = "targets"; s.targets = ["r1"]; }), "key_invalid", "targets mode with a count");
  expectCode(mutate(aiStructured.region_grid(), (s) => { s.key_mode = "targets"; s.count = 0; s.targets = ["r1", "r9"]; }), "key_value_invalid", "unknown target region");
  expectCode(mutate(aiStructured.region_grid(), (_s, q) => (q.stem = "Resimdeki karelerin 3/4'ünü boya.")), "image_reference_unavailable", "picture reference");
  assert(splitStructuredQuestion(mutate(aiStructured.region_grid(), (_s, q) => (q.stem = "Şekildeki karelerin 3/4'ünü boya."))).ok, "the drawn figure may be referenced");
});
Deno.test("red-team stimulus: alt that states the answer, missing alt, shape errors, stray fields on 'none'", () => {
  expectCode(mutate(aiStructured.numeric_table(), (_s, q) => (q.stimulus.alt = "Tabloda iki sınıf var; toplam 47 öğrenci.")), "stimulus_reveals_answer", "alt gives the computed total");
  expectCode(mutate(aiStructured.numeric_table(), (_s, q) => (q.stimulus.caption = "Toplam 47")), "stimulus_reveals_answer", "caption gives the answer");
  expectCode(mutate(aiStructured.clock_set(), (_s, q) => { q.stimulus = { ...q.stimulus, kind: "table", alt: "Okul 07:30'da başlar.", columns: ["Ders"], rows: [["Matematik"]] }; }), "stimulus_reveals_answer", "alt gives the time");
  expectCode(mutate(aiStructured.two_stage(), (_s, q) => { q.stimulus = { ...q.stimulus, kind: "table", alt: "Doğru seçenek katı olandır.", columns: ["Madde"], rows: [["Su"]] }; }), "stimulus_reveals_answer", "alt names the stage 1 answer");
  assert(splitStructuredQuestion(aiStructured.multi_choice_chart()).ok, "alt may restate data values/labels");
  expectCode(mutate(aiStructured.numeric_table(), (_s, q) => (q.stimulus.alt = "")), "stimulus_alt_invalid", "missing alt");
  expectCode(mutate(aiStructured.numeric_table(), (_s, q) => (q.stimulus.rows = [["2-A"]])), "stimulus_invalid", "row shorter than columns");
  expectCode(mutate(aiStructured.numeric_table(), (_s, q) => (q.stimulus.bars = [{ label: "x", value: 1 }])), "stimulus_invalid", "bars on a table");
  expectCode(mutate(aiStructured.multi_choice_chart(), (_s, q) => (q.stimulus.bars = q.stimulus.bars.slice(0, 1))), "stimulus_invalid", "one bar");
  expectCode(mutate(aiStructured.multi_choice_chart(), (_s, q) => (q.stimulus.bars[0].value = -1)), "stimulus_invalid", "negative bar");
  expectCode(mutate(aiStructured.true_false(), (_s, q) => (q.stimulus.alt = "bir şey")), "stimulus_invalid", "alt on kind none");
  expectCode(mutate(aiStructured.true_false(), (_s, q) => (q.stimulus = { kind: "image", alt: "foto" })), "stimulus_invalid", "image stimulus / missing fields");
  expectCode(mutate(aiStructured.true_false(), (_s, q) => delete q.stimulus), "payload_unknown_field", "stimulus field is required in the AI form");
});
Deno.test("job: 2A/2B rows flow to complete_prova_generation_v2 with payload/key split and person-name scan of nested text", async () => {
  const ctx: GenerationContext = {
    ...base,
    total: 4,
    topics: [{ topic: "Canlılar", count: 4 }],
    interactionTypes: ["two_stage", "multi_choice", "region_select", "clock"],
    promptVersion: "prova-generate/v11-quality-structured-phase2",
  };
  const named = mutate(aiStructured.two_stage(), (s) => (s.stage1.prompt = "Ayşe suyu dondurucuya koydu. Su hangi hâle geçer?"));
  const r = output([named, aiStructured.multi_choice_chart(), aiStructured.region_grid(), aiStructured.clock_read()]);
  const f = db({ context: ctx, provider_result: r, lease: "lease" });
  const res = await recoverGeneration(f.client, parent, "id", {});
  assert(res && res.status === 200);
  const rows = f.calls[1].args.p_rows as Record<string, Any>[];
  assertEquals(rows.map((x) => x.interaction_type), ["two_stage", "multi_choice", "region_select", "clock"]);
  assertEquals(rows[0].provenance.content_review.flags[0].fields, ["stage1_prompt"]);
  assertEquals(rows[1].payload.stimulus.kind, "bar_chart");
  assertEquals(rows[3].answer_key, { time: "03:15", accept_12h: true });
  for (const row of rows) {
    assertEquals(row.provenance.prompt_version, "prova-generate/v11-quality-structured-phase2");
    assert(!/"(correct|targets|count|time|stage1_answer|accept_12h)"/.test(JSON.stringify(row.payload)), "key in payload");
  }
  const written: GenerationContext = { ...ctx, writtenTrack: true };
  assertEquals(rejectCodes(r, written), ["interaction_type_not_allowed_for_track"]);
});
