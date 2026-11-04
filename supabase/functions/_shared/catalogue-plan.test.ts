import { assertEquals, assertThrows } from "jsr:@std/assert";
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
