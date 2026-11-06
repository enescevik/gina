import { describe, expect, it } from "vitest";
import { answerState, answerErrors, type Phase2aAnswerOf } from "@gina/core";
import { canRender, clientAnswerSchema, questionFillState, readStructuredAnswer } from "./model";
import { markTextMax, multiChoiceMax, phase2aReviewRows, phase2aSummary, setFix, setStage, toggleMark, toggleSelected } from "./phase2a-model";
import { CHILD_SUPPORTED_TYPES, CLIENT_SUPPORTED_WITH_PHASE2A, PHASE2A_CHILD_ENABLED } from "./support";

const l = { selected: "seçti", notSelected: "seçmedi", shouldSelect: "seçilmeli", shouldNotSelect: "seçilmemeli", marked: (f: string | null) => (f ? `→ ${f}` : "boş"), notMarked: "işaretlemedi", notAnError: "hata değil", stage1: "1", stage2: "2" };
const passage = { unit: "word" as const, segments: [{ id: "w1", text: "Ali" }, { text: " " }, { id: "w2", text: "okula" }, { text: " " }, { id: "w3", text: "gitdi" }, { text: " 🎒." }] };

describe("selection rules", () => {
  it("toggles, refuses beyond the limit and never selects all at once", () => {
    expect(toggleSelected([], "a", 2)).toEqual({ next: ["a"], refused: false });
    expect(toggleSelected(["a", "b"], "c", 2)).toEqual({ next: ["a", "b"], refused: true });
    expect(toggleSelected(["a", "b"], "a", 2)).toEqual({ next: ["b"], refused: false });
    expect(markTextMax({ ...passage, max_select: 1 })).toBe(1);
    expect(markTextMax(passage)).toBe(3);
    expect(multiChoiceMax({ options: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }], select_count: 2 })).toBe(2);
  });
});

describe("error fix editing matches answerState", () => {
  it("mark → partial, fix → complete, empty fix → partial, unmark → unanswered", () => {
    let a: Phase2aAnswerOf<"error_fix"> = { type: "error_fix", v: 1, marks: {} };
    a = toggleMark(a, "w3");
    expect(answerState("error_fix", passage, a)).toBe("partial");
    a = setFix(a, "w3", "gitti");
    expect(a.marks).toEqual({ w3: { text: "gitti" } });
    expect(answerState("error_fix", passage, a)).toBe("complete");
    expect(answerErrors("error_fix", passage, a)).toEqual([]);
    a = setFix(a, "w3", "");
    expect(a.marks).toEqual({ w3: {} });
    expect(answerState("error_fix", passage, a)).toBe("partial");
    expect(setFix(a, "w1", "x")).toBe(a); // unmarked word cannot get a fix
    a = toggleMark(a, "w3");
    expect(answerState("error_fix", passage, a)).toBe("unanswered");
  });
});

describe("two stage editing", () => {
  const p = { stage1: { prompt: "Hangisi?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }] }, stage2: { prompt: "Neden?", mode: "text" as const } };
  it("keeps stages independent and drops an empty reason", () => {
    let a: Phase2aAnswerOf<"two_stage"> = { type: "two_stage", v: 1 };
    a = setStage(a, { stage1: "a" });
    expect(answerState("two_stage", p, a)).toBe("partial");
    a = setStage(a, { stage2: { text: "Çünkü" } });
    expect(answerState("two_stage", p, a)).toBe("complete");
    expect(answerErrors("two_stage", p, a)).toEqual([]);
    a = setStage(a, { stage2: { text: "" } });
    expect(a).toEqual({ type: "two_stage", v: 1, stage1: "a" });
    expect(setStage(a, { stage1: null })).toEqual({ type: "two_stage", v: 1 });
  });
});

describe("client support switch and reading", () => {
  it("2A stays out of the reported list until the switch is flipped", () => {
    expect(PHASE2A_CHILD_ENABLED).toBe(false);
    expect(CHILD_SUPPORTED_TYPES).not.toContain("mark_text");
    expect(CLIENT_SUPPORTED_WITH_PHASE2A).toEqual(expect.arrayContaining(["true_false", "mark_text", "error_fix", "multi_choice", "two_stage"]));
  });
  it("renders and reads 2A answers; fill state uses the shared answerState", () => {
    expect(canRender("mark_text", 1, passage)).toBe(true);
    expect(canRender("mark_text", 1, { unit: "word", segments: [{ id: "x", text: "a" }], extra: 1 })).toBe(false);
    expect(readStructuredAnswer("multi_choice", { type: "multi_choice", v: 1, selected: ["a"] })).toEqual({ type: "multi_choice", v: 1, selected: ["a"] });
    expect(() => readStructuredAnswer("multi_choice", { type: "multi_choice", v: 1, selected: "a" })).toThrow("client_update_required");
    expect(clientAnswerSchema.safeParse({ type: "true_false", v: 1, items: {} }).success).toBe(true);
    const q = { kind: "structured", interaction_type: "multi_choice", payload: { options: [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }] } };
    expect(questionFillState(q, { answer: { type: "multi_choice", v: 1, selected: [] } })).toBe("unanswered");
    expect(questionFillState(q, { answer: { type: "multi_choice", v: 1, selected: ["b"] } })).toBe("complete");
  });
});

describe("parent review rows", () => {
  it("mark_text lists selected and target segments with server summary", () => {
    const rows = phase2aReviewRows("mark_text", passage, { type: "mark_text", v: 1, selected: ["w1", "w2"] },
      { outcome: "scored", items: { true_positive: 1, false_positive: 1, targets: 1, distractors: 2 } }, { targets: ["w2"] }, l);
    expect(rows.map((r) => [r.prompt, r.given, r.expected, r.mark])).toEqual([["Ali", "seçti", "seçilmemeli", "incorrect"], ["okula", "seçti", "seçilmeli", "correct"]]);
    expect(phase2aSummary("mark_text", { items: { true_positive: 1, false_positive: 1, targets: 1 } })).toEqual({ key: "selection", values: { tp: 1, fp: 1, targets: 1 } });
  });
  it("multi_choice lists every option; untouched distractors carry no badge", () => {
    const p = { options: [{ id: "a", text: "Kedi" }, { id: "b", text: "Gül" }, { id: "c", text: "Köpek" }] };
    const rows = phase2aReviewRows("multi_choice", p, { type: "multi_choice", v: 1, selected: ["a"] }, null, { correct: ["a", "c"] }, l);
    expect(rows.map((r) => r.mark)).toEqual(["correct", "unknown", "blank"]);
  });
  it("error_fix separates fixed, wrong mark, missed and fixes for the parent to judge", () => {
    const key = { errors: { w3: { accepted: ["gitti"] }, w1: { accepted: ["Ayşe"] } } };
    const ans = { type: "error_fix", v: 1, marks: { w3: { text: "giti" }, w2: {} } };
    const details = { outcome: "pending_human" as const, items: { w3: { error: true, fixed: false }, w2: { error: false }, found: 1, fixed: 0, unmatched_fixes: 1, false_marks: 1, errors: 2, auto_result_score: 25 } };
    const rows = phase2aReviewRows("error_fix", passage, ans, details, key, l);
    expect(rows.map((r) => [r.id, r.given, r.expected, r.mark])).toEqual([
      ["w1", "işaretlemedi", "Ayşe", "blank"],
      ["w2", "boş", "hata değil", "incorrect"],
      ["w3", "→ giti", "gitti", "review"],
    ]);
    expect(phase2aSummary("error_fix", details)!.values).toEqual({ found: 1, fixed: 0, errors: 2, falseMarks: 1, unmatched: 1 });
  });
  it("two_stage marks stage 2 text for parent review; choice stage uses server marks", () => {
    const p = { stage1: { prompt: "Hangisi?", options: [{ id: "a", text: "Buz" }, { id: "b", text: "Su" }] }, stage2: { prompt: "Neden?", mode: "text" } };
    const rows = phase2aReviewRows("two_stage", p, { type: "two_stage", v: 1, stage1: "a", stage2: { text: "Soğuk" } },
      { outcome: "pending_human", items: { stage1: { answered: true, correct: true }, stage2: { answered: true, correct: null }, auto_result_score: 50 } }, { stage1: "a" }, l);
    expect(rows.map((r) => [r.given, r.expected, r.mark])).toEqual([["Buz", "Buz", "correct"], ["Soğuk", null, "review"]]);
  });
});
