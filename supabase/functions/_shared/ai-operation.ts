import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  type AiConfig,
  type AiResult,
  type AiUserContent,
  callClaude,
  sha256,
} from "./prova.ts";
import { json } from "./supabase.ts";

/** Cache paid generation before applying it. Identical input shares a job; uncertain
 * provider responses never get automatic retries. Leases fence late completions. */
export async function runAiOperation<T>(
  db: SupabaseClient,
  parent: { familyId: string; userId: string },
  action: "grade" | "plan" | "import" | "weekly" | "learning_import",
  scope: string,
  apiKey: string,
  config: AiConfig,
  system: string,
  user: AiUserContent,
  schema: Record<string, unknown>,
  validate: (value: unknown) => T,
  childId?: string,
): Promise<(AiResult<T> & { jobId: string }) | Response> {
  const hash = await sha256(
    JSON.stringify({ scope, config, system, user, schema }),
  );
  const lease = crypto.randomUUID();
  const { data: job, error } =
    action === "weekly" || action === "learning_import"
      ? await db.rpc(
        action === "weekly"
          ? "reserve_weekly_summary"
          : "reserve_learning_plan_import",
        {
          p_family: parent.familyId,
          p_user: parent.userId,
          p_context: scope,
          p_lease: lease,
        },
      )
      : await db.rpc(childId ? "reserve_child_ai_operation" : "reserve_ai_operation", {
        ...(childId ? { p_child_id: childId } : {}),
        p_family_id: parent.familyId,
        p_user_id: parent.userId,
        p_action: action,
        p_hash: hash,
        p_lease: lease,
      });
  if (error?.message?.includes("child_archived")) return json({ error: "child_archived" }, 409);
  if (error || !job) {
    return json({ error: "ai_configuration_unavailable" }, 503);
  }
  if (job.error) {
    return json(
      { error: job.error },
      job.error === "ai_quota_exceeded"
        ? 402
        : job.error === "ai_rate_limited"
        ? 429
        : 409,
    );
  }
  if (job.cached) {
    try {
      return {
        ...job.cached,
        output: validate(job.cached.output),
        jobId: job.id,
      };
    } catch {
      return json({ error: "ai_result_invalid" }, 502);
    }
  }
  let result: AiResult<T>;
  try {
    const generated = await callClaude<unknown>(
      apiKey,
      config,
      system,
      user,
      schema,
    );
    result = { ...generated, output: validate(generated.output) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "generation_failed";
    const code =
      /^(anthropic_[a-z0-9_]+|ai_input_too_large|ai_token_count_invalid|ai_result_invalid)$/
          .test(
            message,
          )
        ? message
        : "provider_outcome_unknown";
    const uncertain = code === "provider_outcome_unknown" ||
      code === "ai_result_invalid" || code === "anthropic_max_tokens" ||
      code === "anthropic_refusal" || /^anthropic_5[0-9][0-9]$/.test(code);
    const detail = e && typeof e === "object" && "validationCode" in e &&
        typeof e.validationCode === "string" &&
        /^(envelope|item|fields|title|subject|topic|date|time|page|note|steps_or_kind)$/
          .test(e.validationCode)
      ? `${code}_${e.validationCode}`
      : code;
    await db.rpc("finish_ai_operation", {
      p_id: job.id,
      p_lease: lease,
      p_result: null,
      p_error: detail,
      p_uncertain: uncertain,
    });
    return json({
      error: uncertain
        ? "ai_result_uncertain"
        : code === "ai_input_too_large"
        ? code
        : "generation_failed",
    }, 502);
  }
  const { error: saveError } = await db.rpc("finish_ai_operation", {
    p_id: job.id,
    p_lease: lease,
    p_result: result,
  });
  if (saveError) return json({ error: "ai_result_uncertain" }, 503);
  return { ...result, jobId: job.id };
}
