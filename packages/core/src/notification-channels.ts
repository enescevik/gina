import { z } from "zod";

// S02 notification channels: shared types for clients. Rules mirrored from
// supabase/migrations/20261106080000_notification_channels.sql — having an address is not consent;
// email/SMS deliver only to a verified address with an explicit per-purpose preference; provider
// acceptance is never "delivered" or "read".

export const notificationChannel = z.enum(["in_app", "push", "email", "sms"]);
export type NotificationChannel = z.infer<typeof notificationChannel>;
export const notificationPurpose = z.enum(["service", "announcement", "marketing"]);
export type NotificationPurpose = z.infer<typeof notificationPurpose>;
export const contactKind = z.enum(["email", "sms"]);
export type ContactKind = z.infer<typeof contactKind>;

export const channelOutboxStatus = z.enum(["pending", "sending", "accepted", "failed", "skipped"]);
export type ChannelOutboxStatus = z.infer<typeof channelOutboxStatus>;
export const PROVIDER_ACCEPTANCE_NOTE = "provider acceptance is not delivery or read";

/** Skip reasons recorded at enqueue or claim time; every skipped channel send carries one. */
export const channelSkipReason = z.enum([
  "channel_unsupported",
  "channel_not_ready",
  "marketing_legal_review_pending",
  "not_a_parent",
  "address_unverified",
  "address_revoked",
  "preference_off",
  "no_active_session",
  "announcement_not_current",
  "announcement_withdrawn",
  "verification_superseded",
  "verification_consumed",
  "verification_expired",
  "secret_scrubbed",
  "provider_unconfigured",
]);
export type ChannelSkipReason = z.infer<typeof channelSkipReason>;

/** Default when the parent has no explicit preference row (push announcement comes from push_preferences). */
export function channelDefault(channel: NotificationChannel, purpose: NotificationPurpose): boolean {
  if (purpose === "marketing") return false;
  if (purpose === "service") return true;
  return channel === "in_app" || channel === "push";
}

export const channelReadiness = z.object({
  ready: z.boolean(),
  missing: z.array(z.string()),
  provider: z.string().nullable().optional(),
  reported_at: z.string().nullable().optional(),
});
export const readinessMatrix = z.object({
  in_app: channelReadiness,
  push: channelReadiness,
  email: channelReadiness,
  sms: channelReadiness,
  marketing: z.object({ allowed: z.boolean(), missing: z.array(z.string()) }),
  note: z.string(),
});
export type ReadinessMatrix = z.infer<typeof readinessMatrix>;

export const myNotificationChannels = z.object({
  contacts: z.array(z.object({ kind: contactKind, masked: z.string(), verified_at: z.string() })),
  pending: z.array(z.object({ kind: contactKind, masked: z.string(), expires_at: z.string() })),
  preferences: z.record(notificationChannel, z.record(notificationPurpose, z.boolean())),
  effective: z.record(contactKind, z.record(notificationPurpose, z.string())),
  readiness: z.record(notificationChannel, z.boolean()),
});
export type MyNotificationChannels = z.infer<typeof myNotificationChannels>;

export const contactVerificationRequest = z.object({
  kind: contactKind,
  status: z.enum(["pending", "already_verified"]),
  masked: z.string().optional(),
  expires_at: z.string().optional(),
});
export const contactVerificationConfirm = z.union([
  z.object({ status: z.literal("verified"), kind: contactKind, masked: z.string() }),
  z.object({ status: z.literal("invalid"), remaining: z.number().int().min(0).max(5) }),
]);

/** Normalizes user input the same way the server does before validation. */
export function normalizeContact(kind: ContactKind, value: string): string {
  return kind === "email" ? value.trim().toLowerCase() : value.trim().replace(/[\s().-]/g, "");
}
export function contactLooksValid(kind: ContactKind, value: string): boolean {
  const v = normalizeContact(kind, value);
  return kind === "email" ? /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) && v.length <= 254 : /^\+[1-9][0-9]{7,14}$/.test(v);
}
