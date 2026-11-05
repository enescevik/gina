// OpenAI-uyumlu Chat Completions adapter İSKELETİ (X04 bekliyor: gerçek hesap/anahtar yok).
// Anahtar yalnız secret adıyla (OPENAI_API_KEY) ortamdan okunur; yoksa provider_unconfigured.
// Yapılandırılmış çıktı: response_format json_schema (strict). Tokenizer: tahmin (sağlayıcı sayım ucu yok).
// Girdi görsel/PDF: image_url data URL; PDF `file` içerik parçası. Tek POST, otomatik tekrar yok.
import type { AiConfig, AiResult, AiUserContent } from "./prova.ts";
import { type AiAdapter, AiProviderError, estimateInputTokens, parseStructuredText, registerAdapter } from "./ai-provider.ts";

export const OPENAI_BASE_URL_ENV = "OPENAI_BASE_URL";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function baseUrl(): string {
  let configured: string | undefined;
  try {
    configured = Deno.env.get(OPENAI_BASE_URL_ENV);
  } catch {
    configured = undefined; // env izni yoksa (test) varsayılan uç
  }
  return (configured && /^https:\/\//.test(configured) ? configured : DEFAULT_BASE_URL).replace(/\/$/, "");
}

export function toOpenAiContent(user: AiUserContent): unknown {
  if (typeof user === "string") return user;
  return user.map((part) => {
    if (part.type === "text") return { type: "text", text: part.text };
    if (part.type === "image") {
      return { type: "image_url", image_url: { url: `data:${part.source.media_type};base64,${part.source.data}` } };
    }
    return { type: "file", file: { filename: "document.pdf", file_data: `data:application/pdf;base64,${part.source.data}` } };
  });
}

export const openAiAdapter: AiAdapter = {
  id: "openai-chat",
  provider: "openai_compatible",
  keySecretName: "OPENAI_API_KEY",
  tokenizer: "estimate",
  countTokens(_apiKey: string, _cfg: AiConfig, system: string, user: AiUserContent): Promise<number> {
    return Promise.resolve(estimateInputTokens(system, user));
  },
  async generate<T>(apiKey: string, cfg: AiConfig, system: string, user: AiUserContent, schema: Record<string, unknown>): Promise<AiResult<T>> {
    if (!apiKey) throw new AiProviderError("provider_unconfigured");
    const estimated = estimateInputTokens(system, user);
    if (estimated > (cfg.maxInputTokens ?? 8000)) throw new AiProviderError("ai_input_too_large");
    const res = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(115_000),
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        max_completion_tokens: cfg.maxOutputTokens,
        messages: [{ role: "system", content: system }, { role: "user", content: toOpenAiContent(user) }],
        response_format: { type: "json_schema", json_schema: { name: "gina_output", strict: true, schema } },
      }),
    });
    if (!res.ok) throw new AiProviderError(`openai_${res.status}`);
    const data = await res.json();
    const choice = Array.isArray(data.choices) ? data.choices[0] : null;
    if (!choice) throw new AiProviderError("ai_result_invalid");
    if (choice.message?.refusal) throw new AiProviderError("openai_refusal");
    if (choice.finish_reason === "length") throw new AiProviderError("openai_max_tokens");
    if (choice.finish_reason === "content_filter") throw new AiProviderError("openai_refusal");
    return {
      output: parseStructuredText<T>(choice.message?.content),
      inputTokens: Number.isInteger(data.usage?.prompt_tokens) ? data.usage.prompt_tokens : null,
      outputTokens: Number.isInteger(data.usage?.completion_tokens) ? data.usage.completion_tokens : null,
    };
  },
};

registerAdapter(openAiAdapter);
