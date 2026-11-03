import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { processStoreNotification } from "./store-notification.ts";
import { appleNotifications } from "../apple-notifications/handler.ts";
import { googleRtdn } from "../google-rtdn/handler.ts";
import type { StoreState } from "./iap.ts";
const equal = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
function inbox(options: {status?: string; claimError?: boolean; finishError?: boolean; finishFalse?: boolean} = {}) {
  const calls: {name: string; args: Record<string, unknown>}[] = [];
  const db = {rpc: async (name: string, args: Record<string, unknown>) => {
    calls.push({name, args});
    if (name === "claim_store_notification") return {data: {status: options.status ?? "claimed", token: "lease"}, error: options.claimError ? {} : null};
    return {data: !options.finishFalse, error: options.finishError ? {} : null};
  }} as unknown as SupabaseClient;
  return {db, calls};
}
const post = (body: unknown) => new Request("https://local/notification", {method: "POST", body: JSON.stringify(body)});
Deno.test("verified event completes only after durable finish; platform scopes every operation", async () => {
  const f = inbox(); let applied = 0;
  equal((await processStoreNotification(f.db, "apple", "same-id", "TEST", {}, async () => {applied++; return {storeKey: "store"};})).status, 200);
  equal(applied, 1); equal(f.calls.map(c => c.args.p_platform), ["apple", "apple"]);
  equal(f.calls[1].args.p_store_key, "store"); equal(f.calls[1].args.p_token, "lease");
});
for (const [status, expected] of [["done", 200], ["busy", 503], ["bad", 503]] as const) Deno.test(`inbox ${status} does not apply subscription`, async () => {
  const f = inbox({status}); let applied = 0;
  equal((await processStoreNotification(f.db, "google", "id", null, {}, async () => {applied++; return {};})).status, expected);
  equal(applied, 0);
});
for (const options of [{claimError: true}, {finishError: true}, {finishFalse: true}]) Deno.test(`storage failure never acknowledged: ${JSON.stringify(options)}`, async () => {
  const f = inbox(options);
  equal((await processStoreNotification(f.db, "apple", "id", null, {}, async () => ({}))).status, 503);
});
Deno.test("processing error releases receipt for retry without storing provider secrets", async () => {
  const f = inbox(); const res = await processStoreNotification(f.db, "apple", "id", null, {}, async () => {throw new Error("private purchase token");});
  equal(res.status, 503); equal(f.calls[1].args.p_error, "processing_failed");
  equal((await res.text()).includes("private"), false);
});
const applePayload = {notificationUUID: "apple-id", notificationType: "DID_RENEW", data: {bundleId: "com.enescevik.gina", signedTransactionInfo: "tx"}};
const fakeState = {storeKey: "store-id"} as StoreState;
function apple(options: {reject?: boolean; payload?: object; applyFail?: boolean; dbFail?: boolean} = {}) {
  const f = inbox(); let dbCalls = 0, applied = 0;
  const deps: NonNullable<Parameters<typeof appleNotifications>[1]> = {
    serviceClient: () => {dbCalls++; if(options.dbFail) throw new Error(); return f.db;},
    verifyAppleJws: async <T extends object>(signed: string) => {
      if(options.reject) throw new Error("bad signature");
      return (signed === "outer" ? options.payload ?? applePayload : {}) as T;
    }, appleApiConfigured: () => false, bundleId: () => "com.enescevik.gina",
    appleState: () => fakeState, fetchAppleState: async () => null,
    applyStoreState: async () => {applied++; if(options.applyFail) throw new Error("retry"); return {} as never;},
  };
  return {...f, deps, counters: () => ({dbCalls, applied})};
}
Deno.test("invalid Apple signature cannot reserve or poison a real notification UUID", async () => {
  const f = apple({reject: true}); equal((await appleNotifications(post({signedPayload: "outer"}), f.deps)).status, 400);
  equal(f.counters(), {dbCalls: 0, applied: 0}); equal(f.calls.length, 0);
});
Deno.test("Apple verified event uses durable inbox and applies transaction", async () => {
  const f = apple(); equal((await appleNotifications(post({signedPayload: "outer"}), f.deps)).status, 200);
  equal(f.counters().applied, 1); equal(f.calls[0].args.p_event_key, "apple-id");
});
Deno.test("Apple retryable failure is not converted into a successful deferred response", async () => {
  const f = apple({applyFail: true}); equal((await appleNotifications(post({signedPayload: "outer"}), f.deps)).status, 503);
});
for (const payload of [{}, {...applePayload, notificationUUID: ""}, {...applePayload, data: {bundleId: "other"}}, {...applePayload, data: {}}]) Deno.test(`Apple rejects malformed or wrong bundle before claim: ${JSON.stringify(payload)}`, async () => {
  const f = apple({payload}); equal((await appleNotifications(post({signedPayload: "outer"}), f.deps)).status, 400); equal(f.calls.length, 0);
});
Deno.test("Apple TEST does not grant an entitlement", async () => {
  const f = apple({payload: {notificationUUID: "id", notificationType: "TEST"}});
  equal((await appleNotifications(post({signedPayload: "outer"}), f.deps)).status, 200); equal(f.counters().applied, 0);
});
const googleNotification = {packageName: "com.enescevik.gina", subscriptionNotification: {notificationType: 12, purchaseToken: "token"}};
const envelope = (notification: unknown = googleNotification, id = "google-id") => ({message: {messageId: id, data: btoa(JSON.stringify(notification))}});
function google(options: {missing?: string; verified?: boolean; configured?: boolean; applyFail?: boolean} = {}) {
  const f = inbox(); let dbCalls = 0, applied = 0, refreshed = 0; const authCalls: unknown[][] = [];
  const deps: NonNullable<Parameters<typeof googleRtdn>[1]> = {
    serviceClient: () => {dbCalls++; return f.db;}, env: key => key === options.missing ? undefined : key === "GOOGLE_RTDN_AUDIENCE" ? "audience" : "sender@example.test",
    verifyGoogleOidc: async (...args) => {authCalls.push(args); return options.verified ?? true;},
    packageName: () => "com.enescevik.gina", googleApiConfigured: () => options.configured ?? true,
    refreshGoogle: async (_db, _token, opts) => {refreshed++; equal(opts, {revoked: true}); return fakeState;},
    applyStoreState: async () => {applied++; if(options.applyFail) throw new Error(); return {} as never;},
  };
  return {...f, deps, authCalls, counters: () => ({dbCalls, applied, refreshed})};
}
for (const missing of ["GOOGLE_RTDN_AUDIENCE", "GOOGLE_RTDN_SA_EMAIL"]) Deno.test(`Google fails closed without ${missing}`, async () => {
  const f = google({missing}); equal((await googleRtdn(post(envelope()), f.deps)).status, 503); equal(f.counters().dbCalls, 0);
});
Deno.test("Google rejects unauthorized sender before logging or accessing store", async () => {
  const f = google({verified: false}); equal((await googleRtdn(post(envelope()), f.deps)).status, 401); equal(f.counters(), {dbCalls: 0, applied: 0, refreshed: 0});
  equal(f.authCalls[0].slice(1), ["audience", "sender@example.test"]);
});
Deno.test("verified Google revocation hint can refresh and apply state", async () => {
  const f = google(); equal((await googleRtdn(post(envelope()), f.deps)).status, 200); equal(f.counters().applied, 1);
});
for (const body of [null, {}, {message: {messageId: "id", data: "bad"}}, envelope(null), envelope({...googleNotification, packageName: "other"}), envelope({}, ""), envelope({packageName: "com.enescevik.gina"})]) Deno.test(`Google malformed payload cannot occupy an event ID: ${JSON.stringify(body)}`, async () => {
  const f = google(); equal((await googleRtdn(post(body), f.deps)).status, 400); equal(f.calls.length, 0);
});
Deno.test("Google missing store credentials remains retryable", async () => {
  const f = google({configured: false}); equal((await googleRtdn(post(envelope()), f.deps)).status, 503); equal(f.counters().refreshed, 0);
});
Deno.test("Google TEST is accepted without store API credentials or entitlement changes", async () => {
  const f = google({configured: false}); equal((await googleRtdn(post(envelope({packageName: "com.enescevik.gina", testNotification: {}})), f.deps)).status, 200); equal(f.counters().applied, 0);
});
