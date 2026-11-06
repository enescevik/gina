import { describe, expect, it } from "vitest";
import { readQuestionRubric } from "./prova-draft";
import { rubricNeedsScaling, scaleRubricTo100 } from "./rubric-scale";
import { classifyServerError } from "./shared-limits";

describe("D6/B3 rubric scale", () => {
  it("scales AI criteria (total 5–6) to 100 with integer points", () => {
    expect(scaleRubricTo100([{ points: 2 }, { points: 2 }, { points: 1 }]).map((c) => c.points)).toEqual([40, 40, 20]);
    const six = scaleRubricTo100([{ points: 1 }, { points: 2 }, { points: 2 }, { points: 1 }]).map((c) => c.points);
    expect(six.reduce((a, b) => a + b, 0)).toBe(100);
    expect(six).toEqual([17, 33, 33, 17]);
    const thirds = scaleRubricTo100([{ points: 1 }, { points: 1 }, { points: 1 }]).map((c) => c.points);
    expect(thirds).toEqual([34, 33, 33]);
  });
  it("leaves 100-point, empty and zero-total rubrics unchanged", () => {
    const hundred = [{ points: 40 }, { points: 60 }];
    expect(scaleRubricTo100(hundred)).toBe(hundred);
    expect(scaleRubricTo100([])).toEqual([]);
    expect(scaleRubricTo100([{ points: 0 }])).toEqual([{ points: 0 }]);
  });
  it("only AI-generated rubrics are rescaled; parent rubrics keep their own points", () => {
    expect(rubricNeedsScaling({ generator: "ai" })).toBe(true);
    expect(rubricNeedsScaling({ generator: "parent" })).toBe(false);
    expect(rubricNeedsScaling(null)).toBe(false);
    const rubric = { criteria: [{ text: "Kesri yazar", points: 2 }, { text: "Sadeleştirir", points: 3 }], alternative_answers: [] };
    expect(readQuestionRubric({ generator: "ai", rubric }).criteria.map((c) => c.points)).toEqual([40, 60]);
    expect(readQuestionRubric({ generator: "parent", rubric }).criteria.map((c) => c.points)).toEqual([2, 3]);
  });
});

describe("D6/B4 error code", () => {
  it("an oversized PDF is a validation error, not a retryable outage", () => {
    expect(classifyServerError({ code: "source_file_too_large", status: 400 })).toEqual({
      code: "source_file_too_large",
      category: "validation",
      retryable: false,
    });
  });
});
