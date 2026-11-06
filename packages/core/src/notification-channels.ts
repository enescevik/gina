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
  "duplicate_recipient",
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

const verificationLimit = z.object({
  requests_left: z.number().int().min(0),
  last_requested_at: z.string().nullable(),
  next_request_at: z.string().nullable(),
});
export type VerificationLimit = z.infer<typeof verificationLimit>;
export const consentEntry = z.object({
  channel: notificationChannel,
  purpose: notificationPurpose,
  enabled: z.boolean(),
  source: z.enum(["user", "unsubscribe_link"]),
  at: z.string(),
});
export type ConsentEntry = z.infer<typeof consentEntry>;

export const myNotificationChannels = z.object({
  contacts: z.array(z.object({ kind: contactKind, masked: z.string(), verified_at: z.string() })),
  pending: z.array(z.object({
    kind: contactKind,
    masked: z.string(),
    expires_at: z.string(),
    // C10 (20261106300000): optional so an older server still parses.
    created_at: z.string().optional(),
    attempts_left: z.number().int().min(0).max(5).optional(),
  })),
  preferences: z.record(notificationChannel, z.record(notificationPurpose, z.boolean())),
  effective: z.record(contactKind, z.record(notificationPurpose, z.string())),
  readiness: z.record(notificationChannel, z.boolean()),
  marketing_allowed: z.boolean().optional(),
  limits: z.record(contactKind, verificationLimit).optional(),
  consent_history: z.array(consentEntry).optional(),
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

// C10 — client rules for the parent channel screens (server stays the authority) ---------------------

/** Soft client cooldown between verification requests; the server limit is 3 per hour per kind. */
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
/** Bump when the consent wording shown to parents changes; the server records the same value. */
export const CHANNEL_CONSENT_VERSION = "channels-2026-11-06";

/** Seconds until another verification code may be requested (0 = now). */
export function resendWaitSeconds(limit: VerificationLimit | undefined, now: number = Date.now()): number {
  if (!limit) return 0;
  const waits = [0];
  if (limit.last_requested_at) waits.push(Date.parse(limit.last_requested_at) + VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000 - now);
  if (limit.requests_left <= 0 && limit.next_request_at) waits.push(Date.parse(limit.next_request_at) - now);
  return Math.max(0, Math.ceil(Math.max(...waits.filter(Number.isFinite)) / 1000));
}

/** Code shape per kind: email 8 letters/digits, SMS 6 digits. Spaces/dashes from copy-paste are removed. */
export function normalizeVerificationCode(kind: ContactKind, value: string): string | null {
  const v = value.replace(/[\s-]/g, "").toUpperCase();
  if (kind === "email") return /^[A-Z0-9]{8}$/.test(v) ? v : null;
  return /^[0-9]{6}$/.test(v) ? v : null;
}

/**
 * Reads the verification deep link (`/verify-contact?kind=email&code=…`). Returns null for anything
 * malformed so a crafted link cannot inject arbitrary text into the form.
 */
export function parseVerificationLink(params: { kind?: string | string[]; code?: string | string[] }): { kind: ContactKind; code: string } | null {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const kindValue = first(params.kind) || "email";
  const parsed = contactKind.safeParse(kindValue);
  if (!parsed.success) return null;
  const code = normalizeVerificationCode(parsed.data, first(params.code));
  return code ? { kind: parsed.data, code } : null;
}

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/** Base64url → ASCII text (token bodies are ASCII); null for anything else. No DOM/Node globals. */
function base64UrlAscii(input: string): string | null {
  let bits = 0, value = 0, out = "";
  for (const ch of input) {
    const n = B64URL.indexOf(ch);
    if (n < 0) return null;
    value = (value << 6) | n;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      const code = (value >> bits) & 0xff;
      if (code < 0x20 || code > 0x7e) return null;
      out += String.fromCharCode(code);
    }
  }
  return out;
}

export const UNSUBSCRIBE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}\.[a-f0-9]{40}$/;
/**
 * Display-only decoding of an unsubscribe link (channel, purpose, expiry). The signature is NOT checked
 * here — the server verifies it when the button is pressed. Never shows the user id inside the token.
 */
export function describeUnsubscribeToken(token: string, now: number = Date.now()): { channel: ContactKind; purpose: "announcement" | "marketing"; expired: boolean } | null {
  if (!UNSUBSCRIBE_TOKEN_PATTERN.test(token)) return null;
  try {
    const body = base64UrlAscii(token.slice(0, token.indexOf(".")));
    if (body === null) return null;
    const [, channel, purpose, exp] = body.split(":");
    const kind = contactKind.safeParse(channel);
    if (!kind.success || (purpose !== "announcement" && purpose !== "marketing") || !/^\d{9,11}$/.test(exp ?? "")) return null;
    return { channel: kind.data, purpose, expired: Number(exp) * 1000 < now };
  } catch {
    return null;
  }
}

export type PreferenceCell =
  | { state: "editable"; value: boolean; note?: "channel_not_ready" }
  | { state: "locked"; value: boolean; reason: "required" | "address_unverified" | "marketing_legal_review_pending" | "push_settings" };

/** What the channel × purpose matrix may offer for one cell. Push is managed by the phone permission section. */
export function preferenceCell(view: MyNotificationChannels, channel: NotificationChannel, purpose: NotificationPurpose): PreferenceCell {
  const value = view.preferences[channel]?.[purpose] ?? channelDefault(channel, purpose);
  if (purpose === "marketing" && !view.marketing_allowed) return { state: "locked", value: false, reason: "marketing_legal_review_pending" };
  if (channel === "push") return { state: "locked", value, reason: "push_settings" };
  if (channel === "in_app" && purpose === "service") return { state: "locked", value: true, reason: "required" };
  if (channel === "email" || channel === "sms") {
    const verified = view.contacts.some((c) => c.kind === channel);
    // No verified address: nothing can be sent on this channel, so the cell shows off and asks for
    // verification first (the server also refuses an opt-in without one).
    if (!verified) return { state: "locked", value: false, reason: "address_unverified" };
    return view.readiness[channel] ? { state: "editable", value } : { state: "editable", value, note: "channel_not_ready" };
  }
  return { state: "editable", value };
}

/** Maps server error codes of the channel RPCs to i18n keys (never shows the raw code). */
export function channelErrorKey(message: string | undefined | null): string {
  const known = [
    "contact_invalid",
    "channel_not_ready",
    "verification_rate_limited",
    "address_unverified",
    "unsubscribe_invalid",
    "unsubscribe_expired",
    "service_in_app_required",
    "forbidden",
  ];
  const code = (message ?? "").trim();
  return known.includes(code) ? `channels.error.${code}` : "channels.error.generic";
}
