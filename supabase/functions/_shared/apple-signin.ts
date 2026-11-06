/**
 * H01: Sign in with Apple server side — authorization code exchange, refresh token validation, token revocation
 * and token encryption. Every secret is read from Edge env by NAME; none is ever returned, logged or put in an
 * error message. Apple endpoint errors are reduced to fixed codes.
 *
 * Env: APPLE_TEAM_ID, APPLE_SIGNIN_KEY_ID, APPLE_SIGNIN_PRIVATE_KEY (the .p8 PEM of a key with "Sign in with Apple"),
 *      APPLE_BUNDLE_ID (native client id), APPLE_SERVICES_ID (web/Android OAuth client id),
 *      APPLE_TOKEN_ENCRYPTION_KEY (base64 of 32 random bytes; AES-256-GCM).
 */
export const APPLE_ORIGIN = "https://appleid.apple.com";

export type AppleConfig = {
  teamId: string; keyId: string; privateKey: string; bundleId: string; servicesId: string; encryptionKey: string;
};
export type AppleDeps = { fetch?: typeof fetch; now?: () => number; timeoutMs?: number; config?: AppleConfig | null };
export type AppleFailure = { ok: false; error: AppleError; transient: boolean };
export type AppleError = "not_configured" | "timeout" | "network" | "apple_unavailable" | "invalid_client" | "token_invalid" | "apple_rejected" | "identity_mismatch";
export type AppleTokens = { ok: true; refreshToken?: string; accessToken?: string; sub?: string };

export function appleConfig(): AppleConfig | null {
  const v = (name: string) => Deno.env.get(name)?.trim() ?? "";
  const config = {
    teamId: v("APPLE_TEAM_ID"), keyId: v("APPLE_SIGNIN_KEY_ID"), privateKey: v("APPLE_SIGNIN_PRIVATE_KEY"),
    bundleId: v("APPLE_BUNDLE_ID"), servicesId: v("APPLE_SERVICES_ID"), encryptionKey: v("APPLE_TOKEN_ENCRYPTION_KEY"),
  };
  return Object.values(config).every(Boolean) ? config : null;
}
const resolve = (deps?: AppleDeps) => (deps && "config" in deps ? deps.config ?? null : appleConfig());
/** The client ids this deployment may hold tokens for. */
export function allowedClient(config: AppleConfig, clientId: unknown): clientId is string {
  return clientId === config.bundleId || clientId === config.servicesId;
}

/** The Apple identity (subject) linked to a Supabase user, or null for password/Google-only accounts. */
export function appleIdentity(user: { identities?: { provider?: string; provider_id?: string; identity_data?: Record<string, unknown> }[] } | null | undefined) {
  const identity = user?.identities?.find((i) => i.provider === "apple");
  const sub = identity?.identity_data?.sub ?? identity?.provider_id;
  return typeof sub === "string" && sub ? { sub } : null;
}

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try { const part = token.split(".")[1]; return part ? JSON.parse(new TextDecoder().decode(fromB64(part))) : null; } catch { return null; }
}

const keyCache = new Map<string, Promise<CryptoKey>>();
function signingKey(pem: string) {
  let key = keyCache.get(pem);
  if (!key) {
    const body = pem.replace(/\\n/g, "\n").replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
    key = crypto.subtle.importKey("pkcs8", fromB64(body), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    keyCache.set(pem, key);
  }
  return key;
}
/** ES256 client secret for one client id (Apple allows up to 6 months; we mint 5 minutes per call). */
export async function clientSecret(config: AppleConfig, clientId: string, nowMs = Date.now()) {
  const iat = Math.floor(nowMs / 1000);
  const header = b64url(enc.encode(JSON.stringify({ alg: "ES256", kid: config.keyId, typ: "JWT" })));
  const payload = b64url(enc.encode(JSON.stringify({ iss: config.teamId, iat, exp: iat + 300, aud: APPLE_ORIGIN, sub: clientId })));
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await signingKey(config.privateKey), enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(signature))}`;
}

async function post(path: "/auth/token" | "/auth/revoke", form: Record<string, string>, deps?: AppleDeps) {
  const doFetch = deps?.fetch ?? fetch;
  try {
    const res = await doFetch(APPLE_ORIGIN + path, {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form),
      signal: AbortSignal.timeout(deps?.timeoutMs ?? 8000),
    });
    let body: Record<string, unknown> = {};
    try { body = await res.json(); } catch { /* revoke answers with an empty body */ }
    return { status: res.status, body };
  } catch (e) {
    const name = (e as { name?: string })?.name;
    return { status: 0, body: {}, error: name === "TimeoutError" || name === "AbortError" ? "timeout" as const : "network" as const };
  }
}
function failure(r: { status: number; body: Record<string, unknown>; error?: "timeout" | "network" }): AppleFailure {
  if (r.error) return { ok: false, error: r.error, transient: true };
  if (r.status >= 500 || r.status === 429) return { ok: false, error: "apple_unavailable", transient: true };
  // invalid_client is our configuration (key/team/client id): retryable once the operator fixes it.
  if (r.body.error === "invalid_client") return { ok: false, error: "invalid_client", transient: true };
  if (r.body.error === "invalid_grant") return { ok: false, error: "token_invalid", transient: false };
  return { ok: false, error: "apple_rejected", transient: false };
}
function tokens(body: Record<string, unknown>, expectedSub: string): AppleTokens | AppleFailure {
  const sub = typeof body.id_token === "string" ? decodeJwtPayload(body.id_token)?.sub : undefined;
  // The id_token comes straight from Apple's token endpoint over TLS; its subject binds the token to the account.
  if (sub !== expectedSub) return { ok: false, error: "identity_mismatch", transient: false };
  return {
    ok: true, sub,
    refreshToken: typeof body.refresh_token === "string" && body.refresh_token ? body.refresh_token : undefined,
    accessToken: typeof body.access_token === "string" && body.access_token ? body.access_token : undefined,
  };
}

/** Native iOS authorizationCode (single use, 5 min) → tokens for APPLE_BUNDLE_ID. */
export async function exchangeCode(code: string, expectedSub: string, deps?: AppleDeps): Promise<AppleTokens | AppleFailure> {
  const config = resolve(deps);
  if (!config) return { ok: false, error: "not_configured", transient: true };
  const r = await post("/auth/token", {
    client_id: config.bundleId, client_secret: await clientSecret(config, config.bundleId, deps?.now?.()), code, grant_type: "authorization_code",
  }, deps);
  return r.status === 200 ? tokens(r.body, expectedSub) : failure(r);
}

/** Proves a provider refresh token (web/Android OAuth, APPLE_SERVICES_ID) belongs to this Apple subject. */
export async function validateRefreshToken(refreshToken: string, expectedSub: string, deps?: AppleDeps): Promise<AppleTokens | AppleFailure> {
  const config = resolve(deps);
  if (!config) return { ok: false, error: "not_configured", transient: true };
  const r = await post("/auth/token", {
    client_id: config.servicesId, client_secret: await clientSecret(config, config.servicesId, deps?.now?.()),
    refresh_token: refreshToken, grant_type: "refresh_token",
  }, deps);
  if (r.status !== 200) return failure(r);
  const t = tokens(r.body, expectedSub);
  return t.ok ? { ...t, refreshToken } : t;
}

export async function revokeToken(clientId: string, token: string, tokenType: "refresh_token" | "access_token", deps?: AppleDeps): Promise<{ ok: true } | AppleFailure> {
  const config = resolve(deps);
  if (!config) return { ok: false, error: "not_configured", transient: true };
  if (!allowedClient(config, clientId)) return { ok: false, error: "invalid_client", transient: true };
  const r = await post("/auth/revoke", {
    client_id: clientId, client_secret: await clientSecret(config, clientId, deps?.now?.()), token, token_type_hint: tokenType,
  }, deps);
  return r.status === 200 ? { ok: true } : failure(r);
}

async function aesKey(keyB64: string) {
  const raw = fromB64(keyB64.replace(/=+$/, ""));
  if (raw.length !== 32) throw new Error("bad_key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
/** "v1.<iv>.<ciphertext>" (base64url); the Apple subject is authenticated data, so a row cannot be moved. */
export async function encryptToken(keyB64: string, token: string, appleSub: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(`apple:${appleSub}`) }, await aesKey(keyB64), enc.encode(token));
  return `v1.${b64url(iv)}.${b64url(new Uint8Array(ct))}`;
}
export async function decryptToken(keyB64: string, ciphertext: string, appleSub: string) {
  const [v, iv, ct] = ciphertext.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("bad_ciphertext");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv), additionalData: enc.encode(`apple:${appleSub}`) }, await aesKey(keyB64), fromB64(ct));
  return new TextDecoder().decode(pt);
}

/** Prefer the long-lived refresh token; Apple also revokes the authorization with an access token. */
export function revocable(t: AppleTokens): { token: string; type: "refresh_token" | "access_token" } | null {
  if (t.refreshToken) return { token: t.refreshToken, type: "refresh_token" };
  if (t.accessToken) return { token: t.accessToken, type: "access_token" };
  return null;
}
