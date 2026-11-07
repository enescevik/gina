import type { AiConfig, AiResult, AiUserContent } from "./prova.ts";
import { adapterFor, adapterKey, classifyAiError } from "./ai-adapters.ts";
import { AiProviderError } from "./ai-provider.ts";
import { serviceClient } from "./supabase.ts";

export const chainDefaults = {
  rpc: async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await serviceClient().rpc(name, args);
    if (error) throw new Error("chain_journal_unavailable");
    return data;
  },
  adapter: adapterFor,
  key: adapterKey,
  now: () => Date.now(),
};
/** Bounded, sequential, cross-provider fallback. Never retries a useful/refused/invalid result.
 * Quotas are reserved by the caller once. The server fences every attempt against its lease.
 * Each attempt is journaled before the paid call; ambiguous outcomes remain non-retryable jobs. */
export async function runAiChain<T>(
  config: AiConfig,
  system: string,
  user: AiUserContent,
  schema: Record<string, unknown>,
  deps = chainDefaults,
): Promise<AiResult<T>> {
  const chain = config.chain!;
  const run = crypto.randomUUID();
  const deadline = deps.now() + Math.min(130, chain.total_seconds) * 1000;
  let last: unknown = new AiProviderError("ai_model_unsupported");
  let uncertain = false;
  const inputKind = typeof user === "string"
    ? "text"
    : user.some((x) => x.type === "document")
    ? "pdf"
    : user.some((x) => x.type === "image")
    ? "image"
    : "text";
  for (const step of chain.steps.slice(0, 5)) {
    const adapter = deps.adapter(step.config.adapter);
    let key = "";
    let skip: string | null = null;
    if (
      typeof user !== "string" &&
      (user.some((x) => x.type === "document") &&
          !step.config.capabilities?.pdf ||
        user.some((x) => x.type === "image") &&
          !step.config.capabilities?.vision)
    ) skip = "capability_missing";
    if (adapter) {
      try {
        key = deps.key(adapter);
      } catch {
        skip = "key_missing";
      }
    } else skip = "capability_missing";
    const remaining = deadline - deps.now();
    if (remaining < 1000) skip = "time_budget_exhausted";
    const start = await deps.rpc("ai_chain_start_attempt", {
      p_run: run,
      p_chain: chain.id,
      p_usage: chain.usage_key,
      p_plan: chain.plan,
      p_position: step.position,
      p_model: step.config.model,
      p_input_kind: inputKind,
      p_skip: skip,
      p_job_kind: config.execution?.kind ?? null,
      p_job_id: config.execution?.id ?? null,
      p_lease: config.execution?.lease ?? null,
    });
    if (start?.stop) {
      last = new AiProviderError("ai_model_unsupported");
      break;
    }
    if (!start?.id) throw new Error("chain_journal_unavailable");
    if (!start.allowed) continue;
    if (!adapter || !key || skip) {
      throw new Error("chain_configuration_changed");
    }
    const controller = new AbortController();
    const timer = setTimeout(
      () =>
        controller.abort(new DOMException("Attempt timed out", "TimeoutError")),
      Math.min(remaining, chain.attempt_seconds * 1000),
    );
    let result: AiResult<T>;
    try {
      result = await adapter.generate<T>(
        key,
        {
          ...step.config,
          promptVersion: config.promptVersion,
          signal: controller.signal,
        },
        system,
        user,
        schema,
      );
    } catch (e) {
      const failure = classifyAiError(e);
      uncertain ||= failure.uncertain;
      // If the journal fails after a provider call, stop; never charge another provider blindly.
      await deps.rpc("ai_chain_finish_attempt", {
        p_id: start.id,
        p_ok: false,
        p_error: failure.code,
        p_uncertain: failure.uncertain,
        ...(e instanceof AiProviderError && e.billing ? { p_input: e.billing.inputTokens, p_output: e.billing.outputTokens } : {}),
      });
      last = e;
      const advance = failure.kind === "rate_limited" && chain.on_rate_limit ||
        failure.kind === "server" && chain.on_server_error ||
        (failure.kind === "timeout" || failure.kind === "network") &&
          chain.on_timeout;
      if (!advance) break;
      continue;
    } finally {
      clearTimeout(timer);
    }
    await deps.rpc("ai_chain_finish_attempt", {
      p_id: start.id,
      p_ok: true,
      p_input: result.inputTokens,
      p_output: result.outputTokens,
    });
    return {
      ...result,
      model: step.config.model,
      provider: step.config.provider,
      chainRunId: run,
    };
  }
  // A later definite rejection must not turn an earlier ambiguous charge into a retryable job.
  if (uncertain) throw new AiProviderError("provider_outcome_unknown", last instanceof AiProviderError ? last.billing : undefined);
  throw last;
}
