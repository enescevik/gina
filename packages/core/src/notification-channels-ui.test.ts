import { describe, expect, it } from "vitest";
import {
  channelErrorKey,
  describeUnsubscribeToken,
  myNotificationChannels,
  normalizeVerificationCode,
  parseVerificationLink,
  preferenceCell,
  resendWaitSeconds,
  type MyNotificationChannels,
} from "./notification-channels";

const base: MyNotificationChannels = {
  contacts: [],
  pending: [],
  preferences: {
    in_app: { service: true, announcement: true, marketing: false },
    push: { service: true, announcement: true, marketing: false },
    email: { service: true, announcement: false, marketing: false },
    sms: { service: true, announcement: false, marketing: false },
  },
  effective: {
    email: { service: "address_unverified", announcement: "address_unverified", marketing: "marketing_legal_review_pending" },
    sms: { service: "address_unverified", announcement: "address_unverified", marketing: "marketing_legal_review_pending" },
  },
  readiness: { in_app: true, push: false, email: true, sms: false },
  marketing_allowed: false,
};
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function b64url(text: string): string {
  let bits = 0, value = 0, out = "";
  for (const ch of text) {
    value = (value << 8) | ch.charCodeAt(0);
    bits += 8;
    while (bits >= 6) { bits -= 6; out += B64[(value >> bits) & 63]; }
  }
  return bits ? out + B64[(value << (6 - bits)) & 63] : out;
}
const token = (body: string, sig = "0".repeat(40)) => b64url(body) + "." + sig;

describe("C10 channel UI rules", () => {
  it("parses the extended server view and still accepts the S02 shape", () => {
    const extended = myNotificationChannels.parse({
      ...base,
      limits: { email: { requests_left: 2, last_requested_at: "2026-11-06T10:00:00Z", next_request_at: null }, sms: { requests_left: 3, last_requested_at: null, next_request_at: null } },
      consent_history: [{ channel: "email", purpose: "announcement", enabled: true, source: "user", at: "2026-11-06T10:01:00Z" }],
    });
    expect(extended.limits?.email.requests_left).toBe(2);
    const { marketing_allowed: _unused, ...legacy } = base;
    expect(myNotificationChannels.parse(legacy).marketing_allowed).toBeUndefined();
  });

  it("matrix: in-app service required, marketing locked without legal review, email needs a verified address", () => {
    expect(preferenceCell(base, "in_app", "service")).toEqual({ state: "locked", value: true, reason: "required" });
    expect(preferenceCell(base, "in_app", "announcement")).toEqual({ state: "editable", value: true });
    expect(preferenceCell(base, "email", "marketing")).toEqual({ state: "locked", value: false, reason: "marketing_legal_review_pending" });
    expect(preferenceCell(base, "email", "service")).toEqual({ state: "locked", value: false, reason: "address_unverified" });
    expect(preferenceCell(base, "push", "announcement")).toMatchObject({ state: "locked", reason: "push_settings" });
    const verified: MyNotificationChannels = {
      ...base,
      contacts: [
        { kind: "email", masked: "p***@example.com", verified_at: "2026-11-06T10:00:00Z" },
        { kind: "sms", masked: "+90*******33", verified_at: "2026-11-06T10:00:00Z" },
      ],
    };
    expect(preferenceCell(verified, "email", "announcement")).toEqual({ state: "editable", value: false });
    expect(preferenceCell(verified, "sms", "announcement")).toEqual({ state: "editable", value: false, note: "channel_not_ready" });
    expect(preferenceCell({ ...verified, marketing_allowed: true }, "email", "marketing")).toEqual({ state: "editable", value: false });
  });

  it("resend wait: 60 s cooldown after a request, hourly limit until the window frees", () => {
    const now = Date.parse("2026-11-06T10:00:30Z");
    expect(resendWaitSeconds(undefined, now)).toBe(0);
    expect(resendWaitSeconds({ requests_left: 2, last_requested_at: "2026-11-06T10:00:00Z", next_request_at: null }, now)).toBe(30);
    expect(resendWaitSeconds({ requests_left: 2, last_requested_at: "2026-11-06T09:58:00Z", next_request_at: null }, now)).toBe(0);
    expect(resendWaitSeconds({ requests_left: 0, last_requested_at: "2026-11-06T09:50:00Z", next_request_at: "2026-11-06T10:10:30Z" }, now)).toBe(600);
  });

  it("verification codes and deep links are strict", () => {
    expect(normalizeVerificationCode("email", " abcd-2345 ")).toBe("ABCD2345");
    expect(normalizeVerificationCode("email", "ABC")).toBeNull();
    expect(normalizeVerificationCode("sms", "123 456")).toBe("123456");
    expect(normalizeVerificationCode("sms", "12345a")).toBeNull();
    expect(parseVerificationLink({ kind: "email", code: "abcd2345" })).toEqual({ kind: "email", code: "ABCD2345" });
    expect(parseVerificationLink({ code: "ABCD2345" })).toEqual({ kind: "email", code: "ABCD2345" });
    expect(parseVerificationLink({ kind: "fax", code: "ABCD2345" })).toBeNull();
    expect(parseVerificationLink({ kind: "email", code: "<script>" })).toBeNull();
    expect(parseVerificationLink({ kind: ["sms"], code: ["654321"] })).toEqual({ kind: "sms", code: "654321" });
  });

  it("unsubscribe link: display-only decoding, never trusts the shape blindly", () => {
    const now = Date.parse("2026-11-06T10:00:00Z");
    const exp = Math.floor(now / 1000) + 86400;
    expect(describeUnsubscribeToken(token(`00000000-0000-4000-8000-000000000001:email:announcement:${exp}`), now)).toEqual({ channel: "email", purpose: "announcement", expired: false });
    expect(describeUnsubscribeToken(token(`00000000-0000-4000-8000-000000000001:sms:marketing:${exp - 2 * 86400}`), now)).toEqual({ channel: "sms", purpose: "marketing", expired: true });
    expect(describeUnsubscribeToken(token(`00000000-0000-4000-8000-000000000001:email:service:${exp}`), now)).toBeNull();
    expect(describeUnsubscribeToken("garbage", now)).toBeNull();
    expect(describeUnsubscribeToken(token(`00000000-0000-4000-8000-000000000001:email:announcement:${exp}`, "Z".repeat(40)), now)).toBeNull();
  });

  it("server errors map to translated keys, unknown codes to a generic sentence", () => {
    expect(channelErrorKey("verification_rate_limited")).toBe("channels.error.verification_rate_limited");
    expect(channelErrorKey("address_unverified")).toBe("channels.error.address_unverified");
    expect(channelErrorKey("permission denied for table x")).toBe("channels.error.generic");
    expect(channelErrorKey(undefined)).toBe("channels.error.generic");
  });
});
