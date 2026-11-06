import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { storeAppleToken } from "./handler.ts";
import { decryptToken } from "../_shared/apple-signin.ts";
import { fakeApple, idToken, testConfig, tokenReply } from "../_shared/apple-signin.fixture.ts";

const { config } = await testConfig();
const sub = "001234.apple-sub";
function world({ apple = fakeApple(), identities = [{ provider: "apple", provider_id: sub, identity_data: { sub } }] as unknown[], anonymous = false, storeFail = false, cfg = config as typeof config | null } = {}) {
  const stored: Record<string, unknown>[] = [];
  const db = {
    rpc: (name: string, args: Record<string, unknown>) => { if (name === "apple_token_store") { if (storeFail) return { error: {} }; stored.push(args); } return { data: null, error: null }; },
    auth: { getUser: () => ({ data: { user: { id: "u1", is_anonymous: anonymous, identities } }, error: null }) },
  } as unknown as SupabaseClient;
  return { deps: { db, apple: { config: cfg, fetch: apple.fetch, timeoutMs: 20 } }, stored, apple };
}
const req = (body: unknown) => new Request("https://local/apple-token", { method: "POST", headers: { authorization: "Bearer jwt" }, body: JSON.stringify(body) });
function equal(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, received ${JSON.stringify(a)}`); }

Deno.test("apple-token: native code is exchanged for the bundle id and stored encrypted only", async () => {
  const w = world({ apple: fakeApple({ token: [tokenReply(sub)] }) });
  const res = await storeAppleToken(req({ authorization_code: "code-1" }), w.deps);
  equal([res.status, await res.json()], [200, { ok: true }]);
  const row = w.stored[0];
  equal([row.p_user_id, row.p_apple_sub, row.p_client_id, row.p_token_type], ["u1", sub, config.bundleId, "refresh_token"]);
  if (JSON.stringify(row).includes("SECRET")) throw new Error("plaintext token reached the database");
  equal(await decryptToken(config.encryptionKey, row.p_token_ciphertext as string, sub), "apple-refresh-SECRET");
});

Deno.test("apple-token: web provider refresh token is validated with the services id before storing", async () => {
  const w = world({ apple: fakeApple({ token: [{ status: 200, body: { access_token: "a", id_token: idToken(sub) } }] }) });
  equal((await storeAppleToken(req({ refresh_token: "web-rt" }), w.deps)).status, 200);
  equal([w.apple.calls[0].form.client_id, w.apple.calls[0].form.grant_type, w.stored[0].p_client_id], [config.servicesId, "refresh_token", config.servicesId]);
});

Deno.test("apple-token: another Apple subject, invalid token, outage, misconfiguration and bad input never store", async () => {
  for (const [script, body, status, error] of [
    [{ token: [tokenReply("someone-else")] }, { authorization_code: "c" }, 403, "identity_mismatch"],
    [{ token: [{ status: 400, body: { error: "invalid_grant" } }] }, { authorization_code: "c" }, 400, "token_invalid"],
    [{ token: ["timeout"] }, { refresh_token: "r" }, 503, "apple_unavailable"],
    [{}, { authorization_code: "c", refresh_token: "r" }, 400, "invalid_input"],
    [{}, {}, 400, "invalid_input"],
  ] as const) {
    const w = world({ apple: fakeApple(script as never) });
    const res = await storeAppleToken(req(body), w.deps);
    equal([res.status, await res.json(), w.stored], [status, { error }, []]);
  }
  const off = world({ cfg: null });
  equal((await storeAppleToken(req({ authorization_code: "c" }), off.deps)).status, 503);
  const notApple = world({ identities: [{ provider: "email" }] });
  equal((await storeAppleToken(req({ authorization_code: "c" }), notApple.deps)).status, 409);
  const anon = world({ anonymous: true });
  equal((await storeAppleToken(req({ authorization_code: "c" }), anon.deps)).status, 403);
  const failing = world({ apple: fakeApple({ token: [tokenReply(sub)] }), storeFail: true });
  equal((await storeAppleToken(req({ authorization_code: "c" }), failing.deps)).status, 500);
});
