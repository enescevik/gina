import { REVIEW_SCHEMA, validateReviewReport } from "./review-report.ts";
const valid = {
  readable: true,
  score: 80,
  feedback: "Yöntem doğru; toplamı kontrol et.",
  evidence: ["6 + 8 + 10 satırı"],
  next_step: "Üç uzunluğu yeniden topla.",
  limitation: "",
};
function rejects(value: unknown) {
  try {
    validateReviewReport(value);
  } catch {
    return;
  }
  throw new Error("accepted invalid report");
}
Deno.test("review: bounded grounded suggestion and unreadable alternative", () => {
  if (validateReviewReport(valid).score !== 80) {
    throw new Error("score changed");
  }
  validateReviewReport({
    ...valid,
    readable: false,
    score: null,
    limitation: "Son satır okunamıyor.",
  });
});
Deno.test("review: unreadable is never zero or guessed score", () => {
  rejects({ ...valid, readable: false, score: 0 });
  rejects({ ...valid, readable: false, score: null });
  rejects({ ...valid, score: 100.5 });
  rejects({ ...valid, score: -1 });
  rejects({ ...valid, score: null });
});
Deno.test("review: rejects injected fields and unbounded advice", () => {
  rejects({ ...valid, update_score: true });
  rejects({ ...valid, feedback: "x".repeat(2001) });
  rejects({ ...valid, evidence: [42] });
  rejects({ ...valid, readable: "true" });
});

Deno.test("review: provider schema uses supported grammar; bounds stay in validator", () => {
  const serialized = JSON.stringify(REVIEW_SCHEMA);
  if (/"(minimum|maximum|minLength|maxLength|maxItems)":/.test(serialized)) throw new Error("unsupported provider constraint");
});
