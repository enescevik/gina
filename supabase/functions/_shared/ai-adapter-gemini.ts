// Google Gemini generateContent adapter İSKELETİ (X04 bekliyor: gerçek hesap/anahtar yok).
// Anahtar yalnız secret adıyla (GEMINI_API_KEY) ortamdan okunur; yoksa provider_unconfigured.
// Yapılandırılmış çıktı: responseMimeType application/json + responseSchema. Token sayımı: countTokens ucu.
// Görsel/PDF: inlineData. Tek POST, otomatik tekrar yok. Anahtar başlıkta gönderilir, URL'de değil.
import type { AiConfig, AiResult, AiUserContent } from "./prova.ts";
import { type AiAdapter, AiProviderError, parseStructuredText, registerAdapter } from "./ai-provider.ts";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export function toGeminiParts(user: AiUserContent): unknown[] {
  if (typeof user === "string") return [{ text: user }];
  return user.map((part) =>
    part.type === "text" ? { text: part.text } : { inlineData: { mimeType: part.source.media_type, data: part.source.data } }
  );
}

/** Gemini responseSchema `additionalProperties`/`$schema` gibi JSON Schema anahtarlarını kabul etmez. */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== "object") return schema;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k === "additionalProperties" || k === "$schema" || k === "default") continue;
    out[k] = toGeminiSchema(v);
  }
  return out;
}

export const geminiAdapter: AiAdapter = {
  id: "gemini-generate",
  provider: "gemini",
  keySecretName: "GEMINI_API_KEY",
  tokenizer: "provider_count",
  async countTokens(apiKey: string, cfg: AiConfig, system: string, user: AiUserContent): Promise<number> {
    if (!apiKey) throw new AiProviderError("provider_unconfigured");
    const res = await fetch(`${BASE_URL}/models/${encodeURIComponent(cfg.model)}:countTokens`, {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: system }, ...toGeminiParts(user)] }] }),
    });
    if (!res.ok) throw new AiProviderError(`gemini_${res.status}`);
    const tokens = (await res.json()).totalTokens;
    if (!Number.isInteger(tokens) || tokens < 0) throw new AiProviderError("ai_token_count_invalid");
    return tokens;
  },
  async generate<T>(apiKey: string, cfg: AiConfig, system: string, user: AiUserContent, schema: Record<string, unknown>): Promise<AiResult<T>> {
    if (!apiKey) throw new AiProviderError("provider_unconfigured");
    const tokens = await this.countTokens(apiKey, cfg, system, user);
    if (tokens > (cfg.maxInputTokens ?? 8000)) throw new AiProviderError("ai_input_too_large");
    const res = await fetch(`${BASE_URL}/models/${encodeURIComponent(cfg.model)}:generateContent`, {
      method: "POST",
      signal: AbortSignal.timeout(115_000),
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: toGeminiParts(user) }],
        generationConfig: { maxOutputTokens: cfg.maxOutputTokens, responseMimeType: "application/json", responseSchema: toGeminiSchema(schema) },
      }),
    });
    if (!res.ok) throw new AiProviderError(`gemini_${res.status}`);
    const data = await res.json();
    const candidate = Array.isArray(data.candidates) ? data.candidates[0] : null;
    if (data.promptFeedback?.blockReason || candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") {
      throw new AiProviderError("gemini_refusal");
    }
    if (!candidate) throw new AiProviderError("ai_result_invalid");
    if (candidate.finishReason === "MAX_TOKENS") throw new AiProviderError("gemini_max_tokens");
    const text = (Array.isArray(candidate.content?.parts) ? candidate.content.parts : [])
      .map((p: { text?: unknown }) => (typeof p?.text === "string" ? p.text : ""))
      .join("");
    return {
      output: parseStructuredText<T>(text),
      inputTokens: Number.isInteger(data.usageMetadata?.promptTokenCount) ? data.usageMetadata.promptTokenCount : null,
      outputTokens: Number.isInteger(data.usageMetadata?.candidatesTokenCount) ? data.usageMetadata.candidatesTokenCount : null,
    };
  },
};

registerAdapter(geminiAdapter);
