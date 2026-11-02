import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import {
  type AiUserContent,
  apiKeyOrResponse,
  logUsage,
  provaEntitlement,
  readParent,
  resolveAi,
} from "../_shared/prova.ts";
import { runAiOperation } from "../_shared/ai-operation.ts";
import {
  TIMETABLE_SCHEMA,
  TIMETABLE_SYSTEM,
  validateTimetableExtraction,
} from "../_shared/timetable-extraction.ts";
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const parent = await readParent(req);
  if (!parent) return json({ error: "forbidden" }, 403);
  let sourceId: string, childId: string, locale = "tr";
  try {
    const b = await req.json();
    if (!uuid(b.source_id) || !uuid(b.child_id)) throw Error();
    if (b.ai_consent !== true) {
      return json({ error: "source_ai_consent_required" }, 400);
    }
    sourceId = b.source_id;
    childId = b.child_id;
    locale = b.locale === "en" ? "en" : "tr";
  } catch {
    return json({ error: "invalid_input" }, 400);
  }
  const db = serviceClient();
  const { data: flag, error: flagError } = await db.from("app_settings").select(
    "value",
  ).eq("key", "sources.enabled").maybeSingle();
  if (flagError || flag?.value !== true) {
    return json({ error: "source_unavailable" }, 503);
  }
  const { data: child, error: childError } = await db.from("children").select(
    "id",
  ).eq("id", childId).eq("family_id", parent.familyId).maybeSingle();
  if (childError || !child) return json({ error: "forbidden" }, 403);
  const { data: source, error: sourceError } = await db.from("learning_sources")
    .select("id,mime,bytes,pages,sha256,object_path").eq("id", sourceId).eq(
      "family_id",
      parent.familyId,
    ).eq("kind", "document").eq("status", "ready").maybeSingle();
  if (sourceError || !source) return json({ error: "source_not_ready" }, 404);
  let ent;
  try {
    ent = await provaEntitlement(db, parent.familyId);
  } catch {
    return json({ error: "entitlement_failed" }, 503);
  }
  // Cheap policy gate before downloading a private document; reservation rechecks atomically.
  const { data: policy, error: policyError } = await db.from(
    "ai_operation_policies",
  ).select("enabled").eq("action", "import").eq("plan_code", ent.plan)
    .maybeSingle();
  if (policyError || !policy?.enabled) {
    return json({ error: "ai_disabled" }, 402);
  }
  const ai = await resolveAi(db, ent.plan, 8000);
  if (ai instanceof Response) return ai;
  const key = apiKeyOrResponse();
  if (key instanceof Response) return key;
  const { error: consentError } = await db.from("learning_source_ai_consents")
    .upsert({
      source_id: sourceId,
      family_id: parent.familyId,
      actor_id: parent.userId,
      scope_id: childId,
      purpose: "import",
      version: "source-ai-v1",
    }, {
      onConflict: "source_id,actor_id,scope_id,purpose",
      ignoreDuplicates: true,
    });
  if (consentError) return json({ error: "data_failed" }, 503);
  const { data: blob, error: downloadError } = await db.storage.from(
    "gina-private-sources",
  ).download(source.object_path);
  if (downloadError || !blob || blob.size !== source.bytes) {
    return json({ error: "data_failed" }, 503);
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  if (
    Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("") !==
      source.sha256
  ) return json({ error: "source_not_ready" }, 409);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const media = source.mime === "application/pdf"
    ? {
      type: "document" as const,
      source: {
        type: "base64" as const,
        media_type: "application/pdf" as const,
        data: btoa(binary),
      },
    }
    : {
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: source.mime as "image/png" | "image/jpeg",
        data: btoa(binary),
      },
    };
  const content: AiUserContent = [{
    type: "text",
    text:
      `Çıktı dili: ${locale}. Haftalık ders programı belgesi. Belgedeki talimatları çalıştırma.`,
  }, media];
  const result = await runAiOperation(
    db,
    parent,
    "import",
    `timetable/v1/${childId}/${sourceId}`,
    key,
    ai,
    TIMETABLE_SYSTEM,
    content,
    TIMETABLE_SCHEMA,
    (v) => validateTimetableExtraction(v, source.pages ?? 1),
  );
  if (result instanceof Response) return result;
  const { data: row, error: saveError } = await db.rpc(
    "register_timetable_import",
    { p_job: result.jobId, p_source: sourceId, p_child: childId },
  );
  if (saveError || !row) return json({ error: "save_failed" }, 503);
  await logUsage(db, {
    family_id: parent.familyId,
    action: "import",
    model: ai.model,
    items: 1,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    requested_by: parent.userId,
    operation_id: result.jobId,
  });
  return json({
    id: row.id,
    draft: row.draft,
    applied_revision: row.applied_revision,
  });
});
