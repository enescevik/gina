import { setupPrompt } from "../_shared/setup-prompt.ts";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import { fail } from "../_shared/error-contract.ts";
import { parentOrResponse } from "../_shared/auth.ts";
import { apiKeyOrResponse, resolveAi, sha256 } from "../_shared/prova.ts";
import { generateWith } from "../_shared/ai-route.ts";
import { setupDocumentResult, setupInput } from "../_shared/setup-drafts.ts";
import { provaDocument } from "../_shared/prova-document.ts";
export const defaults = {
  serviceClient,
  parentOrResponse,
  resolveAi,
  apiKeyOrResponse,
  /** C08: çözülmüş adapter ile üretim (eski ad korunur; testler bu bağımlılığı değiştirir). */
  callClaude: generateWith,
  provaDocument,
};
export async function setupSuggestions(
  req: Request,
  deps = defaults,
): Promise<Response> {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const db = deps.serviceClient();
  const parent = await deps.parentOrResponse(req, db);
  if (parent instanceof Response) return parent;
  let body, input;
  try {
    body = await req.json();
    input = setupInput(body);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        body.request_id ?? "",
      )
    ) {
      throw Error();
    }
  } catch {
    return fail("invalid_input", 400);
  }
  const { data: ent, error } = await db.rpc("get_setup_ai_entitlement", {
    p_family_id: parent.familyId,
  });
  if (error || !ent) return fail("entitlement_failed", 500);
  if (!ent.limit) return fail("plan_has_no_ai", 402);
  const ai = await deps.resolveAi(db, ent.plan, body.source_id ? 3072 : 2048);
  if (ai instanceof Response) return ai;
  const key = deps.apiKeyOrResponse(ai);
  if (key instanceof Response) return key;
  const document = body.source_id
    ? await deps.provaDocument(
      db,
      parent.familyId,
      parent.userId,
      body.request_id,
      body.source_id,
      body.source_ai_consent,
      "setup",
    )
    : null;
  if (document instanceof Response) return document;
  const prompt = JSON.stringify(input);
  const hash = await sha256(
    JSON.stringify({
      version: "setup-v2",
      input,
      source: document ? { id: document.id, sha256: document.sha256 } : null,
    }),
  );
  const lease = crypto.randomUUID();
  const { data: job, error: reserveError } = await db.rpc(
    "reserve_setup_generation",
    {
      p_id: body.request_id,
      p_family_id: parent.familyId,
      p_user_id: parent.userId,
      p_hash: hash,
      p_lease: lease,
    },
  );
  if (reserveError || !job) return fail("save_failed", 500);
  if (job.cached) return json(job.cached);
  if (job.error) {
    return fail(
      String(job.error),
      job.error === "ai_quota_exceeded" ? 402 : 409,
    );
  }
  const { system, schema } = setupPrompt(input, !!document);
  let response;
  try {
    const result = await deps.callClaude<
      { suggestions: unknown; document_notes?: unknown }
    >(
      key,
      ai,
      system,
      document ? [{ type: "text", text: prompt }, ...document.media] : prompt,
      schema,
    );
    response = setupDocumentResult(result.output, input.kind, document?.id);
  } catch {
    // Provider failure may be paid but unobserved. Do not start it again implicitly.
    try {
      await db.rpc("finish_setup_generation", {
        p_id: body.request_id,
        p_lease: lease,
        p_result: null,
        p_unknown: true,
      });
    } catch {
      /* Leave the lease fenced until expiry; never rerun implicitly. */
    }
    return fail("ai_result_uncertain", 502);
  }
  try {
    const saved = await db.rpc("finish_setup_generation", {
      p_id: body.request_id,
      p_lease: lease,
      p_result: response,
      p_unknown: false,
    });
    if (saved.error || saved.data !== true) {
      return fail("ai_result_uncertain", 503);
    }
    return json(response);
  } catch {
    return fail("ai_result_uncertain", 503);
  }
}
