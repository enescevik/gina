import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import {
  type AiUserContent,
  apiKeyOrResponse,
  provaEntitlement,
  readParent,
  resolveAi,
  sha256,
} from "../_shared/prova.ts";
import { runAiOperation } from "../_shared/ai-operation.ts";
import { questionImages } from "../_shared/question-images.ts";
import {
  REVIEW_SCHEMA,
  REVIEW_SYSTEM,
  validateReviewReport,
} from "../_shared/review-report.ts";
import { renderReviewNotebook } from "../_shared/review-renderer.ts";

const dependencies = {
  serviceClient,
  readParent,
  provaEntitlement,
  resolveAi,
  apiKeyOrResponse,
  questionImages,
  renderReviewNotebook,
  runAiOperation,
};
export function createReviewHandler(
  overrides: Partial<typeof dependencies> = {},
) {
  const deps = { ...dependencies, ...overrides };
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight();
    if (req.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }
    try {
      const db = deps.serviceClient();
      const parent = await deps.readParent(req, db);
      if (!parent) return json({ error: "forbidden" }, 403);
      const raw = await req.text();
      if (raw.length > 4096) return json({ error: "invalid_input" }, 400);
      const body = JSON.parse(raw);
      const uuid =
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
      if (
        !uuid.test(body.attempt_id) || !uuid.test(body.question_id) ||
        !/^[a-f0-9]{64}$/.test(body.answer_hash) || body.consent !== true
      ) return json({ error: "source_ai_consent_required" }, 400);
      const { data: gate, error: gateError } = await db.from("app_settings")
        .select("value").eq("key", "review_ai.enabled").maybeSingle();
      if (gateError || gate?.value !== true) {
        return json({ error: "ai_disabled" }, 503);
      }
      const { data: attempt, error: attemptError } = await db.from(
        "exam_attempts",
      ).select("id,status,exam_id,child_id").eq("id", body.attempt_id).eq(
        "family_id",
        parent.familyId,
      ).maybeSingle();
      if (attemptError || !attempt) {
        return json({ error: "attempt_not_found" }, 404);
      }
      if (attempt.status === "in_progress") {
        return json({ error: "attempt_not_finished" }, 409);
      }
      const { data: exam, error: examError } = await db.from("exams").select(
        "question_ids,grade,subject",
      ).eq("id", attempt.exam_id).eq("family_id", parent.familyId).single();
      if (examError || !exam.question_ids.includes(body.question_id)) {
        return json({ error: "question_not_found" }, 404);
      }
      const [question, answer, fingerprint] = await Promise.all([
        db.from("question_bank").select("stem,expected_answer,solution,kind")
          .eq("id", body.question_id).single(),
        db.from("exam_answers").select("answer_text,answer_document").eq(
          "attempt_id",
          attempt.id,
        ).eq("question_id", body.question_id).single(),
        db.rpc("review_answer_fingerprint", {
          p_attempt_id: attempt.id,
          p_question_id: body.question_id,
        }),
      ]);
      if (
        question.error || answer.error || fingerprint.error ||
        question.data?.kind !== "open_ended"
      ) return json({ error: "data_failed" }, 400);
      if (fingerprint.data !== body.answer_hash) {
        return json({ error: "answer_changed" }, 409);
      }
      const ent = await deps.provaEntitlement(db, parent.familyId);
      if (!ent.ai_grading) {
        return json({ error: "plan_has_no_ai_grading" }, 402);
      }
      const { data: cached, error: cacheError } = await db.from(
        "answer_review_suggestions",
      ).select("id,result").eq("attempt_id", attempt.id).eq(
        "question_id",
        body.question_id,
      ).eq("answer_hash", body.answer_hash).eq("actor_id", parent.userId)
        .maybeSingle();
      if (cacheError) return json({ error: "data_failed" }, 500);
      if (cached) {
        return json({
          id: cached.id,
          result: validateReviewReport(cached.result),
        });
      }
      const config = await deps.resolveAi(db, ent.plan, 2500);
      if (config instanceof Response) return config;
      const key = deps.apiKeyOrResponse();
      if (key instanceof Response) return key;
      // Persist consent before any child answer is sent, including failed provider calls.
      const consentRecord = await db.from("answer_review_consents").upsert({
        family_id: parent.familyId,
        actor_id: parent.userId,
        attempt_id: attempt.id,
        question_id: body.question_id,
        answer_hash: body.answer_hash,
        version: "review-ai-v1",
      }, {
        onConflict: "attempt_id,question_id,answer_hash,actor_id",
        ignoreDuplicates: true,
      });
      if (consentRecord.error) return json({ error: "data_failed" }, 500);
      const images = await deps.questionImages(
        db,
        parent.familyId,
        parent.userId,
        attempt.id,
        [body.question_id],
        true,
      );
      // Renders only stored child content. No client image, URL, or parent layer accepted.
      const png = answer.data.answer_document
        ? await deps.renderReviewNotebook(
          db,
          parent.familyId,
          body.question_id,
          answer.data.answer_document,
        )
        : null;
      const user: Exclude<AiUserContent, string> = [{
        type: "text",
        text: JSON.stringify({
          sinif: exam.grade,
          ders: exam.subject,
          soru: question.data.stem,
          beklenen: question.data.expected_answer,
          cozum: question.data.solution,
          ogrenci_metni: answer.data.answer_text,
        }),
      }, ...images];
      let imageHash: string | null = null;
      if (png) {
        let binary = "";
        for (let i = 0; i < png.length; i += 8192) {
          binary += String.fromCharCode(...png.subarray(i, i + 8192));
        }
        const base64 = btoa(binary);
        imageHash = await sha256(base64);
        user.push({
          type: "text",
          text: "Öğrencinin özgün çözüm defteri (veli notları dahil değil):",
        }, {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: base64 },
        });
      }
      const output = await deps.runAiOperation(
        db,
        parent,
        "grade",
        `review:${attempt.id}:${body.question_id}:${body.answer_hash}`,
        key,
        { ...config, promptVersion: `${config.promptVersion}:review-v1` },
        REVIEW_SYSTEM,
        user,
        REVIEW_SCHEMA,
        validateReviewReport,
        attempt.child_id,
      );
      if (output instanceof Response) return output;
      const current = await db.rpc("review_answer_fingerprint", {
        p_attempt_id: attempt.id,
        p_question_id: body.question_id,
      });
      if (current.error || current.data !== body.answer_hash) {
        return json({ error: "answer_changed" }, 409);
      }
      const { data: saved, error } = await db.from("answer_review_suggestions")
        .upsert({
          family_id: parent.familyId,
          actor_id: parent.userId,
          attempt_id: attempt.id,
          question_id: body.question_id,
          answer_hash: body.answer_hash,
          image_hash: imageHash,
          consent_version: "review-ai-v1",
          job_id: output.jobId,
          result: output.output,
        }, {
          onConflict: "attempt_id,question_id,answer_hash,actor_id",
          ignoreDuplicates: true,
        }).select("id,result").maybeSingle();
      if (error) return json({ error: "data_failed" }, 500);
      if (saved) return json(saved);
      const existing = await db.from("answer_review_suggestions").select(
        "id,result",
      ).eq("attempt_id", attempt.id).eq("question_id", body.question_id).eq(
        "answer_hash",
        body.answer_hash,
      ).eq("actor_id", parent.userId).single();
      return existing.error
        ? json({ error: "data_failed" }, 500)
        : json(existing.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "data_failed";
      return json({
        error: [
            "notebook_render_failed",
            "source_ai_limit",
            "source_not_ready",
            "invalid_notebook",
            "data_failed",
            "ai_result_invalid",
          ].includes(message)
          ? message
          : "data_failed",
      }, 400);
    }
  };
}
if (import.meta.main) Deno.serve(createReviewHandler());
