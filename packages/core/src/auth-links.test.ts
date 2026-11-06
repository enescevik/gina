import { describe, expect, it } from "vitest";
import { authIssueKey, classifyAuthIssue, readAuthRedirectError, recoveryExchangeIssue } from "./auth-links";
import tr from "./i18n/tr.json";
import en from "./i18n/en.json";

describe("readAuthRedirectError", () => {
  it("reads a PKCE query error (used or expired confirmation/reset link)", () => {
    expect(readAuthRedirectError("?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", ""))
      .toEqual({ error: "access_denied", error_code: "otp_expired", error_description: "Email link is invalid or has expired" });
  });
  it("reads the implicit-flow fragment when the query has nothing", () => {
    expect(readAuthRedirectError("", "#error=access_denied&error_code=otp_expired")).toEqual({ error: "access_denied", error_code: "otp_expired" });
  });
  it("prefers the query over the fragment", () => {
    expect(readAuthRedirectError("error=server_error", "#error=access_denied")?.error).toBe("server_error");
  });
  it("ignores missing or unsafe values", () => {
    expect(readAuthRedirectError("?code=abc", "")).toBeNull();
    expect(readAuthRedirectError("?error=<script>", "")).toBeNull();
    expect(readAuthRedirectError("?error=access_denied&error_code=a%20b", "")).toEqual({ error: "access_denied" });
  });
  it("decodes percent and plus encoding; a malformed escape is dropped", () => {
    expect(readAuthRedirectError("?error=access_denied&error_description=Token%20has+expired", "")?.error_description).toBe("Token has expired");
    expect(readAuthRedirectError("?error=access_denied&error_code=%E0%A4%A", "")).toEqual({ error: "access_denied" });
  });
  it("bounds the description", () => {
    expect(readAuthRedirectError(`?error=x&error_description=${"a".repeat(500)}`, "")?.error_description).toHaveLength(200);
  });
});

describe("classifyAuthIssue for e-mail links", () => {
  it("used or expired link is 'expired' (Supabase reports both as otp_expired)", () => {
    expect(classifyAuthIssue({ error: "access_denied", error_code: "otp_expired" })).toBe("expired");
    expect(classifyAuthIssue({ code: "flow_state_expired", status: 400 })).toBe("expired");
  });
  it("expired-link text without an error code is not mistaken for a cancelled sign-in", () => {
    expect(classifyAuthIssue({ error: "access_denied", error_description: "Email link is invalid or has expired" })).toBe("expired");
    expect(classifyAuthIssue({ error: "unauthorized_client", error_description: "Token has expired or is invalid" })).toBe("expired");
  });
  it("a real OAuth cancel stays 'cancelled'", () => {
    expect(classifyAuthIssue({ error: "access_denied" })).toBe("cancelled");
    expect(classifyAuthIssue({ error: "access_denied", error_description: "The user denied the request" })).toBe("cancelled");
  });
  it("link opened in another browser (no PKCE verifier) is 'other_device'", () => {
    expect(classifyAuthIssue({ code: "flow_state_not_found" })).toBe("other_device");
    expect(classifyAuthIssue({ code: "bad_code_verifier" })).toBe("other_device");
    expect(classifyAuthIssue(new Error("invalid request: both auth code and code verifier should be non-empty"))).toBe("other_device");
  });
  it("network, rate limit and sign-in errors keep their own reasons", () => {
    expect(classifyAuthIssue({ name: "AuthRetryableFetchError", message: "Failed to fetch" })).toBe("offline");
    expect(classifyAuthIssue({ code: "over_email_send_rate_limit", status: 429 })).toBe("rate_limited");
    expect(classifyAuthIssue({ code: "invalid_credentials", status: 400 })).toBe("invalid_login");
    expect(classifyAuthIssue({ code: "email_not_confirmed", status: 400 })).toBe("email_not_confirmed");
    expect(classifyAuthIssue({ code: "refresh_token_not_found", status: 400 })).toBe("session_expired");
  });
});

describe("recoveryExchangeIssue (native reset link)", () => {
  it("offline is retryable, everything else needs a new link", () => {
    expect(recoveryExchangeIssue({ name: "AuthRetryableFetchError", message: "Failed to fetch" })).toBe("offline");
    expect(recoveryExchangeIssue({ code: "flow_state_not_found" })).toBe("expired");
    expect(recoveryExchangeIssue({ code: "otp_expired" })).toBe("expired");
    expect(recoveryExchangeIssue(new Error("boom"))).toBe("expired");
  });
});

describe("authIssueKey", () => {
  it("every reason has TR and EN copy", () => {
    const issues = ["cancelled", "expired", "other_device", "offline", "session_expired", "rate_limited", "invalid_login", "email_not_confirmed", "weak_password", "service", "failed"] as const;
    for (const issue of issues) {
      const key = authIssueKey(issue);
      expect((tr as unknown as Record<string, string>)[key], `tr ${key}`).toBeTruthy();
      expect((en as unknown as Record<string, string>)[key], `en ${key}`).toBeTruthy();
    }
  });
});
