import { appleIdentity, clientSecret, decodeJwtPayload, decryptToken, encryptToken, exchangeCode, revokeToken, validateRefreshToken } from "./apple-signin.ts";
import { fakeApple, testConfig, tokenReply } from "./apple-signin.fixture.ts";

function equal(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); }
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

Deno.test("apple: client secret is an ES256 JWT for the given client id, verifiable with the key", async () => {
  const { config, publicKey } = await testConfig();
  const jwt = await clientSecret(config, config.servicesId, 1_800_000_000_000);
  const [h, p, s] = jwt.split(".");
  equal(JSON.parse(new TextDecoder().decode(fromB64url(h))), { alg: "ES256", kid: config.keyId, typ: "JWT" });
  equal(decodeJwtPayload(jwt), { iss: config.teamId, iat: 1_800_000_000, exp: 1_800_000_300, aud: "https://appleid.apple.com", sub: config.servicesId });
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, fromB64url(s), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error("signature does not verify");
});

Deno.test("apple: token encryption round-trips and is bound to the Apple subject", async () => {
  const { config } = await testConfig();
  const ct = await encryptToken(config.encryptionKey, "apple-refresh-SECRET", "sub-1");
  if (!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ct) || ct.includes("SECRET")) throw new Error("bad ciphertext format");
  equal(await decryptToken(config.encryptionKey, ct, "sub-1"), "apple-refresh-SECRET");
  let moved = false; try { await decryptToken(config.encryptionKey, ct, "sub-2"); moved = true; } catch { /* expected */ }
  if (moved) throw new Error("ciphertext decrypted for another subject");
  if (await encryptToken(config.encryptionKey, "x", "sub-1") === await encryptToken(config.encryptionKey, "x", "sub-1")) throw new Error("IV reused");
});

Deno.test("apple: identity is read only from an apple identity", () => {
  equal(appleIdentity({ identities: [{ provider: "email" }, { provider: "apple", provider_id: "p", identity_data: { sub: "sub-1" } }] }), { sub: "sub-1" });
  equal(appleIdentity({ identities: [{ provider: "google", provider_id: "g" }] }), null);
  equal(appleIdentity(null), null);
});

Deno.test("apple: code exchange uses the bundle id and binds the id_token subject", async () => {
  const { config } = await testConfig();
  const apple = fakeApple({ token: [tokenReply("sub-1"), tokenReply("someone-else")] });
  const ok = await exchangeCode("code-1", "sub-1", { config, fetch: apple.fetch });
  equal(ok, { ok: true, sub: "sub-1", refreshToken: "apple-refresh-SECRET", accessToken: "apple-access-SECRET" });
  equal([apple.calls[0].path, apple.calls[0].form.client_id, apple.calls[0].form.grant_type, apple.calls[0].form.code], ["/auth/token", config.bundleId, "authorization_code", "code-1"]);
  equal(await exchangeCode("code-2", "sub-1", { config, fetch: apple.fetch }), { ok: false, error: "identity_mismatch", transient: false });
});

Deno.test("apple: refresh token validation uses the services id", async () => {
  const { config } = await testConfig();
  const apple = fakeApple({ token: [{ status: 200, body: { access_token: "a", id_token: (await import("./apple-signin.fixture.ts")).idToken("sub-1") } }] });
  const r = await validateRefreshToken("rt", "sub-1", { config, fetch: apple.fetch });
  equal(r.ok && r.refreshToken, "rt");
  equal([apple.calls[0].form.client_id, apple.calls[0].form.grant_type], [config.servicesId, "refresh_token"]);
});

Deno.test("apple: revoke maps Apple answers to fixed codes", async () => {
  const { config } = await testConfig();
  const apple = fakeApple({ revoke: [{ status: 200 }, "timeout", "network", { status: 503 }, { status: 400, body: { error: "invalid_grant" } }, { status: 400, body: { error: "invalid_client" } }, { status: 400, body: { error: "invalid_request" } }] });
  const deps = { config, fetch: apple.fetch, timeoutMs: 20 };
  const results = [];
  for (let i = 0; i < 7; i++) results.push(await revokeToken(config.bundleId, "t", "refresh_token", deps));
  equal(results, [
    { ok: true }, { ok: false, error: "timeout", transient: true }, { ok: false, error: "network", transient: true },
    { ok: false, error: "apple_unavailable", transient: true }, { ok: false, error: "token_invalid", transient: false },
    { ok: false, error: "invalid_client", transient: true }, { ok: false, error: "apple_rejected", transient: false },
  ]);
  equal([apple.calls[0].path, apple.calls[0].form.token_type_hint, apple.calls[0].form.token], ["/auth/revoke", "refresh_token", "t"]);
  equal(await revokeToken("com.attacker.app", "t", "refresh_token", deps), { ok: false, error: "invalid_client", transient: true });
  equal(await revokeToken(config.bundleId, "t", "refresh_token", { config: null }), { ok: false, error: "not_configured", transient: true });
});
