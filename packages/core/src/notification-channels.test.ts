import { describe, expect, it } from "vitest";
import { channelDefault, contactLooksValid, contactVerificationConfirm, normalizeContact } from "./notification-channels";

describe("notification channels", () => {
  it("defaults: service on, announcement only in-app/push, marketing never", () => {
    expect(channelDefault("email", "service")).toBe(true);
    expect(channelDefault("email", "announcement")).toBe(false);
    expect(channelDefault("push", "announcement")).toBe(true);
    expect(channelDefault("in_app", "marketing")).toBe(false);
  });
  it("normalizes like the server", () => {
    expect(normalizeContact("email", "  Parent-A@Example.com ")).toBe("parent-a@example.com");
    expect(normalizeContact("sms", "+90 (555) 111-22-33")).toBe("+905551112233");
    expect(contactLooksValid("sms", "0555 111 22 33")).toBe(false);
    expect(contactLooksValid("email", "not-an-address")).toBe(false);
  });
  it("confirm result schema distinguishes verified and invalid with remaining attempts", () => {
    expect(contactVerificationConfirm.parse({ status: "invalid", remaining: 4 })).toEqual({ status: "invalid", remaining: 4 });
    expect(() => contactVerificationConfirm.parse({ status: "delivered" })).toThrow();
  });
});
