import { fail } from "../_shared/error-contract.ts";
import { classifyAiError, generateWith } from "../_shared/ai-route.ts";
import { PROMPT_VERSION, SCHEMA, SYSTEM_PROMPT } from "./generation-schema.ts";
import {
  COGNITIVE_DEMANDS,
  finishGeneration,
  type GeneratedOutput,
  GenerationInvalidError,
  type GenerationContext,
  recoverGeneration,
  validateGenerationResult,
} from "../_shared/generation-result.ts";
import { cataloguePlan } from "../_shared/catalogue-plan.ts";
import { blueprintPlan } from "../_shared/blueprint-plan.ts";
import { generationDraftScope } from "../_shared/prova-generation-scope.ts";
import {
  legacyKindFor,
  parseInteractionTypes,
  disabledInteractionTypes,
  STRUCTURED_PROMPT,
  STRUCTURED_PROMPT_VERSION,
  structuredGenerationSchema,
} from "../_shared/structured-generation.ts";
// Prova AI soru üretimi. Veli uygulamadan çağırır (JWT ile); çocuk asla çağırmaz.
// Deploy: `supabase functions deploy prova-generate` (verify_jwt açık kalır).
// Kurallar: yalnız parent; paket AI üretim kotası (plans.prova_ai_generate_monthly) sunucuda;
// senaryodan üretim prova_scenarios ister; model ai_settings'ten; ANTHROPIC_API_KEY yoksa 503 ai_not_configured.
// Modele yalnız ders/sınıf/konu/zorluk gider; aileye ya da çocuğa ait hiçbir veri gönderilmez.
// Üretilen sorular question_bank'a provenance ile yazılır: {generator:"ai", model, prompt_version, prompt_hash, prompt, ...}.

import { provaDocument } from "../_shared/prova-document.ts";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import {
  type AiResult,
  type AiUserContent,
  apiKeyOrResponse,
  DIFFICULTIES,
  type Difficulty,
  parentOrResponse,
  provaEntitlement,
  resolveAi,
  sha256,
} from "../_shared/prova.ts";

const MAX_TOTAL = 30;

type KindMode = "multiple_choice" | "open_ended" | "mixed";

interface GenerateBody {
  recover_only?: boolean;
  draft_id?: string;
  request_id?: string;
  note?: string;
  source_id?: string;
  ai_consent?: boolean;
  subject?: string;
  grade?: number;
  topic?: string;
  topic_plan?: { topic: string; count: number }[];
  blueprint_id?: string | null;
  count?: number; // senaryosuz: toplam; senaryoda satır sayısı yoksa konu başına
  kind?: KindMode;
  assessment?: "practice" | "written" | "context";
  difficulty?: Difficulty;
  locale?: "tr" | "en";
  /** QT-AI: izin verilen etkileşim türleri (eski + yapılandırılmış). Verilirse `kind` yerine geçer. */
  interaction_types?: string[];
}

function clampInt(
  v: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const parent = await parentOrResponse(req);
  if (parent instanceof Response) return parent;

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", 400);
  }
  if (!body || typeof body !== "object") {
    return fail("bad_request", 400);
  }
  const requestId = body.request_id ?? crypto.randomUUID();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(requestId)
  ) return fail("bad_request", 400);
  const subject = typeof body.subject === "string"
    ? body.subject.trim().slice(0, 80)
    : "";
  const grade = clampInt(body.grade, 1, 12, 0);
  const assessment =
    body.assessment === "written" || body.assessment === "context"
      ? body.assessment
      : "practice";
  const kind: KindMode = assessment === "written"
    ? "open_ended"
    : body.kind === "multiple_choice" || body.kind === "open_ended"
    ? body.kind
    : "mixed";
  const difficulty: Difficulty =
    DIFFICULTIES.includes(body.difficulty as Difficulty)
      ? (body.difficulty as Difficulty)
      : "orta_ustu";
  const locale = body.locale === "en" ? "en" : "tr";
  const count = clampInt(body.count, 1, MAX_TOTAL, 5);
  if (!subject || !grade) {
    return fail("subject_and_grade_required", 400);
  }

  const db = serviceClient();
  const { request_id: _requestId, recover_only: recoverOnly, ...intent } = body;
  if (JSON.stringify(intent).length > 50000) {
    return fail("invalid_input", 400);
  }
  const recovered = await recoverGeneration(
    db,
    parent,
    requestId,
    intent,
    recoverOnly === true,
  );
  if (recovered) return recovered;
  if (recoverOnly === true) {
    return fail("generation_not_started", 409);
  }
  const draftScope = await generationDraftScope(
    db,
    parent.familyId,
    body.draft_id,
    grade,
    subject,
  );
  if (draftScope instanceof Response) return draftScope;
  if (draftScope?.purpose === "written" && assessment !== "written") {
    return fail("prova_draft_changed", 409);
  }
  // QT-AI: yazılı/OYSS (meb_common) isteğinde alıştırma türleri istenemez; açık neden, sessiz dönüşüm yok.
  // Rezervasyondan ve sağlayıcıdan ÖNCE: ücret/kota oluşmaz.
  const writtenTrack = assessment === "written" || draftScope?.purpose === "written" ||
    draftScope?.track === "meb_common";
  const interaction = parseInteractionTypes(body.interaction_types, writtenTrack);
  if (interaction && "error" in interaction) {
    return fail(interaction.error, 400, interaction.details ? { details: interaction.details } : {});
  }
  const interactionTypes = interaction?.types ?? null;
  const structuredRequested = !!interactionTypes?.some((t) => t !== "multiple_choice" && t !== "open_ended");
  const effectiveKind: KindMode = interactionTypes ? legacyKindFor(interactionTypes) : kind;
  // QT-AI v10: Faz 2A/2B türleri enabled=false gelir. Kapalı tür sağlayıcıdan önce reddedilir (SQL zaten reddederdi,
  // ama ücretli çıktı boşa gider ve iş takılırdı). Açıldığında aynı istek kod değişmeden çalışır.
  if (structuredRequested) {
    const disabled = await disabledInteractionTypes(db as unknown as Parameters<typeof disabledInteractionTypes>[0], interactionTypes!);
    if (disabled === null) return fail("data_failed", 503);
    if (disabled.length) {
      return fail("interaction_type_unavailable", 409, { details: { types: disabled.join(",") } });
    }
  }
  const promptVersion = structuredRequested ? STRUCTURED_PROMPT_VERSION : PROMPT_VERSION;
  let ent;
  try {
    ent = await provaEntitlement(db, parent.familyId);
  } catch {
    return fail("entitlement_failed", 500);
  }
  if (ent.ai_generate_limit <= 0) {
    return fail("plan_has_no_ai", 402, { details: { plan: ent.plan }, legacy: { plan: ent.plan } });
  }

  // Konu planı: senaryodan (satır sayılarıyla) ya da tek konu.
  let topics: { topic: string; count: number }[] = [];
  let scenarioCode: string | null = null;
  let blueprintSource: string | null = null;
  let catalogueBound = false;
  let blueprintSnapshot: Record<string, unknown> | null = null;
  let scenario: GenerationContext["scenario"] = null;
  if (body.blueprint_id) {
    if (!ent.scenarios) {
      return fail("plan_limit_prova_scenarios", 402, { details: { plan: ent.plan }, legacy: { plan: ent.plan } });
    }
    const { data: bp } = await db
      .from("exam_blueprints")
      .select("id, name, subject, grade, rows, source_url, source_context")
      .eq("id", body.blueprint_id)
      .eq("family_id", parent.familyId)
      .maybeSingle();
    if (!bp) return fail("blueprint_not_found", 404);
    try {
      const parsed = blueprintPlan(bp, grade, subject);
      scenarioCode = parsed.name;
      blueprintSource = bp.source_url;
      topics = parsed.topics;
      blueprintSnapshot = { id: bp.id, ...parsed.context, rows: parsed.topics };
      const { data: catalogue, error: catalogueError } = await db.rpc(
        "get_catalog_blueprint_context",
        { p_family_id: parent.familyId, p_blueprint_id: bp.id },
      );
      if (catalogueError) return fail("data_failed", 503);
      if (catalogue) {
        if (
          !draftScope || draftScope.purpose !== "written" ||
          assessment !== "written"
        ) return fail("curriculum_scope_mismatch", 409);
        const plan = cataloguePlan(catalogue, grade, subject, topics);
        // The provider receives the normalized block/outcome wording (learning_blocks), never only a URL.
        blueprintSnapshot = { id: bp.id, ...plan, rows: topics };
        scenario = plan.scenario;
        catalogueBound = true;
      }
    } catch (e) {
      return json({
        error: e instanceof Error ? e.message : "blueprint_invalid",
      }, 400);
    }
  } else if (body.topic_plan !== undefined) {
    if (
      !Array.isArray(body.topic_plan) || body.topic_plan.length < 1 ||
      body.topic_plan.length > 30 || body.topic_plan.some((row) =>
        !row || typeof row.topic !== "string" || !row.topic.trim() ||
        row.topic.length > 200 || !Number.isInteger(row.count) ||
        row.count < 1 || row.count > 30
      ) || new Set(body.topic_plan.map((row) =>
          row.topic.trim()
        )).size !== body.topic_plan.length
    ) {
      return fail("topic_required", 400);
    }
    topics = body.topic_plan.map((row) => ({
      topic: row.topic.trim(),
      count: row.count,
    }));
  } else {
    const topic = typeof body.topic === "string"
      ? body.topic.trim().slice(0, 200)
      : "";
    if (!topic) return fail("topic_required", 400);
    topics = [{ topic, count }];
  }
  const total = topics.reduce((s, t) => s + t.count, 0);
  if (!topics.length || total < 1) {
    return fail("topic_required", 400);
  }
  if (total > MAX_TOTAL) {
    return fail("too_many_questions", 400, { details: { max: MAX_TOTAL }, legacy: { max: MAX_TOTAL } });
  }

  const ai = await resolveAi(
    db,
    ent.plan === "free" && (ent.ai_generate_bonus ?? 0) > 0 ? "plus" : ent.plan,
    16000,
  );
  if (ai instanceof Response) return ai;
  // QT-AI: yapılandırılmış tür yalnız JSON şeması destekleyen modelle istenir (doğrulamasız kabul yok).
  if (interactionTypes && ai.capabilities?.jsonSchema !== true) {
    return fail("ai_model_unsupported", 503);
  }
  const apiKey = apiKeyOrResponse(ai);
  if (apiKey instanceof Response) return apiKey;

  const request = {
    dil: locale,
    ders: subject,
    sinif: grade,
    senaryo: scenarioCode,
    senaryo_kapsami: blueprintSnapshot,
    konular: topics.map((t) => ({ konu: t.topic, soru_sayisi: t.count })),
    tur: interactionTypes
      ? interactionTypes.join(", ")
      : kind === "mixed"
      ? "karışık (şıklı ve açık uçlu, yaklaşık yarı yarıya)"
      : kind,
    ...(interactionTypes ? { etkilesim_turleri: interactionTypes } : {}),
    zorluk: difficulty,
    amac: assessment === "written"
      ? "Okul yazılısı provası: açık uçlu / kısa cevaplı"
      : assessment === "context"
      ? "Bağlam ve beceri temelli pratik"
      : "Konu pekiştirme",
  };
  const document = body.source_id
    ? await provaDocument(
      db,
      parent.familyId,
      parent.userId,
      requestId,
      body.source_id,
      body.ai_consent,
    )
    : null;
  if (document instanceof Response) return document;
  const systemPrompt = structuredRequested ? SYSTEM_PROMPT + "\n" + STRUCTURED_PROMPT : SYSTEM_PROMPT;
  const schema = interactionTypes
    ? structuredGenerationSchema(SCHEMA, interactionTypes, {
      difficulties: DIFFICULTIES,
      cognitive: COGNITIVE_DEMANDS,
    })
    : SCHEMA;
  const userPrompt = JSON.stringify({
    ...request,
    ek_not: typeof body.note === "string" ? body.note.slice(0, 1500) : "",
    belge: document ? { id: document.id, sha256: document.sha256 } : null,
  });
  const userContent: AiUserContent = document
    ? [{ type: "text", text: userPrompt }, ...document.media]
    : userPrompt;
  const promptHash = await sha256(
    `${promptVersion}\n${JSON.stringify(ai)}\n${
      JSON.stringify(draftScope)
    }\n${systemPrompt}\n${userPrompt}`,
  );

  const context: GenerationContext = {
    schema: "gina.generation-context.v1",
    subject,
    grade,
    total,
    topics,
    kind: effectiveKind,
    difficulty,
    locale,
    scenarioCode,
    blueprintSource,
    blueprintSnapshot,
    draftScope,
    document: document ? { id: document.id, sha256: document.sha256 } : null,
    ai,
    promptVersion,
    promptHash,
    systemPrompt,
    userPrompt,
    catalogueBound,
    scenario,
    ...(interactionTypes ? { interactionTypes, writtenTrack } : {}),
  };
  const { data: reservation, error: reservationError } = await db.rpc(
    "reserve_prova_generation_v3",
    {
      p_id: requestId,
      p_family_id: parent.familyId,
      p_user_id: parent.userId,
      p_hash: promptHash,
      p_items: total,
      p_intent: intent,
      p_context: context,
    },
  );
  if (reservationError) {
    const known = ["curriculum_scope_mismatch", "prova_draft_changed"].includes(reservationError.message);
    return fail(known ? reservationError.message : "save_failed", known ? 409 : 500);
  }
  if (reservation?.cached) return json(reservation.cached);
  if (reservation?.error) {
    return fail(
      String(reservation.error),
      reservation.error === "ai_quota_exceeded" ? 402 : 409,
    );
  }
  if (
    reservation?.context && reservation?.provider_result && reservation?.lease
  ) {
    return finishGeneration(
      db,
      parent,
      requestId,
      reservation.lease,
      reservation.context,
      reservation.provider_result,
    );
  }
  const lease = reservation?.lease;
  if (!lease) return fail("ai_result_uncertain", 503);
  async function failJob(code: string, uncertain: boolean) {
    await db.rpc("fail_prova_generation_v2", {
      p_id: requestId,
      p_lease: lease,
      p_code: code,
      p_uncertain: uncertain,
    });
  }
  let result: AiResult<GeneratedOutput>;
  try {
    result = reservation.provider_result ??
      await generateWith<GeneratedOutput>(
        apiKey,
        ai,
        systemPrompt,
        userContent,
        schema,
      );
    validateGenerationResult(result, context);
    if (!reservation.provider_result) {
      const { error } = await db.rpc("save_prova_provider_result", {
        p_id: requestId,
        p_lease: lease,
        p_result: result,
      });
      if (error) return fail("ai_result_uncertain", 503);
    }
  } catch (e) {
    // C08: sağlayıcıdan bağımsız sınıflandırma (anthropic_/openai_/gemini_ kodları aynı kurala uyar).
    // Belirsiz sonuç (5xx, zaman aşımı, ret, kesilme, bozuk çıktı) işi `uncertain` bırakır: tekrar/fallback yok.
    const failure = classifyAiError(e);
    await failJob(failure.code, failure.uncertain);
    // QT-AI: yapılandırılmış satır reddi aynı belirsiz/ücretsiz-tekrar-yok yolunu izler; yalnız sabit kodlar eklenir.
    if (e instanceof GenerationInvalidError && e.codes.length) {
      return fail(failure.publicError, 502, { details: { reasons: e.codes.join(",") } });
    }
    return fail(failure.publicError, 502);
  }

  return finishGeneration(db, parent, requestId, lease, context, result);
});
