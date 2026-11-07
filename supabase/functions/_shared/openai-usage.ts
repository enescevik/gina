/** Billing categories partition prompt tokens. Cache writes are priced at their
 * total write rate, not also at ordinary-input rates. Missing counters stay
 * unknown; reasoning tokens are already included in completion tokens.
 * These callers omit prompt_cache_options, whose API default is 30 minutes. */
export function openAiUsage(value: unknown, requestId: string | null, tier: unknown) {
  const u = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const n = (v: unknown): number | null => Number.isSafeInteger(v) && Number(v) >= 0 ? Number(v) : null;
  const details = u.prompt_tokens_details && typeof u.prompt_tokens_details === "object"
    ? u.prompt_tokens_details as Record<string, unknown> : {};
  const completion = u.completion_tokens_details && typeof u.completion_tokens_details === "object"
    ? u.completion_tokens_details as Record<string, unknown> : {};
  const total = n(u.prompt_tokens), cached = n(details.cached_tokens), writes = n(details.cache_write_tokens);
  const valid = total !== null && cached !== null && writes !== null && cached + writes <= total;
  const lifetimes = details.cache_write_tokens_details;
  const lifetimesPresent = lifetimes !== null && typeof lifetimes === "object";
  const breakdown = lifetimesPresent ? lifetimes as Record<string, unknown> : {};
  const short = lifetimesPresent ? n(breakdown.ttl_30m_tokens) : writes;
  const long = lifetimesPresent ? n(breakdown.ttl_12h_tokens) : 0;
  const validLifetimes = writes !== null && short !== null && long !== null && short + long === writes;
  return {
    input_tokens: valid ? total - cached - writes : null,
    output_tokens: n(u.completion_tokens),
    cache_read_input_tokens: valid ? cached : null,
    cache_creation_input_tokens: valid ? writes : null,
    // Anthropic-specific duration buckets do not apply to OpenAI.
    cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
    cache_write_tokens: valid ? writes : null,
    cache_write_tokens_details: {
      ttl_30m_tokens: valid && validLifetimes ? short : null,
      ttl_12h_tokens: valid && validLifetimes ? long : null,
    },
    prompt_tokens_total: total,
    reasoning_tokens: n(completion.reasoning_tokens),
    service_tier: tier === "default" || tier === "standard" ? "standard" : null,
    request_id: requestId,
  };
}
