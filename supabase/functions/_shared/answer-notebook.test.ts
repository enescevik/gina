import { needsNotebookReview } from "./answer-notebook.ts";
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
