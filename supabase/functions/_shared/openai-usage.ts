/** Billing counters are separate from total context usage. Missing cache data is
 * unknown, not zero; reasoning tokens are already included in completion tokens. */
export function openAiUsage(value: unknown, requestId: string | null, tier: unknown) {
  const u = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const n = (v: unknown): number | null => Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : null;
  const details = u.prompt_tokens_details && typeof u.prompt_tokens_details === "object"
    ? u.prompt_tokens_details as Record<string, unknown> : {};
  const completion = u.completion_tokens_details && typeof u.completion_tokens_details === "object"
    ? u.completion_tokens_details as Record<string, unknown> : {};
  const total = n(u.prompt_tokens), cached = n(details.cached_tokens);
  const validCache = total !== null && cached !== null && cached <= total;
  return {
    input_tokens: validCache ? total - cached : null,
    output_tokens: n(u.completion_tokens),
    cache_read_input_tokens: validCache ? cached : null,
    cache_creation_input_tokens: 0,
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
    prompt_tokens_total: total,
    reasoning_tokens: n(completion.reasoning_tokens),
    service_tier: tier === "default" || tier === "standard" ? "standard" : null,
    request_id: requestId,
  };
}
