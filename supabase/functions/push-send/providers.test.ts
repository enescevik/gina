import { assert, assertEquals } from "jsr:@std/assert";
import {
  type ApnsConfig,
  type FcmConfig,
  retryAfterSeconds,
  sendApns,
  sendFcm,
} from "./providers.ts";
import { messageFor } from "./messages.ts";
async function pem(algorithm: EcKeyGenParams | RsaHashedKeyGenParams) {
  const pair = await crypto.subtle.generateKey(algorithm, true, [
    "sign",
    "verify",
  ]) as CryptoKeyPair;
  const bytes = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", pair.privateKey),
  );
  return "-----BEGIN PRIVATE KEY-----\n" + btoa(String.fromCharCode(...bytes)) +
    "\n-----END PRIVATE KEY-----";
}
const apns: ApnsConfig = {
  keyP8: await pem({ name: "ECDSA", namedCurve: "P-256" }),
  keyId: "qa-key",
  teamId: "qa-team",
  bundleId: "qa.app",
  sandbox: true,
};
const fcm: FcmConfig = {
  projectId: "qa-project",
  clientEmail: "qa@example.invalid",
  privateKey: await pem({
    name: "RSASSA-PKCS1-v1_5",
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256",
  }),
};
const msg = (id: number) =>
  messageFor({ id, kind: "cohort_results", payload: {} }, "tr");
Deno.test("APNs retry shares event identity; different Provas do not collapse by kind", async () => {
  const original = globalThis.fetch,
    ids: string[] = [],
    signals: boolean[] = [];
  globalThis.fetch = (_url, init) => {
    ids.push(new Headers(init?.headers).get("apns-collapse-id")!);
    signals.push(!!init?.signal);
    return Promise.resolve(new Response("", { status: 200 }));
  };
  try {
    await sendApns(apns, "synthetic-token", msg(1));
    await sendApns(apns, "synthetic-token", msg(1));
    await sendApns(apns, "synthetic-token", msg(2));
    assertEquals(ids, ["gina-1", "gina-1", "gina-2"]);
    assert(signals.every(Boolean));
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("APNs wrong environment/topic does not delete a potentially valid token", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(
      Response.json({ reason: "BadDeviceToken" }, { status: 400 }),
    );
  try {
    const r = await sendApns(apns, "synthetic-token", msg(1));
    assertEquals(r, {
      ok: false,
      gone: false,
      retry: false,
      error: "apns:BadDeviceToken",
    });
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("APNs unregistered is terminal while server error is retryable", async () => {
  const original = globalThis.fetch;
  let gone = true;
  globalThis.fetch = () =>
    Promise.resolve(
      Response.json({ reason: gone ? "Unregistered" : "InternalServerError" }, {
        status: gone ? 410 : 500,
      }),
    );
  try {
    let r = await sendApns(apns, "synthetic-token", msg(1));
    assert(!r.ok && r.gone && !r.retry);
    gone = false;
    r = await sendApns(apns, "synthetic-token", msg(1));
    assert(!r.ok && !r.gone && r.retry);
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("provider exception text never includes the raw device URL/token", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.reject(Error("https://provider.invalid/SECRET_DEVICE_TOKEN"));
  try {
    const r = await sendApns(apns, "synthetic-token", msg(1));
    assertEquals(r, {
      ok: false,
      gone: false,
      retry: true,
      error: "apns:network_or_config_error",
    });
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("FCM generic project 404 does not delete device registration", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (url) =>
    Promise.resolve(
      String(url).includes("oauth2")
        ? Response.json({ access_token: "synthetic", expires_in: 3600 })
        : Response.json({ error: { status: "NOT_FOUND" } }, { status: 404 }),
    );
  try {
    const r = await sendFcm(fcm, "synthetic-token", msg(1));
    assertEquals(r, {
      ok: false,
      gone: false,
      retry: false,
      error: "fcm:NOT_FOUND",
    });
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("FCM unregistered can remove the old token", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (url) =>
    Promise.resolve(
      String(url).includes("oauth2")
        ? Response.json({ access_token: "synthetic", expires_in: 3600 })
        : Response.json({
          error: {
            status: "NOT_FOUND",
            details: [{ errorCode: "UNREGISTERED" }],
          },
        }, { status: 404 }),
    );
  try {
    const r = await sendFcm(fcm, "synthetic-token", msg(1));
    assert(!r.ok && r.gone && !r.retry);
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("FCM displayed retry uses stable event tag and bounded request", async () => {
  const original = globalThis.fetch;
  let tag = "", bounded = false;
  globalThis.fetch = (url, init) => {
    if (String(url).includes("oauth2")) {
      return Promise.resolve(
        Response.json({ access_token: "synthetic", expires_in: 3600 }),
      );
    }
    tag = JSON.parse(init?.body as string).message.android.notification.tag;
    bounded = !!init?.signal;
    return Promise.resolve(Response.json({ name: "synthetic-accepted" }));
  };
  try {
    assertEquals(await sendFcm(fcm, "synthetic-token", msg(5)), { ok: true });
    assertEquals(tag, "gina-5");
    assert(bounded);
  } finally {
    globalThis.fetch = original;
  }
});

Deno.test("Retry-After seconds and dates are parsed and invalid headers ignored", () => {
  assertEquals(
    retryAfterSeconds(
      new Response(null, { headers: { "retry-after": "3600" } }),
    ),
    3600,
  );
  const date = new Date(Date.now() + 120000).toUTCString();
  const delay = retryAfterSeconds(
    new Response(null, { headers: { "retry-after": date } }),
  )!;
  assert(delay >= 119 && delay <= 120);
  assertEquals(
    retryAfterSeconds(
      new Response(null, { headers: { "retry-after": "invalid" } }),
    ),
    undefined,
  );
});
