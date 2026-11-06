import { describe, expect, it } from "vitest";
import {
  aiEditRoot,
  isAiEditable,
  remainingFlaggedNames,
  replaceProvaBlock,
  rubricToInput,
} from "./ai-question-edit";
import { newProvaDraft, parseRubricInput, readQuestionRubric, rubricNeedsScaling } from "./index";
import { readQuestionContentReview } from "./question-content-review";

const review = readQuestionContentReview({
  content_review: {
    status: "needs_review",
    detector: "person-name/v1",
    flags: [{ code: "person_name", names: ["Elif", "Ali", "Şule"], fields: ["stem"], suggestion: "" }],
  },
});

describe("D14 ai question edit", () => {
  it("only AI (or AI-edited) questions are editable", () => {
    expect(isAiEditable({ generator: "ai" })).toBe(true);
    expect(isAiEditable({ generator: "ai_edited" })).toBe(true);
    expect(isAiEditable({ generator: "parent" })).toBe(false);
    expect(isAiEditable(null)).toBe(false);
    expect(isAiEditable([])).toBe(false);
  });

  it("edit root follows the chain", () => {
    expect(aiEditRoot({ id: "a", provenance: { generator: "ai" } })).toBe("a");
    expect(aiEditRoot({ id: "b", provenance: { generator: "ai_edited", edited_root: "a" } })).toBe("a");
  });

  it("replaces a block in place and moves the fit acceptance", () => {
    const d = {
      ...newProvaDraft(),
      blocks: [
        { kind: "question" as const, id: "x", source: "manual" as const },
        { kind: "question" as const, id: "a", source: "ai" as const },
        { kind: "question" as const, id: "y", source: "library" as const },
      ],
      fitAccepted: ["a", "y"],
    };
    const next = replaceProvaBlock(d, "a", { kind: "question", id: "b", source: "document" });
    expect(next.blocks.map((b) => b.id)).toEqual(["x", "b", "y"]);
    expect(next.blocks[1]!.source).toBe("ai");
    expect(next.fitAccepted?.sort()).toEqual(["b", "y"]);
    expect(d.blocks[1]!.id).toBe("a");
  });

  it("appends when the original is not in the draft, never duplicates", () => {
    const d = { ...newProvaDraft(), blocks: [{ kind: "question" as const, id: "b", source: "ai" as const }] };
    expect(replaceProvaBlock(d, "a", { kind: "question", id: "c", source: "ai" }).blocks.map((b) => b.id)).toEqual(["b", "c"]);
    expect(replaceProvaBlock(d, "a", { kind: "question", id: "b", source: "ai" }).blocks.map((b) => b.id)).toEqual(["b"]);
    const both = { ...d, blocks: [{ kind: "question" as const, id: "a", source: "ai" as const }, ...d.blocks] };
    expect(replaceProvaBlock(both, "a", { kind: "question", id: "b", source: "ai" }).blocks.map((b) => b.id)).toEqual(["b"]);
    expect(replaceProvaBlock(d, "a", { kind: "question", id: "c", source: "ai" }).fitAccepted).toBeUndefined();
  });

  it("group members' acceptance moves member by member", () => {
    const d = {
      ...newProvaDraft(),
      blocks: [{ kind: "group" as const, id: "g1", source: "ai" as const }],
      fitAccepted: ["m1"],
    };
    const next = replaceProvaBlock(d, "g1", { kind: "group", id: "g2", source: "ai" }, { from: ["m1", "m2"], to: ["n1", "n2"] });
    expect(next.blocks).toEqual([{ kind: "group", id: "g2", source: "ai" }]);
    expect(next.fitAccepted).toEqual(["n1"]);
  });

  it("rubric round-trips through the editor text (scaled AI rubric → 100 scale)", () => {
    const provenance = { generator: "ai", rubric: { criteria: [{ text: "Doğru kişi", points: 2 }, { text: "Gerekçe", points: 3 }], alternative_answers: ["Ali"] } };
    const input = rubricToInput(readQuestionRubric(provenance));
    expect(input).toEqual({ alternatives: "Ali", criteria: "Doğru kişi | 40\nGerekçe | 60" });
    expect(parseRubricInput(input.alternatives, input.criteria)).toEqual({
      criteria: [{ text: "Doğru kişi", points: 40 }, { text: "Gerekçe", points: 60 }],
      alternative_answers: ["Ali"],
    });
    // Düzenlenmiş satır veli ölçeğindedir; yeniden ölçeklenmez.
    expect(rubricNeedsScaling({ generator: "ai_edited" })).toBe(false);
  });

  it("live name hint mirrors the server rule", () => {
    expect(remainingFlaggedNames(review, ["Bir öğrenci ile Ali yürüyor."])).toEqual(["Ali"]);
    expect(remainingFlaggedNames(review, ["Şule'nin kalemi"])).toEqual(["Şule"]);
    expect(remainingFlaggedNames(review, ["Elifçe bir kelime değil", "ali küçük harfle"])).toEqual([]);
    expect(remainingFlaggedNames(review, ["Soru", "Elif gelir"])).toEqual(["Elif"]);
    expect(remainingFlaggedNames(null, ["Elif"])).toEqual([]);
  });
});
