import {
  buildUserMessage,
  buildVerdict,
  decide,
  failureVerdict,
  PREREVIEW_CONFIDENCE_THRESHOLD,
  type PrereviewOutput,
  RUBRIC_PASS,
  SCHEMA,
  validateOutput,
} from "./prereview.ts";

function assert(value: unknown, message = "assertion failed"): asserts value {
  if (!value) throw Error(message);
}
function throwsInvalid(value: unknown, message: string) {
  let code = "";
  try {
    validateOutput(value);
  } catch (e) {
    code = e instanceof Error ? e.message : "other";
  }
  assert(code === "ai_result_invalid", `${message}: ${code || "accepted"}`);
}
const clean: PrereviewOutput = {
  confidence: 0.93,
  recommendation: "approve",
  rubric: { ...RUBRIC_PASS },
  findings: [],
  summary: "Çözüm doğru, kazanımla uyumlu, dil 5. sınıfa uygun.",
};

Deno.test("contract: clean output is accepted and normalized", () => {
  const out = validateOutput(structuredClone(clean));
  assert(out.confidence === 0.93 && out.recommendation === "approve" && out.findings.length === 0);
});

Deno.test("contract: schema rejections", () => {
  throwsInvalid(null, "null");
  throwsInvalid("{}", "string");
  throwsInvalid({ ...clean, extra: 1 }, "extra key");
  const { summary: _s, ...missing } = clean;
  throwsInvalid(missing, "missing summary");
  throwsInvalid({ ...clean, confidence: 1.2 }, "confidence above 1");
  throwsInvalid({ ...clean, confidence: -0.1 }, "confidence below 0");
  throwsInvalid({ ...clean, confidence: "0.9" }, "confidence as string");
  throwsInvalid({ ...clean, confidence: Number.NaN }, "confidence NaN");
  throwsInvalid({ ...clean, recommendation: "publish" }, "unknown recommendation");
  throwsInvalid({ ...clean, rubric: { ...clean.rubric, solution_correct: "maybe" } }, "unknown rubric answer");
  throwsInvalid({ ...clean, rubric: { solution_correct: "yes" } }, "incomplete rubric");
  throwsInvalid({ ...clean, rubric: { ...clean.rubric, bonus: "yes" } }, "extra rubric key");
  throwsInvalid({ ...clean, findings: [{ code: "other", severity: "blocking", detail: "x" }] }, "finding without item");
  throwsInvalid({ ...clean, findings: [{ code: "made_up", severity: "blocking", detail: "x", item: null }] }, "unknown finding code");
  throwsInvalid({ ...clean, findings: [{ code: "other", severity: "fatal", detail: "x", item: null }] }, "unknown severity");
  throwsInvalid({ ...clean, findings: [{ code: "other", severity: "advisory", detail: "", item: null }] }, "empty detail");
  throwsInvalid({ ...clean, findings: [{ code: "other", severity: "advisory", detail: "x".repeat(1001), item: null }] }, "detail too long");
  throwsInvalid({ ...clean, summary: "" }, "empty summary");
  throwsInvalid({ ...clean, summary: "x".repeat(601) }, "summary too long");
  throwsInvalid({ ...clean, findings: Array.from({ length: 41 }, () => ({ code: "other", severity: "advisory", detail: "x", item: null })) }, "too many findings");
});

Deno.test("threshold: approve only at >= 0.85 with a fully passing rubric and no blocking finding", () => {
  assert(decide(clean).status === "ai_approved");
  assert(decide({ ...clean, confidence: PREREVIEW_CONFIDENCE_THRESHOLD }).status === "ai_approved", "boundary inclusive");
  const low = decide({ ...clean, confidence: 0.849 });
  assert(low.status === "needs_admin" && low.reason === "low_confidence");
  const unsure = decide({ ...clean, rubric: { ...clean.rubric, measures_target_skill: "unsure" } });
  assert(unsure.status === "needs_admin" && unsure.reason === "rubric_measures_target_skill", "unsure rubric never approves");
  const copy = decide({ ...clean, rubric: { ...clean.rubric, copyright_or_copy_suspicion: "yes" } });
  assert(copy.status === "needs_admin" && copy.reason === "rubric_copyright_or_copy_suspicion");
  const leaked = decide({ ...clean, rubric: { ...clean.rubric, leaked_exam_suspicion: "unsure" } });
  assert(leaked.status === "needs_admin");
  const advisory = decide({ ...clean, findings: [{ code: "other", severity: "advisory", detail: "Küçük yazım notu", item: "q1" }] });
  assert(advisory.status === "ai_approved", "advisory finding does not block");
  const blocking = decide({ ...clean, findings: [{ code: "rubric_incomplete", severity: "blocking", detail: "Kısmi puan ölçütü eksik", item: "q2" }] });
  assert(blocking.status === "needs_admin" && blocking.reason === "blocking_finding", "blocking finding with approve goes to admin");
  const hesitant = decide({ ...clean, recommendation: "admin_review" });
  assert(hesitant.status === "needs_admin" && hesitant.reason === "model_requested_review");
});

Deno.test("threshold: reject suggestion needs a blocking finding and confidence; never an automatic rejection", () => {
  const reject = decide({ ...clean, recommendation: "reject", rubric: { ...clean.rubric, leaked_exam_suspicion: "yes" }, findings: [{ code: "leaked_exam", severity: "blocking", detail: "Okul yazılısı kopyası", item: "q1" }] });
  assert(reject.status === "ai_rejected_suggestion" && reject.reason === "blocking_finding");
  const rejectNoFinding = decide({ ...clean, recommendation: "reject" });
  assert(rejectNoFinding.status === "needs_admin", "reject without evidence is only an admin review");
  const rejectLow = decide({ ...clean, confidence: 0.5, recommendation: "reject", findings: [{ code: "leaked_exam", severity: "blocking", detail: "x", item: null }] });
  assert(rejectLow.status === "needs_admin" && rejectLow.reason === "low_confidence", "low-confidence reject is not a suggestion");
});

Deno.test("verdict carries provenance and the user message never reduces to a URL", () => {
  const verdict = buildVerdict(clean, decide(clean), { model: "synthetic-model", promptVersion: "prereview-v1", inputTokens: 100, outputTokens: 50 });
  assert(verdict.model === "synthetic-model" && verdict.prompt_version === "prereview-v1" && verdict.decision_reason === "all_checks_passed");
  assert(verdict.confidence === 0.93 && Array.isArray(verdict.findings));
  const failure = failureVerdict("ai_disabled", null);
  assert(failure.decision_reason === "ai_disabled" && failure.confidence === 0 && failure.findings.length === 1);
  const message = buildUserMessage({ kind: "curriculum_candidate", candidate: { source_url: "https://cdn.eba.gov.tr/x.xlsx", blocks: [{ outcomes: [{ text: "T.O.5.6. Metnin yüzey anlamını belirleyebilme" }] }] } });
  assert(message.includes("T.O.5.6. Metnin yüzey anlamını belirleyebilme"), "outcome text included");
  assert(message.startsWith("MEB ortak yazılı senaryo adayı"));
  assert(buildUserMessage({ kind: "library_package" }).startsWith("Kütüphane taslak paketi"));
  assert(buildUserMessage({ kind: "contribution_set" }).startsWith("Aile katkı kopyası"));
  const required = (SCHEMA as { required: string[] }).required;
  assert(required.includes("rubric") && required.includes("findings") && required.includes("confidence"));
});
