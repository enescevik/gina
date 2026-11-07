import { fail, sanitizedCode } from "../_shared/error-contract.ts";
import { needsNotebookReview } from "../_shared/answer-notebook.ts";
import { questionImages } from "../_shared/question-images.ts";
import { runAiOperation } from "../_shared/ai-operation.ts";
import {
  buildGradePayload,
  GRADE_SYSTEM,
  gradeSchema,
  type SharedSourceMember,
  validateGradeReport,
} from "../_shared/grade-report.ts";
// Prova açık uçlu cevap değerlendirmesi (AI). Veli deneme inceleme ekranından çağırır; çocuk asla çağırmaz.
// Deploy: `supabase functions deploy prova-grade` (verify_jwt açık kalır).
// Kurallar: yalnız parent; paket prova_ai_grading (Pro) sunucuda; model ai_settings'ten;
// ANTHROPIC_API_KEY yoksa 503 ai_not_configured. Metindeki bilinen çocuk adı maskelenir.
// Görseller yalnız açık, bu değerlendirmeye ait veli onayıyla gönderilir; görseldeki PII otomatik maskelenmez.
// C08: AI puanı yalnız öneridir (ai_score); kesin puanı veli onaylar (accept_ai_grade / score_open_answer).

import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import { apiKeyOrResponse, logUsage, parentOrResponse, provaEntitlement, resolveAi } from "../_shared/prova.ts";

// D6/B1: v4 — istek başına enum şeması (ref/konu/kanıt) ve doğrulayıcıyla hizalı istem kuralları.
// D9: v5 — grup sorularının ortak metni/tablosu yükte bir kez (`ortak_kaynaklar`), maddeler ref ile bağlı.
// D13: v7 — amaç duyarlı puanlama: maddede `degerlendirme_amaci` (sonuc | surec | sorudan_cikar). Yalnız sonucu
// ölçen soruda eşdeğer/alternatif cevap tam puan; süreç/gerekçe ölçen soruda rubrik ölçütleri yazıldığı gibi.
const PROMPT_VERSION = "prova-grade/v8-untrusted-data-boundary";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const parent = await parentOrResponse(req);
  if (parent instanceof Response) return parent;

  let attemptId: string;
  let imageConsent = false;
  try {
    const body = await req.json();
    attemptId = body.attempt_id;
    imageConsent = body.image_consent === true;
    if (typeof attemptId !== "string" || !/^[0-9a-f-]{36}$/i.test(attemptId)) throw new Error("bad");
  } catch {
    return fail("attempt_id_required", 400);
  }

  const db = serviceClient();
  let ent;
  try {
    ent = await provaEntitlement(db, parent.familyId);
  } catch {
    return fail("entitlement_failed", 500);
  }
  if (!ent.ai_grading) return fail("plan_has_no_ai_grading", 402, { details: { plan: ent.plan }, legacy: { plan: ent.plan } });

  // Deneme bu veliye ait mi ve bitmiş mi?
  const { data: attempt } = await db
    .from("exam_attempts")
    .select("id, status, exam_id, child_id")
    .eq("id", attemptId)
    .eq("family_id", parent.familyId)
    .maybeSingle();
  if (!attempt) return fail("attempt_not_found", 404);
  if (attempt.status === "in_progress") return fail("attempt_not_finished", 409);

  const { data: exam } = await db.from("exams").select("question_ids").eq("id", attempt.exam_id).single();
  const questionIds: string[] = exam?.question_ids ?? [];
  const [questionResult, answerResult, childResult] = await Promise.all([
    db.from("question_bank").select("id, topic, kind, stem, choices, correct_key, expected_answer, solution, provenance").in("id", questionIds).or(`family_id.eq.${parent.familyId},family_id.is.null`),
    db.from("exam_answers").select("question_id, answer_key, answer_text, answer_document, is_correct, score, graded_by").eq("attempt_id", attemptId),
    db.from("children").select("name,archived_at").eq("id", attempt.child_id).maybeSingle(),
  ]);

  if (questionResult.error || answerResult.error || childResult.error) return fail("data_failed", 500);
  if (childResult.data?.archived_at) return fail("child_archived", 409);
  const questions = questionResult.data; const answers = answerResult.data; const child = childResult.data;
  // Never grade a typed fragment as the whole answer while ignoring the student's ink.
  // Notebook image evaluation is a separate consented pipeline, not implemented here.
  const hasNotebook = needsNotebookReview(answerResult.data ?? []);
  if (hasNotebook) return fail("notebook_review_required", 409);
  if (!questions?.length || questions.length !== questionIds.length) return fail("data_failed", 500);
  // Mask the known child name. Free text may still contain other personal details.
  const nameParts = (child?.name ?? "").split(/\s+/).filter((p: string) => p.length >= 2);
  const mask = (text: string) =>
    nameParts.reduce((t: string, p: string) => t.replace(new RegExp(`(?<!\\p{L})${escapeRegExp(p)}(?!\\p{L})`, "giu"), "[ad]"), text);

  const ai = await resolveAi(db, ent.plan, 4000, "open_ended_grading");
  if (ai instanceof Response) return ai;
  const apiKey = apiKeyOrResponse(ai);
  if (apiKey instanceof Response) return apiKey;

  // D9: grup soruları — ortak metin/tablo yükte bir kez, bağlı maddeler `ortak_kaynak` ref'iyle.
  const { data: members, error: membersError } = await db
    .from("question_source_members")
    .select("question_id, prompt, source_group:question_source_groups(id, title, body)")
    .in("question_id", questionIds);
  if (membersError) return fail("data_failed", 500);
  const { payload, refs, refToQuestion } = buildGradePayload(
    questionIds,
    questions,
    answers ?? [],
    (members ?? []) as unknown as SharedSourceMember[],
    mask,
  );
  let images;
  try { images = await questionImages(db,parent.familyId,parent.userId,attemptId,questionIds,imageConsent); }
  catch (e) { return fail(sanitizedCode(e instanceof Error ? e.message : "", /^(data_failed|source_ai_consent_required|source_ai_limit)$/, "data_failed"), 400); }
  const result = await runAiOperation(db, parent, "grade", attemptId, apiKey, ai,
    GRADE_SYSTEM, images.length ? [{type:"text",text:JSON.stringify(payload)},...images] : JSON.stringify(payload), gradeSchema(refs), value => validateGradeReport(value, refs), attempt.child_id);
  if (result instanceof Response) return result;

  const grades = (result.output.degerlendirmeler ?? [])
    .filter((g) => refToQuestion.has(g.ref) && g.puan !== null)
    .map((g) => ({
      question_id: refToQuestion.get(g.ref),
      score: Math.max(0, Math.min(100, Math.round(Number(g.puan) || 0))),
      kisa_geri_bildirim: g.kisa_geri_bildirim,
      eksikler: g.eksikler ?? [],
      iyilestirme_onerileri: g.iyilestirme_onerileri ?? [],
    }));
  const summary = {
    ...result.output.ozet,
    model: result.model ?? ai.model,
    prompt_version: PROMPT_VERSION,
    graded_at: new Date().toISOString(),
    evidence: Object.fromEntries(refToQuestion),
    unscored: result.output.degerlendirmeler.filter(g=>g.puan===null).map(g=>({ref:g.ref,reason:g.kisa_geri_bildirim})),
  };

  const { data: row, error: applyError } = await db.rpc("apply_ai_grades", {
    p_attempt_id: attemptId,
    p_grades: grades,
    p_summary: summary,
  });
  if (applyError) {
    console.error("prova-grade apply", applyError.message);
    return fail("save_failed", 500);
  }

  await logUsage(db, {
    family_id: parent.familyId,
    action: "grade",
    model: result.model ?? ai.model,
    items: grades.length,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    requested_by: parent.userId,
    operation_id: result.jobId,
  });

  // graded: eski alan (öneri sayısı). suggested/final: C08 — AI puanı kesin değildir.
  return json({ ok: true, graded: grades.length, suggested: grades.length, final: false, attempt: row, summary });
});
