import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import {
  readParent,
  resolveAi,
  apiKeyOrResponse,
  callClaude,
  sha256,
} from "../_shared/prova.ts";
import {
  setupInput,
  validateDrafts,
  taskIcons,
  rewardIcons,
} from "../_shared/setup-drafts.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const db = serviceClient();
  const parent = await readParent(req, db);
  if (!parent) return json({ error: "forbidden" }, 403);
  let body, input;
  try {
    body = await req.json();
    input = setupInput(body);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        body.request_id ?? "",
      )
    )
      throw Error();
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
  const { data: ent, error } = await db.rpc("get_setup_ai_entitlement", {
    p_family_id: parent.familyId,
  });
  if (error || !ent) return json({ error: "entitlement_failed" }, 500);
  if (!ent.limit) return json({ error: "plan_has_no_ai" }, 402);
  const ai = await resolveAi(db, ent.plan, 2048);
  if (ai instanceof Response) return ai;
  const key = apiKeyOrResponse();
  if (key instanceof Response) return key;
  const prompt = JSON.stringify(input);
  const hash = await sha256(`setup-v1:${prompt}`);
  const { data: job, error: reserveError } = await db.rpc("reserve_setup_ai", {
    p_id: body.request_id,
    p_family_id: parent.familyId,
    p_user_id: parent.userId,
    p_hash: hash,
  });
  if (reserveError || !job) return json({ error: "save_failed" }, 500);
  if (job.cached) return json(job.cached);
  if (job.error)
    return json(
      { error: job.error },
      job.error === "ai_quota_exceeded" ? 402 : 409,
    );
  const system = `Create exactly three simple, age-appropriate ${input.kind === "task" ? "family habit tasks" : "family rewards"} for a parent to review. Use the requested locale. Prefer supportive routines and shared time. Never suggest punishment, food restriction, health advice, public sharing, purchases, private information or gender stereotypes. Preschool tasks must be done together with a parent. Give each a concise title, a short reason, an allowed icon, and a modest integer star value (${input.kind === "task" ? "1–3" : "10–30"} recommended). Return only the schema. These are drafts; nothing is assigned to a child.`;
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "reason", "icon", "stars"],
          properties: {
            title: { type: "string" },
            reason: { type: "string" },
            icon: {
              type: "string",
              enum: input.kind === "task" ? taskIcons : rewardIcons,
            },
            stars: { type: "integer" },
          },
        },
      },
    },
  };
  try {
    const result = await callClaude<{ suggestions: unknown }>(
      key,
      ai,
      system,
      prompt,
      schema,
    );
    const response = {
      suggestions: validateDrafts(result.output.suggestions, input.kind),
    };
    const { error: saveError } = await db
      .from("setup_ai_jobs")
      .update({
        status: "done",
        result: response,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.request_id)
      .eq("status", "working");
    if (saveError) throw Error("save_failed");
    return json(response);
  } catch {
    await db
      .from("setup_ai_jobs")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", body.request_id)
      .eq("status", "working");
    return json({ error: "generation_failed" }, 502);
  }
});
