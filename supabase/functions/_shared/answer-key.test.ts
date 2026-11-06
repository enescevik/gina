import { assertEquals } from "jsr:@std/assert";
import { ANSWER_KEY_RULE, answerKeyExtras } from "./answer-key.ts";

Deno.test("answer key: legacy provenance has no extras", () => {
  assertEquals(answerKeyExtras({ generator: "parent" }), {
    alternatif_dogru_cevaplar: [],
    rubrik: [],
  });
  assertEquals(answerKeyExtras(null).rubrik, []);
  assertEquals(answerKeyExtras("x").alternatif_dogru_cevaplar, []);
});

Deno.test("answer key: parent/AI rubric shape is read and cleaned", () => {
  const extras = answerKeyExtras({
    generator: "ai",
    rubric: {
      criteria: [
        { text: " Ortak böleni bulur ", points: 40 },
        { text: "", points: 10 },
        { text: "Sonuç", points: 160 },
        { text: "Sonucu yazar", points: 59.6 },
        "bozuk",
      ],
      alternative_answers: ["0,5", " yarım ", "", 3, "0,5"],
    },
  });
  assertEquals(extras.alternatif_dogru_cevaplar, ["0,5", "yarım"]);
  assertEquals(extras.rubrik, [
    { olcut: "Ortak böleni bulur", puan: 40 },
    { olcut: "Sonucu yazar", puan: 60 },
  ]);
});

Deno.test("answer key: masking applies to rubric and alternatives", () => {
  const extras = answerKeyExtras(
    { rubric: { criteria: [{ text: "Ada adını yazar", points: 10 }], alternative_answers: ["Ada"] } },
    (t) => t.replaceAll("Ada", "[ad]"),
  );
  assertEquals(extras.rubrik[0].olcut, "[ad] adını yazar");
  assertEquals(extras.alternatif_dogru_cevaplar, ["[ad]"]);
});

Deno.test("answer key: list sizes are bounded", () => {
  const many = Array.from({ length: 30 }, (_, i) => `c${i}`);
  const extras = answerKeyExtras({
    rubric: {
      criteria: many.map((text) => ({ text, points: 1 })),
      alternative_answers: many,
    },
  });
  assertEquals(extras.rubrik.length, 10);
  assertEquals(extras.alternatif_dogru_cevaplar.length, 10);
  assertEquals(ANSWER_KEY_RULE.includes("alternatif_dogru_cevaplar"), true);
});
