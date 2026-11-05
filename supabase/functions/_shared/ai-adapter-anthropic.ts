// Anthropic Messages adapteri: mevcut callClaude davranışı değişmeden ortak arayüze sarılır.
// Token sayımı sağlayıcı tokenizer'ı ile (count_tokens); üretim tek POST; otomatik tekrar yok.
import { type AiConfig, type AiResult, type AiUserContent, callClaude } from "./prova.ts";
import { type AiAdapter, AiProviderError, registerAdapter } from "./ai-provider.ts";

export const anthropicAdapter: AiAdapter = {
  id: "anthropic-messages",
  provider: "anthropic",
  keySecretName: "ANTHROPIC_API_KEY",
  tokenizer: "provider_count",
  async countTokens(apiKey: string, cfg: AiConfig, system: string, user: AiUserContent): Promise<number> {
    const res = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: cfg.model, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new AiProviderError(`anthropic_${res.status}`);
    const tokens = (await res.json()).input_tokens;
    if (!Number.isInteger(tokens) || tokens < 0) throw new AiProviderError("ai_token_count_invalid");
    return tokens;
  },
  generate<T>(apiKey: string, cfg: AiConfig, system: string, user: AiUserContent, schema: Record<string, unknown>): Promise<AiResult<T>> {
    return callClaude<T>(apiKey, cfg, system, user, schema);
  },
};

registerAdapter(anthropicAdapter);
