import { assertEquals } from "jsr:@std/assert";
import { ANSWER_KEY_RULE, answerKeyExtras, gradingPurpose, rubricAssesses } from "./answer-key.ts";

Deno.test("answer key: legacy provenance has no extras", () => {
  assertEquals(answerKeyExtras({ generator: "parent" }), {
    alternatif_dogru_cevaplar: [],
    rubrik: [],
    degerlendirme_amaci: "sorudan_cikar",
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

Deno.test("D6/B3: AI rubric (D5 real shape, total 5) reaches the grader on the 0–100 scale; parent rubric unchanged", () => {
  const rubric = {
    criteria: [{ text: "Ölçüm aracını adlandırır", points: 2 }, { text: "Birimi yazar", points: 2 }, { text: "Gerekçe verir", points: 1 }],
    alternative_answers: ["dinamometre ile"],
  };
  assertEquals(answerKeyExtras({ generator: "ai", rubric }).rubrik.map((c) => c.puan), [40, 40, 20]);
  assertEquals(answerKeyExtras({ generator: "parent", rubric }).rubrik.map((c) => c.puan), [2, 2, 1]);
  assertEquals(
    answerKeyExtras({ generator: "parent", rubric: { criteria: [{ text: "a", points: 40 }, { text: "b", points: 60 }], alternative_answers: [] } }).rubrik.map((c) => c.puan),
    [40, 60],
  );
});

Deno.test("D13: rubric.assesses maps to degerlendirme_amaci; legacy/invalid values fall back to stem inference", () => {
  const rubric = { criteria: [{ text: "Sonuç", points: 100 }], alternative_answers: [] };
  assertEquals(answerKeyExtras({ generator: "ai", rubric: { ...rubric, assesses: "result" } }).degerlendirme_amaci, "sonuc");
  assertEquals(answerKeyExtras({ generator: "ai", rubric: { ...rubric, assesses: "process" } }).degerlendirme_amaci, "surec");
  assertEquals(answerKeyExtras({ generator: "parent", rubric }).degerlendirme_amaci, "sorudan_cikar");
  for (const bad of ["", "Process", 1, null, ["result"]]) {
    assertEquals(rubricAssesses({ rubric: { ...rubric, assesses: bad } }), null);
    assertEquals(gradingPurpose({ rubric: { ...rubric, assesses: bad } }), "sorudan_cikar");
  }
  assertEquals(gradingPurpose(null), "sorudan_cikar");
  assertEquals(ANSWER_KEY_RULE.includes('"sonuc"') && ANSWER_KEY_RULE.includes('"surec"'), true);
});
