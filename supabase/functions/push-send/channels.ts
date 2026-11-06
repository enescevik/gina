// Email/SMS drain, sharing the push-send tick. Each row: claim (lease) → render → adapter → durable
// receipt. A missing adapter records `unconfigured` (terminal, visible), never a silent retry loop.
import type { AdapterSetup, EmailAdapter, SmsAdapter } from "../_shared/channels/contract.ts";
import { type ChannelRow, renderEmail, RenderError, type RenderOptions, renderSms } from "../_shared/channels/render.ts";

export type ChannelOutcome = "accepted" | "retry" | "failed" | "unconfigured";

export interface ChannelDependencies {
  claim(limit: number): Promise<ChannelRow[]>;
  emailFor(provider: string | null): AdapterSetup<EmailAdapter>;
  smsFor(provider: string | null): AdapterSetup<SmsAdapter>;
  record(
    row: ChannelRow,
    status: ChannelOutcome,
    provider: string | null,
    providerMessageId: string | null,
    error: string | null,
    retryAfterSeconds?: number,
  ): Promise<void>;
  render: RenderOptions;
  now?: () => number;
  budgetMs?: number;
  /** Pause between receipt attempts (tests pass 0). */
  receiptRetryDelayMs?: number;
}

/**
 * A receipt is idempotent in the DB (an accepted row replays as true). A transient storage error right
 * after a provider accepted the message would otherwise leave the row leased and, after the lease
 * expires, claimable again: a second copy. Retry the receipt briefly before giving up.
 */
async function recordDurably(d: ChannelDependencies, ...args: Parameters<ChannelDependencies["record"]>) {
  const delay = d.receiptRetryDelayMs ?? 250;
  for (let attempt = 1; ; attempt++) {
    try {
      return await d.record(...args);
    } catch (reason) {
      if (attempt >= 3) throw reason;
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }
}

export interface ChannelCounts extends Record<string, number> {
  claimed: number;
  accepted: number;
  retry: number;
  failed: number;
  unconfigured: number;
}

/** Missing pieces the worker can see for a channel; merged into the DB readiness report. */
export function workerMissing(
  channel: "email" | "sms",
  setup: AdapterSetup<EmailAdapter> | AdapterSetup<SmsAdapter>,
  render: RenderOptions,
): string[] {
  const missing = [...setup.missing];
  if (!render.unsubscribeUrl) missing.push("unsubscribe_url_missing");
  if (channel === "email" && !setup.adapter && missing.length === 0) missing.push("provider_not_configured");
  return missing;
}

export async function drainChannels(d: ChannelDependencies): Promise<ChannelCounts> {
  const now = d.now ?? Date.now, started = now(), budget = d.budgetMs ?? 45000;
  const counts: ChannelCounts = { claimed: 0, accepted: 0, retry: 0, failed: 0, unconfigured: 0 };
  while (counts.claimed < 50 && now() - started < budget) {
    const rows = await d.claim(5);
    if (!rows.length) break;
    for (const row of rows) {
      counts.claimed++;
      let status: ChannelOutcome, provider: string | null = row.provider, messageId: string | null = null, error: string | null = null, retryAfter: number | undefined;
      const setup = row.channel === "email" ? d.emailFor(row.provider) : d.smsFor(row.provider);
      if (!setup.adapter) {
        status = "unconfigured";
        error = `provider_unconfigured:${setup.missing.join(",")}`.slice(0, 160);
      } else {
        provider = setup.adapter.provider;
        try {
          const result = row.channel === "email"
            ? await (setup.adapter as EmailAdapter).send(renderEmail(row, d.render))
            : await (setup.adapter as SmsAdapter).send(renderSms(row, d.render));
          if (result.ok) {
            status = "accepted";
            messageId = result.providerMessageId;
          } else {
            status = result.retry ? "retry" : "failed";
            error = result.error.slice(0, 160);
            retryAfter = result.retryAfterSeconds;
          }
        } catch (reason) {
          // Rendering problems are configuration, not provider failures: visible, not retried forever.
          if (reason instanceof RenderError) {
            status = "unconfigured";
            error = reason.reason;
          } else {
            status = "retry";
            error = "adapter_exception";
          }
        }
      }
      counts[status]++;
      // The receipt must be durable before the next row; a failing receipt stops the worker.
      await recordDurably(d, row, status, provider, messageId, error, retryAfter);
      if (now() - started >= budget) break;
    }
  }
  return counts;
}
