import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json } from "../_shared/supabase.ts";
import { fail } from "../_shared/error-contract.ts";
import type { ParentContext } from "../_shared/auth.ts";
import { type AiConfig, resolveAi } from "../_shared/prova.ts";
import { provaDocument } from "../_shared/prova-document.ts";
import { runAiOperation } from "../_shared/ai-operation.ts";
import {
  LEARNING_PLAN_SCHEMA,
  LEARNING_PLAN_SYSTEM,
  validateLearningPlanExtraction,
} from "../_shared/learning-plan-extraction.ts";
type Deps = {
  db: SupabaseClient;
  /** `parentOrResponse`: sözleşmeli 401/403 yanıtı aynen döner; null eski çağıranlar için `forbidden`. */
  parent: (r: Request) => Promise<ParentContext | Response | null>;
  key: () => string | Response;
  resolve?: typeof resolveAi;
  document?: typeof provaDocument;
  run?: typeof runAiOperation;
};
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
export async function handleLearningPlanImport(
  req: Request,
  deps: Deps,
): Promise<Response> {
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const parent = await deps.parent(req);
  if (parent instanceof Response) return parent;
  if (!parent) return fail("forbidden", 403);
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 512) throw Error();
    body = JSON.parse(raw);
    if (
      !body ||
      Object.keys(body).sort().join() !==
        "ai_consent,child_id,locale,source_id" ||
      !uuid(body.child_id) || !uuid(body.source_id) ||
      !["tr", "en"].includes(body.locale)
    ) throw Error();
    if (body.ai_consent !== true) {
      return fail("source_ai_consent_required", 400);
    }
  } catch {
    return fail("invalid_input", 400);
  }
  const args = {
    p_family: parent.familyId,
    p_user: parent.userId,
    p_child: body.child_id,
    p_source: body.source_id,
    p_locale: body.locale,
  };
  const db = deps.db;
  // Existing context is read before selecting a new model. A retry keeps its original contract.
  let prepared = await db.rpc("prepare_learning_plan_import", {
    ...args,
    p_context: null,
  });
  if (prepared.error?.message === "plan_import_context_needed") {
    const ent = await db.rpc("get_family_entitlement", {
      p_family_id: parent.familyId,
    });
    if (ent.error || !ent.data?.[0]?.plan) {
      return fail("entitlement_failed", 503);
    }
    const config = await (deps.resolve ?? resolveAi)(
      db,
      ent.data[0].plan,
      6000,
    );
    if (config instanceof Response) return config;
    prepared = await db.rpc("prepare_learning_plan_import", {
      ...args,
      p_context: {
        config,
        system: LEARNING_PLAN_SYSTEM,
        schema: LEARNING_PLAN_SCHEMA,
      },
    });
  }
  if (prepared.error || !prepared.data) {
    return fail("plan_import_unavailable", 409);
  }
  const saved = prepared.data, c = saved.context;
  if (
    !uuid(saved.id) || !c || !Number.isInteger(c.pages) || c.pages < 1 ||
    c.pages > 20 || !c.config || typeof c.system !== "string" || !c.schema ||
    !c.input || c.input.locale !== body.locale
  ) return fail("plan_import_unavailable", 503);
  if (saved.view?.status === "done") {
    try {
      return json({
        ...saved.view,
        draft: validateLearningPlanExtraction(saved.view.draft, c.pages),
      });
    } catch {
      return fail("ai_result_invalid", 502);
    }
  }
  const key = deps.key();
  if (key instanceof Response) return key;
  const document = await (deps.document ?? provaDocument)(
    db,
    parent.familyId,
    parent.userId,
    saved.id,
    body.source_id,
    true,
    "import",
  );
  if (document instanceof Response) return document;
  if (document.sha256 !== c.sha256) {
    return fail("source_not_ready", 409);
  }
  const result = await (deps.run ?? runAiOperation)(
    db,
    parent,
    "learning_import",
    saved.id,
    key,
    c.config as AiConfig,
    c.system,
    [{ type: "text", text: JSON.stringify(c.input) }, ...document.media],
    c.schema,
    (v) => validateLearningPlanExtraction(v, c.pages),
  );
  if (result instanceof Response) return result;
  // Recheck live family/source after provider completion; deletion cannot resurrect a draft.
  const refreshed = await db.rpc("prepare_learning_plan_import", {
    ...args,
    p_context: null,
  });
  if (
    refreshed.error || refreshed.data?.id !== saved.id ||
    refreshed.data?.view?.status !== "done"
  ) return fail("plan_import_unavailable", 409);
  try {
    return json({
      ...refreshed.data.view,
      draft: validateLearningPlanExtraction(refreshed.data.view.draft, c.pages),
    });
  } catch {
    return fail("ai_result_invalid", 502);
  }
}
