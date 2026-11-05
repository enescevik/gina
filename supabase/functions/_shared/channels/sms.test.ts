// Fake HTTP SMS gateway only (--allow-net=127.0.0.1). No real provider, no real number.
import { assert, assertEquals } from "jsr:@std/assert";
import { httpSmsAdapter, smsAdapterFromEnv } from "./sms.ts";

const message = { to: "+905551112233", from: "GINA", text: "GINA dogrulama kodu: 123456 (15 dk gecerli).", idempotencyKey: "gina-channel-7" };

async function fakeGateway(handler: (body: Record<string, unknown>, n: number) => Response | Promise<Response>) {
  let n = 0;
  const bodies: Record<string, unknown>[] = [];
  const server = Deno.serve({ hostname: "127.0.0.1", port: 0, onListen() {} }, async (req) => {
    const body = await req.json() as Record<string, unknown>;
    bodies.push({ ...body, auth: req.headers.get("authorization"), key: req.headers.get("idempotency-key") });
    return await handler(body, ++n);
  });
  return { endpoint: `http://127.0.0.1:${server.addr.port}/sms`, bodies, close: () => server.shutdown() };
}

Deno.test("sms: acceptance maps message_id; reference equals the idempotency key", async () => {
  const g = await fakeGateway(() => Response.json({ message_id: "sms-1" }));
  try {
    const r = await httpSmsAdapter({ endpoint: g.endpoint, apiKey: "k" }).send(message);
    assert(r.ok && r.providerMessageId === "sms-1");
    assertEquals(g.bodies[0].reference, "gina-channel-7");
    assertEquals(g.bodies[0].key, "gina-channel-7");
    assertEquals(g.bodies[0].auth, "Bearer k");
  } finally {
    await g.close();
  }
});

Deno.test("sms: 429 retry with Retry-After, 503 retry, 400 permanent, timeout retry", async () => {
  const g = await fakeGateway(async (_b, n) => {
    if (n === 1) return new Response(JSON.stringify({ code: "too_many" }), { status: 429, headers: { "retry-after": "30" } });
    if (n === 2) return new Response("", { status: 503 });
    if (n === 3) return new Response(JSON.stringify({ error: "invalid_number" }), { status: 400 });
    await new Promise((r) => setTimeout(r, 300));
    return Response.json({ id: "late" });
  });
  try {
    const a = httpSmsAdapter({ endpoint: g.endpoint, apiKey: "k", timeoutMs: 60 });
    const r1 = await a.send(message);
    assert(!r1.ok && r1.retry && r1.retryAfterSeconds === 30 && r1.error === "sms:http_429:too_many");
    const r2 = await a.send(message);
    assert(!r2.ok && r2.retry && r2.error === "sms:http_503");
    const r3 = await a.send(message);
    assert(!r3.ok && !r3.retry && r3.error === "sms:http_400:invalid_number");
    const r4 = await a.send(message);
    assert(!r4.ok && r4.retry && r4.error === "sms:timeout");
    assert(!JSON.stringify([r1, r2, r3, r4]).includes("5551112233"), "number never echoed in errors");
  } finally {
    await g.close();
    await new Promise((r) => setTimeout(r, 350));
  }
});

Deno.test("sms factory: env names only; Turkish provider not selected yet", () => {
  const env = (values: Record<string, string>) => ({ get: (k: string) => values[k] });
  assertEquals(smsAdapterFromEnv("http", env({})), { adapter: null, missing: ["SMS_API_URL", "SMS_API_KEY"] });
  assertEquals(smsAdapterFromEnv("http", env({ SMS_API_URL: "https://x.invalid", SMS_API_KEY: "k" })).adapter?.provider, "http");
  assertEquals(smsAdapterFromEnv(null, env({})), { adapter: null, missing: ["provider_not_selected"] });
});
