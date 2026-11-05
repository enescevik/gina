// SMS adapter: one generic HTTPS JSON skeleton. A Turkish provider (and İYS obligations for
// marketing) is selected later; until then the contract is exercised against a fake server only.
import {
  type AdapterSetup,
  DEFAULT_TIMEOUT_MS,
  type EnvReader,
  httpFailure,
  networkFailure,
  type OutboundSms,
  requireEnv,
  type SmsAdapter,
} from "./contract.ts";

export interface HttpSmsConfig {
  endpoint: string;
  apiKey: string;
  timeoutMs?: number;
}

/** POST {to, from, text, reference}; 2xx with {id|message_id|messageId} is acceptance. */
export function httpSmsAdapter(cfg: HttpSmsConfig): SmsAdapter {
  const timeout = cfg.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    provider: "http",
    async send(message) {
      try {
        const res = await fetch(cfg.endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(timeout),
          headers: {
            authorization: `Bearer ${cfg.apiKey}`,
            "content-type": "application/json",
            "idempotency-key": message.idempotencyKey,
          },
          body: JSON.stringify({
            to: message.to,
            from: message.from,
            text: message.text,
            reference: message.idempotencyKey,
          }),
        });
        if (res.ok) {
          const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          const id = [body.id, body.message_id, body.messageId].find((v) => typeof v === "string") as string | undefined;
          return { ok: true, providerMessageId: id ? id.slice(0, 200) : null, acceptedAt: new Date().toISOString() };
        }
        const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
        const code = [body.code, body.error].find((v) => typeof v === "string") as string | undefined;
        return httpFailure("sms", res, code?.slice(0, 40));
      } catch (reason) {
        return networkFailure("sms", reason);
      }
    },
  };
}

export function smsAdapterFromEnv(
  provider: string | null,
  env: EnvReader,
  options: { timeoutMs?: number } = {},
): AdapterSetup<SmsAdapter> {
  if (provider === "http") {
    const { values, missing } = requireEnv(env, ["SMS_API_URL", "SMS_API_KEY"]);
    if (missing.length) return { adapter: null, missing };
    return { adapter: httpSmsAdapter({ endpoint: values.SMS_API_URL, apiKey: values.SMS_API_KEY, timeoutMs: options.timeoutMs }), missing: [] };
  }
  return { adapter: null, missing: [provider ? `provider_unknown:${provider}` : "provider_not_selected"] };
}
