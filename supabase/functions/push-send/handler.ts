import { messageFor } from "./messages.ts";
import type { PushMessage, SendResult } from "./providers.ts";
export interface PushRow {
  id: number;
  lease_id: string;
  kind: string;
  payload: Record<string, unknown>;
}
export interface PushTarget {
  token_id: string;
  token: string;
  token_type: "apns" | "fcm";
  locale: "tr" | "en";
  token_hash: string;
}
export type DeliveryStatus =
  | "sent"
  | "retry"
  | "failed"
  | "gone"
  | "unconfigured";
export interface PushDependencies {
  claim(): Promise<PushRow[]>;
  targets(row: PushRow): Promise<PushTarget[]>;
  configured(target: PushTarget): boolean;
  send(target: PushTarget, message: PushMessage): Promise<SendResult>;
  record(
    row: PushRow,
    target: PushTarget,
    status: DeliveryStatus,
    error: string | null,
    retryAfterSeconds?: number,
  ): Promise<void>;
  finish(row: PushRow): Promise<string>;
  now?: () => number;
}
/** Each device acknowledgement is durable before advancing; a failed record stops the worker. */
export async function drainPush(d: PushDependencies) {
  const now = d.now ?? Date.now, started = now();
  const counts: Record<string, number> = {
    claimed: 0,
    accepted: 0,
    retry: 0,
    failed: 0,
    unconfigured: 0,
  };
  while (counts.claimed < 10 && now() - started < 45000) {
    const [row] = await d.claim();
    if (!row) break;
    counts.claimed++;
    const seen = new Set<string>();
    while (now() - started < 45000) {
      // Re-read live membership/preference/publication and current lease before each device send.
      const target = (await d.targets(row)).find((t) => !seen.has(t.token_id));
      if (!target) break;
      seen.add(target.token_id);
      let status: DeliveryStatus,
        error: string | null = null,
        retryAfter: number | undefined;
      if (!d.configured(target)) {
        status = "unconfigured";
        error = "provider_not_configured";
        counts.unconfigured++;
      } else {
        let result: SendResult;
        try {
          result = await d.send(
            target,
            messageFor(row, target.locale === "en" ? "en" : "tr"),
          );
        } catch {
          result = {
            ok: false,
            gone: false,
            retry: true,
            error: "provider_network_error",
          };
        }
        status = result.ok
          ? "sent"
          : result.gone
          ? "gone"
          : result.retry
          ? "retry"
          : "failed";
        error = result.ok ? null : result.error.slice(0, 160);
        retryAfter = result.ok ? undefined : result.retryAfterSeconds;
        counts[
          result.ok ? "accepted" : status === "retry" ? "retry" : "failed"
        ]++;
      }
      await d.record(row, target, status, error, retryAfter);
    }
    await d.finish(row);
  }
  return counts;
}
