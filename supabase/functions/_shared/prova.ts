// Prova AI fonksiyonlarının (prova-generate / prova-grade / prova-plan) ortak yardımcıları.
// Kurallar (docs/DECISIONS.md): yalnız veli (gina.role = parent) çağırır; paket kapısı sunucuda;
// model ve token limiti ai_settings'ten (yoksa plans.ai_model); kill switch app_settings 'ai.enabled'
// ve ai_settings.enabled; sağlayıcı anahtarı yalnız secret adıyla ortamdan okunur (apiKeyOrResponse(config)). Modele kişisel veri gönderilmez.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { fail } from "./error-contract.ts";
import {
  type AiAdapterId,
  type AiModelRecord,
  type AiProviderRecord,
  type ModelCapabilities,
  modelSupport,
  PROVIDER_DEFAULTS,
} from "../../../packages/core/src/ai-capabilities.ts";

export { parentOrResponse, readParent } from "./auth.ts";

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface ProvaEntitlement {
  plan: "free" | "plus" | "pro";
  monthly_exams_limit: number | null;
  monthly_exams_used: number;
  scenarios: boolean;
  ai_generate_limit: number;
  ai_generate_used: number;
  ai_generate_bonus?: number;
  ai_generate_remaining?: number;
  ai_grading: boolean;
  study_plan: boolean;
  booklet: boolean;
}

export async function provaEntitlement(
  db: SupabaseClient,
  familyId: string,
): Promise<ProvaEntitlement> {
  const { data, error } = await db.rpc("get_prova_entitlement", {
    p_family_id: familyId,
  });
  if (error || !data) {
    throw new Error(`entitlement_failed:${error?.message ?? "empty"}`);
  }
  return data as ProvaEntitlement;
}

export interface AiConfig {
  model: string;
  maxOutputTokens: number;
  maxInputTokens?: number;
  promptVersion: string;
  /** S06: ai_models.adapter; yoksa Anthropic varsayılır (eski yapılandırma). */
  adapter?: AiAdapterId;
  provider?: string;
  capabilities?: ModelCapabilities;
}

/**
 * Paketin AI ayarı. Kapalıysa (kill switch / paket) Response döner; istemci bunu aynen iletir.
 * Sıra: app_settings 'ai.enabled' (global) → ai_settings (paket başına) → plans.ai_model (yedek).
 */
export async function resolveAi(
  db: SupabaseClient,
  plan: string,
  minOutputTokens: number,
): Promise<AiConfig | Response> {
  const { data: global, error: globalError } = await db.from("app_settings")
    .select("value").eq("key", "ai.enabled").maybeSingle();
  if (globalError) return fail("ai_configuration_unavailable", 503);
  if (global && global.value === false) {
    return fail("ai_disabled", 503);
  }

  let model: string | null = null;
  let maxOutputTokens = 0;
  let promptVersion = "v1";
  let maxInputTokens = 8000;
  const { data: setting, error: settingError } = await db
    .from("ai_settings")
    .select(
      "model_id, max_input_tokens, max_output_tokens, prompt_version, enabled",
    )
    .eq("plan_code", plan)
    .maybeSingle();
  if (settingError) return fail("ai_configuration_unavailable", 503);
  if (setting) {
    if (setting.enabled === false) return fail("ai_disabled", 503);
    model = setting.model_id ?? null;
    maxOutputTokens = setting.max_output_tokens ?? 0;
    maxInputTokens = setting.max_input_tokens ?? 8000;
    promptVersion = setting.prompt_version ?? "v1";
  }
  if (!model) {
    const { data: planRow } = await db.from("plans").select("ai_model").eq(
      "code",
      plan,
    ).maybeSingle();
    model = planRow?.ai_model ?? null;
  }
  if (!model) return fail("plan_has_no_ai", 402, { details: { plan }, legacy: { plan } });
  const { data: registered, error: modelError } = await db.from("ai_models")
    .select(
      "active,provider,adapter,contract_version,supports_vision,supports_pdf,supports_json_schema,context_tokens,tokenizer",
    ).eq("id", model).maybeSingle();
  if (modelError) return fail("ai_configuration_unavailable", 503);
  if (!registered?.active) return fail("ai_model_unavailable", 503);
  // S06: model yalnız adıyla etkin olmaz — adapter + yetenek beyanı + sözleşme sürümü + sağlayıcı kaydı gerekir.
  const { data: providerRow, error: providerError } = await db.from("ai_providers")
    .select("id,adapter,key_secret_name,data_region,cross_border,cost_class,status")
    .eq("id", registered.provider).maybeSingle();
  if (providerError) return fail("ai_configuration_unavailable", 503);
  const record: AiModelRecord = {
    id: model,
    provider: registered.provider,
    active: true,
    adapter: registered.adapter ?? null,
    contractVersion: registered.contract_version ?? null,
    vision: registered.supports_vision === true,
    pdf: registered.supports_pdf === true,
    jsonSchema: registered.supports_json_schema === true,
    contextTokens: registered.context_tokens ?? undefined,
    tokenizer: registered.tokenizer ?? undefined,
  };
  const providers: AiProviderRecord[] = providerRow
    ? [{
      id: providerRow.id,
      displayName: providerRow.id,
      adapter: providerRow.adapter,
      keySecretName: providerRow.key_secret_name,
      dataRegion: providerRow.data_region,
      crossBorder: providerRow.cross_border === true,
      costClass: providerRow.cost_class,
      status: providerRow.status,
    }]
    : [];
  const support = modelSupport(record, providers);
  if (!support.supported) {
    // Dizi alanları `details`'e sığmaz; sabit nedenler/özellikler eski üst düzey alanlarda kalır.
    return fail("ai_model_unsupported", 503, {
      legacy: { reasons: support.reasons, unsupported_features: support.unsupportedFeatures },
    });
  }
  return {
    model,
    maxOutputTokens: maxOutputTokens || minOutputTokens,
    maxInputTokens,
    promptVersion,
    adapter: record.adapter as AiAdapterId,
    provider: record.provider,
    capabilities: {
      vision: record.vision === true,
      pdf: record.pdf === true,
      jsonSchema: record.jsonSchema === true,
      contextTokens: record.contextTokens as number,
      tokenizer: record.tokenizer as ModelCapabilities["tokenizer"],
    },
  };
}

/** Sağlayıcı anahtarı yalnız secret ADI ile ortamdan okunur (C08: çağıran resolveAi çıktısını geçirir).
 * Secret adı adapter kaydından (core PROVIDER_DEFAULTS = ai_providers tohumu) gelir; Anthropic sabiti yok.
 * Config verilmezse eski davranış (Anthropic) korunur. Anthropic anahtarı yoksa `ai_not_configured` (eski kod),
 * diğer sağlayıcılarda `provider_unconfigured`. Değer asla yazılmaz/loglanmaz. */
export function apiKeyOrResponse(
  config?: Pick<AiConfig, "adapter">,
  env: (name: string) => string | undefined = (name) => Deno.env.get(name),
): string | Response {
  const adapter = config?.adapter ?? "anthropic-messages";
  const secretName = PROVIDER_DEFAULTS.find((p) => p.adapter === adapter)?.keySecretName;
  const key = secretName ? env(secretName) : undefined;
  if (key) return key;
  if (adapter === "anthropic-messages") return fail("ai_not_configured", 503);
  return fail("provider_unconfigured", 503, { details: { provider: adapter }, legacy: { provider: adapter } });
}

export interface AiResult<T> {
  output: T;
  inputTokens: number | null;
  outputTokens: number | null;
}

/**
 * Anthropic Messages API (fetch). Yapılandırılmış çıktı: output_config.format json_schema.
 * Yanıtta düşünme blokları text'ten önce gelebilir; text bloğu tipine göre aranır.
 */
export type AiUserContent =
  | string
  | ({ type: "text"; text: string } | {
    type: "image";
    source: {
      type: "base64";
      media_type: "image/png" | "image/jpeg";
      data: string;
    };
  } | {
    type: "document";
    source: { type: "base64"; media_type: "application/pdf"; data: string };
  })[];

export async function callClaude<T>(
  apiKey: string,
  cfg: AiConfig,
  system: string,
  user: AiUserContent,
  schema: Record<string, unknown>,
): Promise<AiResult<T>> {
  // Check the configured input cap with the provider's tokenizer, not a character estimate.
  // No retry here: uncertain network outcomes may already have incurred cost.
  const headers = {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
  if (
    new TextEncoder().encode(
      system + (typeof user === "string" ? user : JSON.stringify(user)),
    ).length > (typeof user === "string" ? 1_000_000 : 32_000_000)
  ) throw new Error("ai_input_too_large");
  const count = await fetch(
    "https://api.anthropic.com/v1/messages/count_tokens",
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers,
      body: JSON.stringify({
        model: cfg.model,
        system,
        messages: [{ role: "user", content: user }],
      }),
    },
  );
  if (!count.ok) throw new Error(`anthropic_${count.status}`);
  const tokens = (await count.json()).input_tokens;
  if (!Number.isInteger(tokens) || tokens < 0) {
    throw new Error("ai_token_count_invalid");
  }
  if (tokens > (cfg.maxInputTokens ?? 8000)) {
    throw new Error("ai_input_too_large");
  }
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(115_000),
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: cfg.maxOutputTokens,
      system: [{
        type: "text",
        text: system,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema } },
    }),
  });
  if (!res.ok) throw new Error(`anthropic_${res.status}`);
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error("anthropic_refusal");
  if (data.stop_reason === "max_tokens") {
    throw new Error("anthropic_max_tokens");
  }
  const block = (Array.isArray(data.content) ? data.content : []).find((
    b: { type: string },
  ) => b?.type === "text");
  if (typeof block?.text !== "string" || !block.text.trim()) {
    throw new Error("ai_result_invalid");
  }
  let output: T;
  try {
    output = JSON.parse(block.text.replace(/^```json\s*|```\s*$/g, "")) as T;
  } catch {
    throw new Error("ai_result_invalid");
  }
  return {
    output,
    inputTokens: data.usage?.input_tokens ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  };
}

export async function logUsage(
  db: SupabaseClient,
  row: {
    family_id: string;
    action: "generate" | "grade" | "plan" | "import";
    model: string;
    items: number;
    input_tokens: number | null;
    output_tokens: number | null;
    requested_by: string | null;
    operation_id?: string;
  },
): Promise<void> {
  const { error } = row.operation_id
    ? await db.from("prova_ai_usage").upsert(row, {
      onConflict: "operation_id",
      ignoreDuplicates: true,
    })
    : await db.from("prova_ai_usage").insert(row);
  if (error) throw new Error("usage_save_failed");
}

/** Yalnız resmî kaynak alan adları kalır (MEB / EBA); diğerleri atılır. */
export function officialUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .filter((u): u is string => typeof u === "string")
    .filter((u) => {
      try {
        const url = new URL(u);
        if (url.protocol !== "https:" || url.username || url.password) {
          return false;
        }
        const host = url.hostname.toLowerCase();
        return host === "meb.gov.tr" || host.endsWith(".meb.gov.tr") ||
          host === "eba.gov.tr" || host.endsWith(".eba.gov.tr");
      } catch {
        return false;
      }
    })
    .slice(0, 5);
}

export const DIFFICULTIES = ["kolay", "orta", "orta_ustu", "zor"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
