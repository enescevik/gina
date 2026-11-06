// C08 — çözülmüş sağlayıcı/model ile tek üretim. Uç noktalar Anthropic'e özel `callClaude` yerine bunu çağırır:
// resolveAi çıktısındaki adapter seçilir (kayıtlı değilse `ai_model_unsupported`, ücretli çağrı yok).
// Hiçbir yol otomatik ikinci ücretli çağrı veya başka sağlayıcıya fallback yapmaz.
import type { AiConfig, AiResult, AiUserContent } from "./prova.ts";
import { adapterFor } from "./ai-adapters.ts";
import { AiProviderError } from "./ai-provider.ts";

export function generateWith<T>(
  apiKey: string,
  config: AiConfig,
  system: string,
  user: AiUserContent,
  schema: Record<string, unknown>,
): Promise<AiResult<T>> {
  const adapter = adapterFor(config.adapter ?? "anthropic-messages");
  if (!adapter) return Promise.reject(new AiProviderError("ai_model_unsupported"));
  return adapter.generate<T>(apiKey, config, system, user, schema);
}

export { classifyAiError } from "./ai-adapters.ts";
