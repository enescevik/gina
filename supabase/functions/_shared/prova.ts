// Prova AI fonksiyonlarının (prova-generate / prova-grade / prova-plan) ortak yardımcıları.
// Kurallar (docs/DECISIONS.md): yalnız veli (gina.role = parent) çağırır; paket kapısı sunucuda;
// model ve token limiti ai_settings'ten (yoksa plans.ai_model); kill switch app_settings 'ai.enabled'
// ve ai_settings.enabled; ANTHROPIC_API_KEY yalnız ortamdan okunur. Modele kişisel veri gönderilmez.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { json } from "./supabase.ts";

export { readParent } from "./auth.ts";

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ProvaEntitlement {
  plan: "free" | "plus" | "pro";
  monthly_exams_limit: number | null;
  monthly_exams_used: number;
  scenarios: boolean;
  ai_generate_limit: number;
  ai_generate_used: number;
  ai_grading: boolean;
  study_plan: boolean;
  booklet: boolean;
}

export async function provaEntitlement(db: SupabaseClient, familyId: string): Promise<ProvaEntitlement> {
  const { data, error } = await db.rpc("get_prova_entitlement", { p_family_id: familyId });
  if (error || !data) throw new Error(`entitlement_failed:${error?.message ?? "empty"}`);
  return data as ProvaEntitlement;
}

export interface AiConfig {
  model: string;
  maxOutputTokens: number;
  promptVersion: string;
}

/**
 * Paketin AI ayarı. Kapalıysa (kill switch / paket) Response döner; istemci bunu aynen iletir.
 * Sıra: app_settings 'ai.enabled' (global) → ai_settings (paket başına) → plans.ai_model (yedek).
 */
export async function resolveAi(db: SupabaseClient, plan: string, minOutputTokens: number): Promise<AiConfig | Response> {
  const { data: global } = await db.from("app_settings").select("value").eq("key", "ai.enabled").maybeSingle();
  if (global && global.value === false) return json({ error: "ai_disabled" }, 503);

  let model: string | null = null;
  let maxOutputTokens = 0;
  let promptVersion = "v1";
  const { data: setting, error: settingError } = await db
    .from("ai_settings")
    .select("model_id, max_output_tokens, prompt_version, enabled")
    .eq("plan_code", plan)
    .maybeSingle();
  if (!settingError && setting) {
    if (setting.enabled === false) return json({ error: "ai_disabled" }, 503);
    model = setting.model_id ?? null;
    maxOutputTokens = setting.max_output_tokens ?? 0;
    promptVersion = setting.prompt_version ?? "v1";
  }
  if (!model) {
    const { data: planRow } = await db.from("plans").select("ai_model").eq("code", plan).maybeSingle();
    model = planRow?.ai_model ?? null;
  }
  if (!model) return json({ error: "plan_has_no_ai", plan }, 402);
  return { model, maxOutputTokens: Math.max(maxOutputTokens, minOutputTokens), promptVersion };
}

export function apiKeyOrResponse(): string | Response {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "ai_not_configured" }, 503);
  return key;
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
export async function callClaude<T>(
  apiKey: string,
  cfg: AiConfig,
  system: string,
  user: string,
  schema: Record<string, unknown>,
): Promise<AiResult<T>> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: cfg.maxOutputTokens,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { format: { type: "json_schema", schema } },
    }),
  });
  if (!res.ok) throw new Error(`anthropic_${res.status}`);
  const data = await res.json();
  if (data.stop_reason === "refusal") throw new Error("anthropic_refusal");
  if (data.stop_reason === "max_tokens") throw new Error("anthropic_max_tokens");
  const block = (data.content ?? []).find((b: { type: string }) => b.type === "text");
  const text: string = block?.text ?? "{}";
  return {
    output: JSON.parse(text.replace(/^```json\s*|```\s*$/g, "")) as T,
    inputTokens: data.usage?.input_tokens ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  };
}

export async function logUsage(
  db: SupabaseClient,
  row: {
    family_id: string;
    action: "generate" | "grade" | "plan";
    model: string;
    items: number;
    input_tokens: number | null;
    output_tokens: number | null;
    requested_by: string | null;
  },
): Promise<void> {
  await db.from("prova_ai_usage").insert(row);
}

/** Yalnız resmî kaynak alan adları kalır (MEB / EBA); diğerleri atılır. */
export function officialUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .filter((u): u is string => typeof u === "string")
    .filter((u) => {
      try {
        const host = new URL(u).hostname.toLowerCase();
        return host === "meb.gov.tr" || host.endsWith(".meb.gov.tr") || host === "eba.gov.tr" || host.endsWith(".eba.gov.tr");
      } catch {
        return false;
      }
    })
    .slice(0, 5);
}

export const DIFFICULTIES = ["kolay", "orta", "orta_ustu", "zor"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
