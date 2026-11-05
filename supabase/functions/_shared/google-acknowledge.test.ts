// Android acknowledge: sahte Play Developer API sunucusuyla (globalThis.fetch) tekrar güvenliği.
// Gerçek Google çağrısı yok; service account anahtarı test içinde üretilir ve yalnız bellekte kalır.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { acknowledgeGoogle, googleNeedsAcknowledge, IapError, refreshGoogle } from "./iap.ts";
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const db = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { product_id: "gina_plus_monthly" }, error: null }) }) }) }) }) } as unknown as SupabaseClient;

async function installServiceAccount() {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  let bin = ""; for (const b of pkcs8) bin += String.fromCharCode(b);
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(bin).replace(/(.{64})/g, "$1\n")}\n-----END PRIVATE KEY-----\n`;
  Deno.env.set("GOOGLE_PLAY_SA_KEY", JSON.stringify({ client_email: "test-sa@example.invalid", private_key: pem, token_uri: "https://oauth.fake.test/token" }));
}

type Script = { ackStatus?: number; states: string[]; subscriptionState?: string };
/** Sahte Play API: her GET sırayla states[] içinden acknowledgementState döner; POST :acknowledge ackStatus döner. */
function fakePlay(script: Script) {
  const log: string[] = [];
  let gets = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = init?.method ?? "GET";
    if (url.startsWith("https://oauth.fake.test/token")) {
      log.push("token");
      return new Response(JSON.stringify({ access_token: "fake-access", expires_in: 3600 }), { status: 200 });
    }
    if (url.includes("/purchases/subscriptionsv2/tokens/")) {
      log.push("get");
      const ack = script.states[Math.min(gets, script.states.length - 1)]; gets++;
      return new Response(JSON.stringify({ subscriptionState: script.subscriptionState ?? "SUBSCRIPTION_STATE_ACTIVE", acknowledgementState: ack,
        lineItems: [{ productId: "gina_plus", expiryTime: "2027-01-01T00:00:00Z", autoRenewingPlan: { autoRenewEnabled: true }, offerDetails: { basePlanId: "monthly" } }] }), { status: 200 });
    }
    if (url.endsWith(":acknowledge") && method === "POST") {
      log.push("ack");
      return new Response(script.ackStatus === 200 ? "{}" : JSON.stringify({ error: { message: "PRIVATE provider body with token" } }), { status: script.ackStatus ?? 200 });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;
  return { log, restore: () => { globalThis.fetch = realFetch; } };
}

Deno.test("acknowledge happens once for a PENDING active purchase and is recorded on the state", async () => {
  await installServiceAccount(); const play = fakePlay({ states: ["ACKNOWLEDGEMENT_STATE_PENDING"] });
  try {
    const state = await refreshGoogle(db, "purchase-token-A");
    eq(state?.acknowledged, true); eq(play.log.filter((l) => l !== "token"), ["get", "ack"]);
    eq(googleNeedsAcknowledge(state), false);
  } finally { play.restore(); }
});
Deno.test("already acknowledged purchase is never acknowledged again", async () => {
  await installServiceAccount(); const play = fakePlay({ states: ["ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"] });
  try {
    const state = await refreshGoogle(db, "purchase-token-B");
    eq(state?.acknowledged, true); eq(play.log.filter((l) => l !== "token"), ["get"]);
  } finally { play.restore(); }
});
Deno.test("expired purchase is not acknowledged even if PENDING", async () => {
  await installServiceAccount(); const play = fakePlay({ states: ["ACKNOWLEDGEMENT_STATE_PENDING"], subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" });
  try {
    const state = await refreshGoogle(db, "purchase-token-C");
    eq(state?.status, "expired"); eq(state?.acknowledged, false); eq(play.log.filter((l) => l !== "token"), ["get"]);
  } finally { play.restore(); }
});
Deno.test("pending payment (no entitlement) is never acknowledged", async () => {
  await installServiceAccount(); const play = fakePlay({ states: ["ACKNOWLEDGEMENT_STATE_PENDING"], subscriptionState: "SUBSCRIPTION_STATE_PENDING" });
  try {
    eq(await refreshGoogle(db, "purchase-token-D"), null); eq(play.log.filter((l) => l !== "token"), ["get"]);
  } finally { play.restore(); }
});
Deno.test("duplicate acknowledge (409/400) is safe when Google already reports ACKNOWLEDGED", async () => {
  for (const ackStatus of [409, 400]) {
    await installServiceAccount(); const play = fakePlay({ ackStatus, states: ["ACKNOWLEDGEMENT_STATE_PENDING", "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED"] });
    try {
      const state = await refreshGoogle(db, "purchase-token-E");
      eq(state?.acknowledged, true); eq(play.log.filter((l) => l !== "token"), ["get", "ack", "get"]);
    } finally { play.restore(); }
  }
});
Deno.test("acknowledge failure that Google does not confirm is a retryable 502 without provider body", async () => {
  await installServiceAccount(); const play = fakePlay({ ackStatus: 500, states: ["ACKNOWLEDGEMENT_STATE_PENDING"] });
  try {
    let caught: unknown; try { await refreshGoogle(db, "purchase-token-F"); } catch (e) { caught = e; }
    eq(caught instanceof IapError, true); eq((caught as IapError).code, "google_ack_500"); eq((caught as IapError).httpStatus, 502);
    eq(JSON.stringify(caught).includes("PRIVATE"), false);
    eq(play.log.filter((l) => l !== "token"), ["get", "ack", "get"]);
  } finally { play.restore(); }
});
Deno.test("retrying after a failed acknowledge succeeds once Google accepts", async () => {
  await installServiceAccount(); const play = fakePlay({ ackStatus: 200, states: ["ACKNOWLEDGEMENT_STATE_PENDING"] });
  try {
    await acknowledgeGoogle("gina_plus", "purchase-token-G");
    eq(play.log.filter((l) => l !== "token"), ["ack"]);
  } finally { play.restore(); }
});
