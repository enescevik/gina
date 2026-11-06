import { describe, expect, it } from "vitest";
import { answerErrors, answerState } from "@gina/core";
import { canRender, questionFillState, readStimulus, readStructuredAnswer, withoutStimulus } from "./model";
import { boxStyle, handAngles, minuteStep, phase2bReviewRows, regionCountSummary, sectorPath, stepClock } from "./phase2b-model";
import { CHILD_SUPPORTED_TYPES, CLIENT_SUPPORTED_WITH_PHASE2B, PHASE2B_CHILD_ENABLED } from "./support";

const labels = { selected: "seçti", notSelected: "seçmedi", shouldSelect: "seçilmeli", shouldNotSelect: "seçilmemeli", marked: () => "", notMarked: "", notAnError: "", stage1: "", stage2: "", time: "Saat" };
const table = { kind: "table" as const, alt: "Sınıftaki öğrenci sayıları tablosu", columns: ["Sınıf", "Kız", "Erkek"], rows: [["3A", 12, 10], ["3B", 11, 13]] };

describe("clock steppers", () => {
  it("starts from 12:00, respects the step and wraps around the day", () => {
    expect(stepClock(undefined, { minutes: 5 }, 5)).toBe("12:05");
    expect(stepClock("23:45", { minutes: 15 }, 15)).toBe("00:00");
    expect(stepClock("00:00", { hours: -1 }, 30)).toBe("23:00");
    expect(stepClock("10:07", { minutes: 5 }, 5)).toBe("10:10"); // snaps a stray value onto the step
    expect(stepClock("09:00", { hours: 1 }, 60)).toBe("10:00");
    expect(minuteStep(60)).toBe(0);
    expect(minuteStep(15)).toBe(15);
  });
  it("every stepped time is a valid answer for that step", () => {
    const p = { mode: "set", display: "analog", step_minutes: 15 };
    let t: string | undefined;
    for (let i = 0; i < 200; i++) {
      t = stepClock(t, i % 3 ? { minutes: 15 } : { hours: -1 }, 15);
      expect(answerErrors("clock", p, { type: "clock", v: 1, time: t })).toEqual([]);
    }
  });
  it("computes analog hand angles", () => {
    expect(handAngles("03:30")).toEqual({ hour: 105, minute: 180 });
    expect(handAngles("12:00")).toEqual({ hour: 0, minute: 0 });
    expect(handAngles("3:30")).toBeNull();
  });
});

describe("region geometry", () => {
  it("keeps image boxes in percentages so they follow scaling and rotation", () => {
    expect(boxStyle([0.1, 0.25, 0.5, 0.3])).toEqual({ left: "10%", top: "25%", width: "50%", height: "30%" });
  });
  it("draws sectors that start at 12 o'clock", () => {
    expect(sectorPath(0, 4)).toBe("M 50 50 L 50.000 2.000 A 48 48 0 0 1 98.000 50.000 Z");
  });
});

describe("stimulus on any structured type", () => {
  const tf = { statements: [{ id: "s1", text: "3A'da 12 kız var." }], stimulus: table };
  it("1A payload with a valid stimulus still renders; a broken stimulus does not", () => {
    expect(withoutStimulus(tf)).toEqual({ statements: tf.statements });
    expect(canRender("true_false", 1, tf)).toBe(true);
    expect(readStimulus(tf)).toEqual(table);
    expect(canRender("true_false", 1, { ...tf, stimulus: { kind: "table", alt: "x" } })).toBe(false);
    expect(questionFillState({ kind: "structured", interaction_type: "true_false", payload: tf }, { answer: { type: "true_false", v: 1, items: { s1: true } } })).toBe("complete");
  });
});

describe("2B reading, state and switch", () => {
  it("reads 2B answers and uses the shared answerState", () => {
    expect(readStructuredAnswer("clock", { type: "clock", v: 1, time: "07:15" })).toEqual({ type: "clock", v: 1, time: "07:15" });
    expect(() => readStructuredAnswer("clock", { type: "clock", v: 1, time: "7:15" })).toThrow("client_update_required");
    expect(answerState("region_select", {}, { type: "region_select", v: 1, selected: [] })).toBe("unanswered");
    expect(canRender("region_select", 1, { figure: { kind: "grid", rows: 1, cols: 2 }, regions: [{ id: "a", text: "1" }, { id: "b", text: "2" }] })).toBe(true);
  });
  it("2B stays out of the reported list until its own switch is flipped", () => {
    expect(PHASE2B_CHILD_ENABLED).toBe(false);
    expect(CHILD_SUPPORTED_TYPES).not.toContain("clock");
    expect(CLIENT_SUPPORTED_WITH_PHASE2B).toEqual(expect.arrayContaining(["region_select", "clock", "true_false"]));
  });
});

describe("parent rows", () => {
  const p = { figure: { kind: "sectors" }, regions: [{ id: "a", text: "1. dilim" }, { id: "b", text: "2. dilim" }, { id: "c", text: "3. dilim" }] };
  it("targets key: per-region marks; count key: selection only plus server count", () => {
    const ans = { type: "region_select", v: 1, selected: ["a", "b"] };
    expect(phase2bReviewRows("region_select", p, ans, null, { targets: ["a"] }, labels).map((r) => r.mark)).toEqual(["correct", "incorrect"]);
    expect(phase2bReviewRows("region_select", p, ans, null, { count: 2 }, labels).map((r) => [r.given, r.expected])).toEqual([["seçti", null], ["seçti", null]]);
    expect(regionCountSummary({ items: { selected: 2, required: 2 } })).toEqual({ selected: 2, required: 2 });
  });
  it("clock row uses the server mark", () => {
    expect(phase2bReviewRows("clock", {}, { type: "clock", v: 1, time: "03:30" }, { items: { time: { correct: false } } }, { time: "15:30" }, labels))
      .toEqual([{ id: "time", prompt: "Saat", given: "03:30", expected: "15:30", mark: "incorrect" }]);
    expect(phase2bReviewRows("clock", {}, null, null, null, labels)[0]!.mark).toBe("blank");
  });
});
