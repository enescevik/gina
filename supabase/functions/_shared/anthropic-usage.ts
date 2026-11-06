/** Whitelist numerical billing fields; never persist arbitrary provider content.
 * Missing fields remain null: an old/unreported counter is not known zero. */
export function anthropicUsage(value: unknown, requestId: string | null) {
  const u = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const n = (x: unknown): number | null => Number.isSafeInteger(x) && Number(x) >= 0 ? Number(x) : null;
  const cache = u.cache_creation && typeof u.cache_creation === 'object' ? u.cache_creation as Record<string, unknown> : {};
  return {
    input_tokens: n(u.input_tokens), output_tokens: n(u.output_tokens),
    cache_creation_input_tokens: n(u.cache_creation_input_tokens),
    cache_read_input_tokens: n(u.cache_read_input_tokens),
    cache_creation: { ephemeral_5m_input_tokens: n(cache.ephemeral_5m_input_tokens), ephemeral_1h_input_tokens: n(cache.ephemeral_1h_input_tokens) },
    service_tier: typeof u.service_tier === 'string' && ['standard','priority','batch'].includes(u.service_tier) ? u.service_tier : null,
    request_id: requestId,
  };
}
