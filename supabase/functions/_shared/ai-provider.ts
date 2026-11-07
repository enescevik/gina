// S06 — ortak AI adapter arayüzü ve hata sınıflandırması.
// Anthropic yolu callClaude'u değiştirmeden sarmalar; OpenAI-uyumlu ve Gemini adapterleri
// iskelettir: anahtar yalnız secret ADI ile aranır, yoksa `provider_unconfigured`.
// Hiçbir adapter kendiliğinden ikinci ücretli çağrı yapmaz.
import type { AiConfig, AiResult, AiUserContent } from "./prova.ts";
import {
  type AiAdapterId,
  type AiProviderId,
  type ModelCapabilities,
  PROVIDER_DEFAULTS,
} from "../../../packages/core/src/ai-capabilities.ts";

export type { AiAdapterId, AiProviderId, ModelCapabilities };

export type AiFailureKind =
  | "rate_limited"
  | "rejected"
  | "auth"
  | "server"
  | "timeout"
  | "network"
  | "refusal"
  | "truncated"
  | "invalid_output"
  | "input_too_large"
  | "token_count_invalid"
  | "unsupported"
  | "unconfigured"
  | "unknown";

export interface AiFailure {
  /** Sunucu günlüğü/iş kaydı kodu (ör. anthropic_429, openai_503, provider_unconfigured). */
  code: string;
  kind: AiFailureKind;
  /** true = ücret oluşmuş olabilir; otomatik tekrar yok. */
  uncertain: boolean;
  /** İstemciye verilen genel hata. Sağlayıcı gövdesi hiçbir zaman aktarılmaz. */
  publicError: "ai_result_uncertain" | "ai_input_too_large" | "generation_failed" | "provider_unconfigured" | "ai_model_unsupported";
}

export class AiProviderError extends Error {
  constructor(code: string, readonly billing?: { providerUsage: NonNullable<AiResult<unknown>["providerUsage"]>; model: string; provider: string; inputTokens: number | null; outputTokens: number | null }) {
    super(code);
  }
}

const PROVIDER_CODE = /^(anthropic|openai|gemini)_([a-z0-9_]+)$/;

/** Bilinen kod geçer, bilinmeyen her şey belirsiz sayılır (ağ kaybı, zaman aşımı, beklenmeyen istisna). */
export function classifyAiError(e: unknown): AiFailure {
  const message = e instanceof Error ? e.message : "";
  const name = e instanceof Error ? e.name : "";
  const done = (code: string, kind: AiFailureKind, uncertain: boolean, publicError: AiFailure["publicError"]): AiFailure => ({ code, kind, uncertain, publicError });
  if (message === "ai_input_too_large") return done(message, "input_too_large", false, "ai_input_too_large");
  if (message === "ai_token_count_invalid") return done(message, "token_count_invalid", false, "generation_failed");
  if (message === "ai_result_invalid") return done(message, "invalid_output", true, "ai_result_uncertain");
  if (message === "provider_unconfigured") return done(message, "unconfigured", false, "provider_unconfigured");
  if (message === "ai_model_unsupported") return done(message, "unsupported", false, "ai_model_unsupported");
  if (name === "TimeoutError" || name === "AbortError") return done("provider_outcome_unknown", "timeout", true, "ai_result_uncertain");
  const m = PROVIDER_CODE.exec(message);
  if (m) {
    const detail = m[2];
    if (detail === "quota") return done(message, "rate_limited", false, "generation_failed");
    if (detail === "429") return done(message, "rate_limited", false, "generation_failed");
    if (detail === "401" || detail === "403") return done(message, "auth", false, "generation_failed");
    if (/^5[0-9][0-9]$/.test(detail)) return done(message, "server", true, "ai_result_uncertain");
    if (/^4[0-9][0-9]$/.test(detail)) return done(message, "rejected", false, "generation_failed");
    if (detail === "refusal") return done(message, "refusal", true, "ai_result_uncertain");
    if (detail === "max_tokens" || detail === "length" || detail === "truncated") return done(message, "truncated", true, "ai_result_uncertain");
    return done(message, "unknown", true, "ai_result_uncertain");
  }
  const kind: AiFailureKind = e instanceof TypeError ? "network" : "unknown";
  return done("provider_outcome_unknown", kind, true, "ai_result_uncertain");
}

export interface AiAdapter {
  id: AiAdapterId;
  provider: AiProviderId;
  /** Secret ADI; değeri yalnız Deno.env'den okunur, asla günlüğe/DB'ye yazılmaz. */
  keySecretName: string;
  /** Tokenizer: sağlayıcı sayımı mı, tahmin mi. */
  tokenizer: ModelCapabilities["tokenizer"];
  /** Girdi tokenlarını sayar veya tahmin eder; ücretli üretim yapmaz. */
  countTokens(apiKey: string, cfg: AiConfig, system: string, user: AiUserContent): Promise<number>;
  /** Tek yapılandırılmış çıktı üretimi. Hata kodları classifyAiError ile sınıflandırılır. */
  generate<T>(apiKey: string, cfg: AiConfig, system: string, user: AiUserContent, schema: Record<string, unknown>): Promise<AiResult<T>>;
}

const registry = new Map<AiAdapterId, AiAdapter>();

export function registerAdapter(adapter: AiAdapter): void {
  registry.set(adapter.id, adapter);
}

/** Kayıtlı adapter; yoksa null — çağıran `ai_model_unsupported` döndürür. */
export function adapterFor(id: string | null | undefined): AiAdapter | null {
  return id ? registry.get(id as AiAdapterId) ?? null : null;
}

export function registeredAdapterIds(): AiAdapterId[] {
  return [...registry.keys()];
}

/** Adapter anahtarı: secret adıyla ortamdan; yoksa açık `provider_unconfigured`. */
export function adapterKey(adapter: AiAdapter, env: (name: string) => string | undefined = (n) => Deno.env.get(n)): string {
  const key = env(adapter.keySecretName);
  if (!key) throw new AiProviderError("provider_unconfigured");
  return key;
}

export function providerRecord(provider: AiProviderId) {
  return PROVIDER_DEFAULTS.find((p) => p.id === provider) ?? null;
}

/** Tahmini tokenizer: Türkçe için muhafazakâr ~3 bayt/token; sağlayıcı sayımı yokken kullanılır. */
export function estimateInputTokens(system: string, user: AiUserContent): number {
  const text = system + (typeof user === "string" ? user : JSON.stringify(user));
  return Math.ceil(new TextEncoder().encode(text).length / 3);
}

/** Yapılandırılmış metin çıktısını tek biçimde doğrular: boş/eksik veya bozuk JSON → ai_result_invalid. */
export function parseStructuredText<T>(text: unknown): T {
  if (typeof text !== "string" || !text.trim()) throw new AiProviderError("ai_result_invalid");
  try {
    return JSON.parse(text.replace(/^```json\s*|```\s*$/g, "")) as T;
  } catch {
    throw new AiProviderError("ai_result_invalid");
  }
}

/** Anthropic spend caps may be HTTP 400; billing is HTTP 402. Inspect only known
 * quota markers and never propagate the provider's raw message (which can contain input).
 * Reference: https://platform.claude.com/docs/en/api/errors */
export async function anthropicHttpError(response: Response): Promise<AiProviderError> {
  if (response.status === 402) return new AiProviderError('anthropic_quota');
  if (response.status === 400) {
    try {
      const body = await response.json();
      const error = body?.error;
      const message = typeof error?.message === 'string' ? error.message : '';
      if (error?.type === 'billing_error' || error?.type === 'invalid_request_error' && (
        /^Your credit balance is too low\b/i.test(message) ||
        /^(?:Your (?:organization|workspace) |You |This request )[^.\n]{0,120}(?:hit|reached|exceed|exceeded)[^.\n]{0,80}(?:spend|spending|usage) limit/i.test(message)
      )) return new AiProviderError('anthropic_quota');
    } catch { /* malformed error is still an ordinary rejected request */ }
  }
  return new AiProviderError(`anthropic_${response.status}`);
}
