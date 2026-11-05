import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import { cataloguePlan } from "./catalogue-plan.ts";
import { blueprintPlan } from "./blueprint-plan.ts";
const long = "Tam öğrenme çıktısı ".repeat(40);
const source = {
  origin: "reviewed_catalogue",
  programme: "Synthetic review",
  school_scope: "Synthetic school scope",
  candidate: {
    grade: 5,
    subject: "İlköğretim Matematik",
    question_count: 2,
    blocks: [{
      count: 2,
      outcomes: [{ text: long, cell: "B12", code: null }, {
        text: "İkinci çıktı",
        cell: "B13",
        code: "MAT.5.3.1",
      }],
    }],
  },
};
const topics = [{ topic: "Blok 1", count: 2 }];
Deno.test("catalogue sends full joint outcomes under stable topic without child PII or endorsement", () => {
  const p = cataloguePlan(source, 5, "Matematik", topics);
  assertEquals(p.learning_blocks[0].outcomes[0].text, long);
  assertEquals(p.learning_blocks[0].outcomes.length, 2);
  assertEquals(p.learning_blocks[0].count, 2);
  assertEquals(p.officially_verified, false);
  assertEquals(p.candidate, source.candidate);
});
Deno.test("catalogue rejects mismatched grade, subject, topic/count and total before provider", () => {
  for (
    const [s, g, sub, rows] of [
      [source, 6, "Matematik", topics],
      [source, 5, "Fen", topics],
      [source, 5, "Matematik", [{ topic: "Changed", count: 2 }]],
      [source, 5, "Matematik", [{ topic: "Blok 1", count: 3 }]],
      [
        { ...source, candidate: { ...source.candidate, question_count: 3 } },
        5,
        "Matematik",
        topics,
      ],
    ] as const
  ) {
    assertThrows(
      () => cataloguePlan(s, g, sub, [...rows]),
      Error,
      "curriculum_scope_mismatch",
    );
  }
});
Deno.test("public JSON cannot upgrade a manual source to reviewed provenance", () => {
  const p = blueprintPlan(
    {
      name: "Manual",
      grade: 5,
      subject: "Matematik",
      rows: topics,
      source_context: { ...source, officially_verified: true },
    },
    5,
    "Matematik",
  );
  assertEquals(p.context.origin, "parent_entered");
  assertEquals(p.context.officially_verified, false);
});
Deno.test("known subject aliases retain existing manual distributions", () => {
  const p = blueprintPlan(
    { name: "Manual", grade: 5, subject: "Fen Bilimleri", rows: topics },
    5,
    "Fen",
  );
  assertEquals(p.topics, topics);
  assertThrows(
    () =>
      blueprintPlan(
        { name: "Manual", grade: 5, subject: "Fizik", rows: topics },
        5,
        "Fen",
      ),
    Error,
    "blueprint_mismatch",
  );
});

import { planPoolSelection } from "./catalogue-plan.ts";
const bound = {
  ...source,
  catalogue_id: "0f0f0f0f-0000-4000-8000-000000000001",
  revision: 2,
  content_hash: "abcdef0123456789".repeat(4),
  candidate: {
    ...source.candidate,
    sheet: "5. Sınıf",
    header_cell: "D6",
    source_url: "https://cdn.eba.gov.tr/yardimcikaynaklar/2026/09/KSDT/ilkmat2.xlsx",
    source_sha256: "d5429b5962a08adc04acd71ceaae2d517bca507f8b4cf94354bcd55a9670aebf",
    blocks: [{ ...source.candidate.blocks[0], count_cell: "D7" }],
  },
};
Deno.test("provider payload carries normalized block/outcome wording and a scenario version, not only a URL", () => {
  const p = cataloguePlan(bound, 5, "Matematik", topics);
  assertEquals(p.scenario.scenario_version, "0f0f0f0f-0000-4000-8000-000000000001@2:abcdef012345");
  assertEquals(p.scenario.source.sha256, bound.candidate.source_sha256);
  assertEquals(p.scenario.blocks, [{
    block_id: "B1",
    topic: "Blok 1",
    count: 2,
    outcome_ids: ["cell:B12", "MAT.5.3.1"],
    source_cells: { sheet: "5. Sınıf", count_cell: "D7", outcome_cells: ["B12", "B13"] },
  }]);
  assertEquals(p.learning_blocks[0].normalized_text, `cell:B12: ${long.trim()}\nMAT.5.3.1: İkinci çıktı`);
  // What prova-generate serialises as senaryo_kapsami: the full outcome text is present, the URL alone is not the payload.
  const payload = JSON.stringify({ senaryo_kapsami: p });
  assert(payload.includes(long.trim()));
  assert(payload.includes("İkinci çıktı"));
  assert(payload.length > bound.candidate.source_url.length * 4);
  assertEquals(p.officially_verified, false);
});
Deno.test("duplicate outcome identities inside one block are rejected", () => {
  const dup = { ...bound, candidate: { ...bound.candidate, blocks: [{ count: 2, count_cell: "D7", outcomes: [{ text: "a", cell: "B12", code: "MAT.5.3.1" }, { text: "b", cell: "B13", code: "MAT.5.3.1" }] }] } };
  assertThrows(() => cataloguePlan(dup, 5, "Matematik", topics), Error, "curriculum_scope_mismatch");
});
Deno.test("seven-question scenario is selected from a twenty-question pool; gaps are shown, never filled", () => {
  const blocks = [
    { block_id: "B1", count: 1, outcome_ids: ["MAT.5.3.1"] },
    { block_id: "B2", count: 2, outcome_ids: ["MAT.5.3.2", "MAT.5.3.3"] },
    { block_id: "B3", count: 1, outcome_ids: ["MAT.5.3.4"] },
    { block_id: "B4", count: 1, outcome_ids: ["MAT.5.3.5"] },
    { block_id: "B5", count: 1, outcome_ids: ["MAT.5.3.6"] },
    { block_id: "B6", count: 1, outcome_ids: ["MAT.5.3.7"] },
  ];
  const pool = Array.from({ length: 20 }, (_, i) => ({ id: `q${i + 1}`, outcome_ids: [`MAT.5.3.${(i % 7) + 1}`] }));
  const plan = planPoolSelection(blocks, pool);
  assertEquals(plan.total, 7);
  assertEquals(plan.selected, 7);
  assertEquals(plan.complete, true);
  assertEquals(plan.scenario_fit, "full_scenario");
  assertEquals(plan.blocks[1].question_ids.length, 2, "combined block takes two questions, not two per outcome");
  assertEquals(new Set(plan.blocks.flatMap((b) => b.question_ids)).size, 7, "no question reused");
  const thin = planPoolSelection(blocks, pool.filter((q) => !q.outcome_ids.includes("MAT.5.3.7")));
  assertEquals(thin.complete, false);
  assertEquals(thin.scenario_fit, "incomplete_show_gaps");
  assertEquals(thin.blocks[5], { block_id: "B6", required: 1, question_ids: [], missing: 1, missing_outcome_ids: ["MAT.5.3.7"] });
  assertEquals(thin.selected, 6, "missing outcome is not padded with another topic");
  const typed = planPoolSelection([{ block_id: "B1", count: 1, outcome_ids: ["MAT.5.3.1"], kind: "open_ended" }], [{ id: "mc", outcome_ids: ["MAT.5.3.1"], kind: "multiple_choice" }]);
  assertEquals(typed.blocks[0].missing, 1, "wrong question type is not accepted");
});
