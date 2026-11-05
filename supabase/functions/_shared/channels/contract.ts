// S02 channel adapter contract. One recipient per call; secrets are env names only; the result of a
// send is a provider *acceptance* receipt — never "delivered" or "read". No personal data is logged.

export type Channel = "email" | "sms";

export interface OutboundEmail {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  /** e.g. List-Unsubscribe / List-Unsubscribe-Post for announcement and marketing mail. */
  headers?: Record<string, string>;
  /** Stable per outbox row: a retry after a lost reply must not create a second provider message. */
  idempotencyKey: string;
}

export interface OutboundSms {
  to: string;
  from: string;
  text: string;
  idempotencyKey: string;
}

/** `ok` = the provider accepted the message. Acceptance is not delivery; delivery is not reading. */
export type AdapterResult =
  | { ok: true; providerMessageId: string | null; acceptedAt: string }
  | { ok: false; retry: boolean; error: string; retryAfterSeconds?: number };

export interface EmailAdapter {
  readonly provider: string;
  send(message: OutboundEmail): Promise<AdapterResult>;
}
export interface SmsAdapter {
  readonly provider: string;
  send(message: OutboundSms): Promise<AdapterResult>;
}

/** Factory outcome: either an adapter or the list of missing configuration names (never values). */
export type AdapterSetup<A> = { adapter: A; missing: [] } | {
  adapter: null;
  missing: string[];
};

export const PROVIDER_ACCEPTANCE_NOTE =
  "provider acceptance is not delivery or read";
export const DEFAULT_TIMEOUT_MS = 15000;
export const MAX_ERROR_LENGTH = 160;

/** Reads Retry-After (seconds or HTTP date) clamped to 1 s – 24 h. */
export function retryAfterSeconds(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = /^\d+$/.test(header)
    ? Number(header)
    : (Date.parse(header) - Date.now()) / 1000;
  return Number.isFinite(seconds)
    ? Math.max(1, Math.min(86400, Math.ceil(seconds)))
    : undefined;
}

/** Maps an HTTP status to the shared retry policy: 408/425/429/5xx retry, other 4xx are permanent. */
export function httpFailure(
  provider: string,
  response: Response,
  code?: string,
): AdapterResult {
  const status = response.status;
  const retry = status === 408 || status === 425 || status === 429 ||
    status >= 500;
  const delay = retryAfterSeconds(response);
  return {
    ok: false,
    retry,
    error: `${provider}:http_${status}${code ? ":" + code : ""}`.slice(
      0,
      MAX_ERROR_LENGTH,
    ),
    ...(delay ? { retryAfterSeconds: delay } : {}),
  };
}

export function networkFailure(provider: string, reason: unknown): AdapterResult {
  // No URL, address or payload echo: only a coarse reason survives into the outbox.
  const timeout = reason instanceof Error &&
    (reason.name === "TimeoutError" || reason.name === "AbortError");
  return {
    ok: false,
    retry: true,
    error: `${provider}:${timeout ? "timeout" : "network_error"}`,
  };
}

/** Narrow env reader so tests inject a plain object; production passes Deno.env. */
export interface EnvReader {
  get(name: string): string | undefined;
}
export function requireEnv(
  env: EnvReader,
  names: string[],
): { values: Record<string, string>; missing: string[] } {
  const values: Record<string, string> = {}, missing: string[] = [];
  for (const name of names) {
    const value = env.get(name)?.trim();
    if (value) values[name] = value;
    else missing.push(name);
  }
  return { values, missing };
}
