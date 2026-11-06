import { runAiChain } from "./ai-chain.ts";
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
  if (config.chain) return runAiChain<T>(config, system, user, schema);
  const adapter = adapterFor(config.adapter ?? "anthropic-messages");
  if (!adapter) return Promise.reject(new AiProviderError("ai_model_unsupported"));
  return adapter.generate<T>(apiKey, config, system, user, schema);
}

export { classifyAiError } from "./ai-adapters.ts";
