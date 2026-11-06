import { describe, expect, it } from "vitest";
import { emptyAnswer, type AnswerOf, type ClassificationPayload, type FillBlankPayload } from "@gina/core";
import {
  canRender,
  cleanNumericInput,
  fillCounts,
  numericHint,
  orderingSummary,
  parentItemStatus,
  parseScoreInput,
  placeItem,
  placeToken,
  questionFillState,
  readOverrides,
  readStructuredAnswer,
  readStructuredSummary,
  reasonRequired,
  reviewRows,
  rightUses,
  tokenUses,
} from "./model";

const labels = { yes: "Doğru", no: "Yanlış", blank: (n: number) => `Boşluk ${n}`, value: "Sayı", unit: "Birim", position: (n: number) => `${n}.` };
const bank: FillBlankPayload = {
  segments: [{ type: "text", text: "Su donunca " }, { type: "blank", id: "b1" }, { type: "text", text: " olur, ısınınca " }, { type: "blank", id: "b2" }],
  input: "bank",
  bank: [{ id: "w1", text: "katı" }, { id: "w2", text: "buhar" }],
  bank_reuse: false,
};

describe("fill blank tap-to-place", () => {
  it("moves a non-reusable token out of its previous blank", () => {
    let a = emptyAnswer("fill_blank");
    a = placeToken(a, bank, "b1", "w1");
    a = placeToken(a, bank, "b2", "w1");
    expect(a.blanks).toEqual({ b2: { token: "w1" } });
    expect(tokenUses(a)).toEqual({ w1: ["b2"] });
  });
  it("keeps a reusable token in both blanks", () => {
    let a = emptyAnswer("fill_blank");
    a = placeToken(a, { ...bank, bank_reuse: true }, "b1", "w1");
    a = placeToken(a, { ...bank, bank_reuse: true }, "b2", "w1");
    expect(a.blanks).toEqual({ b1: { token: "w1" }, b2: { token: "w1" } });
  });
});

describe("classification capacity", () => {
  const p: ClassificationPayload = {
    items: [{ id: "i1", text: "Kedi" }, { id: "i2", text: "Köpek" }, { id: "i3", text: "Gül" }],
    categories: [{ id: "c1", text: "Hayvan", capacity: 1 }, { id: "c2", text: "Bitki" }],
  };
  it("refuses a full category but allows re-placing the same item", () => {
    const a = placeItem(emptyAnswer("classification"), p, "i1", "c1")!;
    expect(placeItem(a, p, "i2", "c1")).toBeNull();
    expect(placeItem(a, p, "i1", "c1")).toBe(a);
    expect(placeItem(a, p, "i2", "c2")!.placement).toEqual({ i1: "c1", i2: "c2" });
  });
});

describe("matching usage", () => {
  it("lists left items per right item", () => {
    const a: AnswerOf<"matching"> = { type: "matching", v: 1, pairs: { l1: "r1", l2: "r1", l3: "r2" } };
    expect(rightUses(a)).toEqual({ r1: ["l1", "l2"], r2: ["l3"] });
  });
});

describe("numeric hint", () => {
  it("never calls a parsable number wrong and hints only on non-numbers", () => {
    for (const v of ["1,5", "1.5", "3/4", "1 3/4", "1.250,5", "-2", ""]) expect(numericHint(v)).toBeNull();
    for (const v of ["1,5,5", "3/0", "1+1", "2e3"]) expect(numericHint(v)).toBe("not_a_number");
  });
  it("drops letters but keeps separators", () => {
    expect(cleanNumericInput("12a,5 cm")).toBe("12,5 ");
    expect(cleanNumericInput("1   3/4")).toBe("1 3/4");
  });
});

describe("fill state for navigator", () => {
  const tf = { kind: "structured", interaction_type: "true_false", payload: { statements: [{ id: "s1", text: "A" }, { id: "s2", text: "B" }] } };
  it("uses the shared answerState for structured items and legacy rules otherwise", () => {
    expect(questionFillState(tf, undefined)).toBe("unanswered");
    expect(questionFillState(tf, { answer: { type: "true_false", v: 1, items: { s1: true } } })).toBe("partial");
    expect(questionFillState(tf, { answer: { type: "true_false", v: 1, items: { s1: true, s2: false } } })).toBe("complete");
    expect(questionFillState({ kind: "multiple_choice" }, { key: "A" })).toBe("complete");
    expect(questionFillState({ kind: "open_ended" }, { text: "  " })).toBe("unanswered");
    expect(questionFillState({ kind: "open_ended" }, { hasDocument: true })).toBe("complete");
    expect(fillCounts(["unanswered", "partial", "complete", "partial"])).toEqual({ unanswered: 1, partial: 2, complete: 1 });
  });
  it("ordering is unanswered until the child touches it", () => {
    const q = { kind: "structured", interaction_type: "ordering", payload: { items: [{ id: "a", text: "x" }, { id: "b", text: "y" }], mode: "sequence" } };
    expect(questionFillState(q, {})).toBe("unanswered");
    expect(questionFillState(q, { answer: { type: "ordering", v: 1, order: ["b", "a"] } })).toBe("complete");
  });
});

describe("reading server data", () => {
  it("rejects unknown answer shapes instead of guessing", () => {
    expect(readStructuredAnswer("numeric", null)).toBeUndefined();
    expect(readStructuredAnswer("numeric", { type: "numeric", v: 1, value: "3" })).toEqual({ type: "numeric", v: 1, value: "3" });
    expect(() => readStructuredAnswer("numeric", { type: "numeric", v: 2 })).toThrow("client_update_required");
    expect(() => readStructuredAnswer("ordering", { type: "numeric", v: 1 })).toThrow("client_update_required");
  });
  it("only renders known types with schema version 1", () => {
    expect(canRender("numeric", 1, { units: [], unit_required: false, work_area: true })).toBe(true);
    expect(canRender("numeric", 2, { units: [], unit_required: false })).toBe(false);
    expect(canRender("hotspot", 1, {})).toBe(false);
    expect(canRender("matching", 1, { left: [], right: [], policy: "one_to_one" })).toBe(false);
  });
  it("parses summary rows and overrides, dropping malformed lists", () => {
    const row = { question_id: "q", position: 2, interaction_type: "matching", answer_state: "partial", outcome: "scored", score: 50, score_exact: 50, graded_by: "auto", auto_score: 50, answer_hash: "h" };
    expect(readStructuredSummary({ structured_answers: [row] })).toEqual([row]);
    expect(readStructuredSummary({ structured_answers: [{ bad: 1 }] })).toEqual([]);
    expect(readStructuredSummary({})).toEqual([]);
    expect(readOverrides([{ question_id: "q", auto_score: 50, previous_score: 50, parent_score: 80, reason: "ok", created_at: "2026-11-07" }])).toHaveLength(1);
  });
});

describe("parent status and score rules", () => {
  const base = { outcome: null, score: null, graded_by: null, answer_state: "unanswered" as const };
  it("separates scored, partial, waiting and unanswered", () => {
    expect(parentItemStatus({ ...base, outcome: "scored", score: 100, graded_by: "auto", answer_state: "complete" })).toBe("auto_scored");
    expect(parentItemStatus({ ...base, outcome: "scored", score: 40, graded_by: "auto", answer_state: "partial" })).toBe("auto_scored_partial");
    expect(parentItemStatus({ ...base, outcome: "pending_human", answer_state: "complete" })).toBe("pending_parent");
    expect(parentItemStatus(base)).toBe("unanswered");
    expect(parentItemStatus({ ...base, outcome: "unanswered", score: 0, graded_by: "parent" })).toBe("parent_scored");
  });
  it("requires a reason only when changing an automatic score", () => {
    expect(reasonRequired({ outcome: "scored", auto_score: 66.6667 }, 67)).toBe(false);
    expect(reasonRequired({ outcome: "scored", auto_score: 66.6667 }, 80)).toBe(true);
    expect(reasonRequired({ outcome: "pending_human", auto_score: 100 }, 50)).toBe(false);
    expect(reasonRequired({ outcome: null, auto_score: null }, 0)).toBe(false);
  });
  it("accepts integer scores 0–100 only", () => {
    expect(parseScoreInput("0")).toBe(0);
    expect(parseScoreInput(" 100 ")).toBe(100);
    for (const v of ["101", "-1", "4.5", "", "abc"]) expect(parseScoreInput(v)).toBeNull();
  });
});

describe("review rows", () => {
  it("true/false shows given, expected and server marks", () => {
    const rows = reviewRows("true_false", { statements: [{ id: "s1", text: "Güneş bir yıldızdır." }, { id: "s2", text: "Ay ışık üretir." }] },
      { type: "true_false", v: 1, items: { s1: true } },
      { outcome: "scored", items: { s1: { answered: true, correct: true }, s2: { answered: false, correct: false } } },
      { answers: { s1: true, s2: false } }, labels);
    expect(rows).toEqual([
      { id: "s1", prompt: "Güneş bir yıldızdır.", given: "Doğru", expected: "Doğru", mark: "correct" },
      { id: "s2", prompt: "Ay ışık üretir.", given: null, expected: "Yanlış", mark: "blank" },
    ]);
  });
  it("fill blank resolves bank tokens to words", () => {
    const rows = reviewRows("fill_blank", bank, { type: "fill_blank", v: 1, blanks: { b1: { token: "w2" } } },
      { items: { b1: { answered: true, correct: false }, b2: { answered: false, correct: false } } }, { blanks: { b1: { tokens: ["w1"] }, b2: { tokens: ["w2"] } } }, labels);
    expect(rows.map((r) => [r.prompt, r.given, r.expected, r.mark])).toEqual([["Boşluk 1", "buhar", "katı", "incorrect"], ["Boşluk 2", null, "buhar", "blank"]]);
  });
  it("numeric splits unit only when the server scored it separately", () => {
    const p = { units: [{ id: "cm", text: "cm" }, { id: "m", text: "m" }], unit_required: true };
    const ans = { type: "numeric" as const, v: 1 as const, value: "1,5", unit: "m" };
    const key = { value: "150", unit: "cm" };
    expect(reviewRows("numeric", p, ans, { items: { value: { answered: true, correct: true } } }, key, labels))
      .toEqual([{ id: "value", prompt: "Sayı", given: "1,5 m", expected: "150 cm", mark: "correct" }]);
    expect(reviewRows("numeric", p, ans, { items: { value: { answered: true, correct: true }, unit: { answered: true, correct: true } } }, key, labels).map((r) => r.id))
      .toEqual(["value", "unit"]);
  });
  it("ordering shows positions without client-side per-position scoring", () => {
    const p = { items: [{ id: "a", text: "Tohum" }, { id: "b", text: "Filiz" }], mode: "sequence" as const };
    const rows = reviewRows("ordering", p, { type: "ordering", v: 1, order: ["b", "a"] }, { items: { pairs_correct: 0, pairs_required: 1 } }, { orders: [["a", "b"]] }, labels);
    expect(rows.map((r) => [r.given, r.expected, r.mark])).toEqual([["Filiz", "Tohum", "unknown"], ["Tohum", "Filiz", "unknown"]]);
    expect(orderingSummary({ items: { pairs_correct: 0, pairs_required: 1 } })).toEqual({ correct: 0, required: 1 });
  });
  it("without key or details (never answered) every row is blank", () => {
    const rows = reviewRows("matching", { left: [{ id: "l1", text: "Kalp" }, { id: "l2", text: "Göz" }], right: [{ id: "r1", text: "Pompa" }, { id: "r2", text: "Görme" }], policy: "one_to_one" }, null, null, null, labels);
    expect(rows.every((r) => r.mark === "blank" && r.expected === null)).toBe(true);
  });
});
