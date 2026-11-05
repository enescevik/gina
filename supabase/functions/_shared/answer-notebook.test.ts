import { aiGradableOpenAnswer, needsNotebookReview } from "./answer-notebook.ts";
function check(actual: boolean, expected: boolean) {
  if (actual !== expected) throw new Error("unexpected review eligibility");
}
Deno.test("a mixed typed/drawn answer cannot be silently scored from text alone", () => {
  check(
    needsNotebookReview([{
      answer_document: { version: 1, elements: [{ type: "stroke" }] },
    }]),
    true,
  );
  check(
    needsNotebookReview([{
      answer_document: { version: 1, elements: [{ type: "source" }] },
    }]),
    true,
  );
});
Deno.test("old text-only answers and empty notebooks retain AI grading", () => {
  check(needsNotebookReview([{}]), false);
  check(
    needsNotebookReview([{ answer_document: { version: 1, elements: [] } }]),
    false,
  );
});
Deno.test("parent-reviewed notebooks may inform a summary without overwriting the parent score", () => {
  check(
    needsNotebookReview([{
      graded_by: "parent",
      answer_document: { version: 1, elements: [{ type: "stroke" }] },
    }]),
    false,
  );
});
Deno.test("unknown notebook formats fail closed", () => {
  check(needsNotebookReview([{ answer_document: { version: 2 } }]), true);
});

Deno.test("P04: blank and drawn open answers are never AI-gradable; typed unreviewed text is", () => {
  const ink = { version: 1, width: 1000, height: 1400, elements: [{ id: "a", type: "stroke" }] };
  if (aiGradableOpenAnswer("open_ended", undefined)) throw Error("missing answer row graded");
  if (aiGradableOpenAnswer("open_ended", { answer_text: "   " })) throw Error("blank graded");
  if (aiGradableOpenAnswer("open_ended", { answer_text: "", answer_document: ink })) throw Error("drawing graded from empty text");
  if (aiGradableOpenAnswer("open_ended", { answer_text: "3/4", graded_by: "parent" })) throw Error("parent score overridden");
  if (aiGradableOpenAnswer("multiple_choice", { answer_text: "A" })) throw Error("mc graded");
  if (!aiGradableOpenAnswer("open_ended", { answer_text: "Kendi ışığını üretir." })) throw Error("typed answer not gradable");
  if (!aiGradableOpenAnswer("open_ended", { answer_text: "cevap", answer_document: { ...ink, elements: [] } })) throw Error("empty notebook blocks text grading");
});
