// U01/H04: one user-facing reason per auth failure, and safe reading of the parameters an auth e-mail link
// (confirmation, password reset) or OAuth return brings back. Pure; the mobile/web screens render the copy.
import { classifyServerError } from "./shared-limits";

export type AuthIssue =
  | "cancelled"
  | "expired"
  | "other_device"
  | "offline"
  | "session_expired"
  | "rate_limited"
  | "invalid_login"
  | "email_not_confirmed"
  | "weak_password"
  | "service"
  | "failed";

/** What a redirect URL carried. `error_description` is only used to classify, never shown. */
export type AuthRedirectError = {
  error: string;
  error_code?: string;
  error_description?: string;
};

const SAFE_TOKEN = /^[a-z][a-z0-9_]{0,63}$/;
// Supabase Auth's text for a used, expired or tampered e-mail link when no `error_code` is present
// (older servers, or a link that fell back to the Site URL).
const EXPIRED_LINK_TEXT = /(link|token|otp|code)\b.*\b(invalid|expired)|has expired|already (been )?used/;

/** Minimal `application/x-www-form-urlencoded` reader (core has no DOM lib); first value wins. */
function parseParams(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of raw.split("&")) {
    if (!part) continue;
    const at = part.indexOf("=");
    const decode = (v: string) => {
      try { return decodeURIComponent(v.replace(/\+/g, " ")); } catch { return ""; }
    };
    const key = decode(at < 0 ? part : part.slice(0, at));
    if (key && !out.has(key)) out.set(key, decode(at < 0 ? "" : part.slice(at + 1)));
  }
  return out;
}

/**
 * Reads `error`, `error_code` and `error_description` from the query (PKCE) or the fragment (implicit
 * flow); the query wins. Anything not shaped like an auth error token is ignored.
 */
export function readAuthRedirectError(search: string, hash: string): AuthRedirectError | null {
  const query = parseParams(search.startsWith("?") ? search.slice(1) : search);
  const fragment = parseParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const pick = (key: string) => query.get(key) ?? fragment.get(key) ?? undefined;
  const error = pick("error")?.toLowerCase();
  if (!error || !SAFE_TOKEN.test(error)) return null;
  const code = pick("error_code")?.toLowerCase();
  const description = pick("error_description")?.slice(0, 200);
  return {
    error,
    ...(code && SAFE_TOKEN.test(code) ? { error_code: code } : {}),
    ...(description ? { error_description: description } : {}),
  };
}

/** Maps Supabase Auth errors and redirect params onto U08 categories, then auth-specific reasons. */
export function classifyAuthIssue(input: unknown): AuthIssue {
  const detail = typeof input === "object" && input !== null
    ? input as { code?: unknown; status?: unknown; name?: unknown; message?: unknown; error?: unknown; error_code?: unknown; error_description?: unknown }
    : {};
  const code = String(detail.error_code ?? detail.code ?? "").toLowerCase();
  const error = String(detail.error ?? "").toLowerCase();
  const message = String(detail.message ?? (typeof input === "string" ? input : "")).toLowerCase();
  const description = String(detail.error_description ?? "").toLowerCase();
  const name = String(detail.name ?? "");
  if (/otp_expired|flow_state_expired/.test(code)) return "expired";
  if (/flow_state_not_found|bad_code_verifier|code verifier|pkce/.test(code + " " + message)) return "other_device";
  // A redirect error without a code but with the server's "link is invalid or has expired" text is an
  // e-mail link problem, not a cancelled sign-in.
  if (error && !code && EXPIRED_LINK_TEXT.test(description)) return "expired";
  if (error === "access_denied") return "cancelled";
  if (/invalid_credentials|invalid login credentials/.test(code + " " + message)) return "invalid_login";
  if (/email_not_confirmed/.test(code + " " + message)) return "email_not_confirmed";
  if (/weak_password|same_password/.test(code)) return "weak_password";
  if (/refresh_token_not_found|refresh_token_already_used|session_not_found|session_expired|pgrst301/.test(code) || /jwt expired/.test(message)) return "session_expired";
  const network = name === "AuthRetryableFetchError" || /network|failed to fetch|fetch failed|timeout|abort/.test(message);
  const safeCode = SAFE_TOKEN.test(code) ? code : undefined;
  const status = typeof detail.status === "number" && detail.status > 0 ? detail.status : null;
  const classified = classifyServerError({ code: safeCode, status, network });
  if (classified.category === "offline") return "offline";
  if (classified.category === "rate_limited" || /over_email_send_rate_limit|over_request_rate_limit/.test(code)) return "rate_limited";
  if (classified.category === "session_expired") return "session_expired";
  if (classified.category === "service_unavailable" && status !== null) return "service";
  return "failed";
}

/**
 * Native password-reset link: the code exchange failed. Offline is retryable with the same link;
 * everything else (used, expired, started in another app/browser) needs a new link.
 */
export function recoveryExchangeIssue(input: unknown): "offline" | "expired" {
  return classifyAuthIssue(input) === "offline" ? "offline" : "expired";
}

/** i18n key for an auth issue; existing copy is reused where it already says the right thing. */
export function authIssueKey(issue: AuthIssue) {
  return ({
    cancelled: "u01.cancelled",
    expired: "u01.linkExpired",
    other_device: "u01.otherDevice",
    offline: "release.networkError",
    session_expired: "u01.sessionExpired",
    rate_limited: "unified.errorRate",
    invalid_login: "auth.invalidLogin",
    email_not_confirmed: "unified.errorEmail",
    weak_password: "unified.errorPassword",
    service: "u01.serviceDown",
    failed: "experience.social.failed",
  } as const)[issue];
}
