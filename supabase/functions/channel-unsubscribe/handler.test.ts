import { assert, assertEquals } from "jsr:@std/assert";
import { type ApplyResult, handleUnsubscribe, isOneClickBody, reasonFromError, type UnsubscribeDependencies } from "./handler.ts";

const TOKEN = "MDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAxOmVtYWlsOmFubm91bmNlbWVudDoxNzk1MDAwMDAw.0123456789abcdef0123456789abcdef01234567";
const BASE = "https://edge.example.invalid/functions/v1/channel-unsubscribe";

/** In-memory stand-in for public.channel_one_click_unsubscribe: HMAC/expiry decided by a fixed table, single use. */
function fakeDb(results: Record<string, "valid" | "expired" | "invalid"> = { [TOKEN]: "valid" }) {
  const used = new Set<string>();
  const calls: string[] = [];
  const d: UnsubscribeDependencies = {
    pageUrl: null,
    apply(token): Promise<ApplyResult> {
      calls.push(token);
      const kind = results[token] ?? "invalid";
      if (kind !== "valid") return Promise.resolve({ ok: false, reason: kind });
      const status = used.has(token) ? "already_done" : "unsubscribed";
      used.add(token);
      return Promise.resolve({ ok: true, status, channel: "email", purpose: "announcement" });
    },
  };
  return { d, calls, used };
}
const post = (token: string, body: BodyInit | null, type = "application/x-www-form-urlencoded", extra: Record<string, string> = {}) =>
  new Request(`${BASE}?token=${encodeURIComponent(token)}`, { method: "POST", body, headers: { "content-type": type, ...extra } });

Deno.test("RFC 8058 one-click POST unsubscribes once; a replayed POST is a no-op success", async () => {
  const { d, calls } = fakeDb();
  const first = await handleUnsubscribe(post(TOKEN, "List-Unsubscribe=One-Click"), d);
  assertEquals([first.status, await first.text()], [200, "unsubscribed"]);
  const again = await handleUnsubscribe(post(TOKEN, "List-Unsubscribe=One-Click"), d);
  assertEquals([again.status, await again.text()], [200, "already_unsubscribed"]);
  assertEquals(calls.length, 2, "the database decides single use; the endpoint does not cache");
  assertEquals(first.headers.get("cache-control"), "no-store");
});

Deno.test("multipart one-click body is accepted; other bodies and types are refused without touching the database", async () => {
  const { d, calls } = fakeDb();
  const form = new FormData();
  form.set("List-Unsubscribe", "One-Click");
  const multipart = await handleUnsubscribe(new Request(`${BASE}?token=${TOKEN}`, { method: "POST", body: form }), d);
  assertEquals(multipart.status, 200);
  for (const [body, type] of [["", "application/x-www-form-urlencoded"], ["List-Unsubscribe=Yes", "application/x-www-form-urlencoded"], ['{"List-Unsubscribe":"One-Click"}', "application/json"], ["List-Unsubscribe=One-Click", "text/plain"]]) {
    const r = await handleUnsubscribe(post(TOKEN, body, type), d);
    assertEquals([r.status, await r.text()], [400, "one_click_body_required"], `${type} ${body}`);
  }
  assertEquals(calls.length, 1);
});

Deno.test("GET and HEAD never unsubscribe (link scanners): redirect to the page or show a POST form", async () => {
  const { d, calls } = fakeDb();
  const page = await handleUnsubscribe(new Request(`${BASE}?token=${TOKEN}`), d);
  assertEquals(page.status, 200);
  const html = await page.text();
  assert(html.includes('method="post"') && html.includes('name="List-Unsubscribe" value="One-Click"'));
  assert(page.headers.get("content-security-policy")?.includes("form-action 'self'"));
  const head = await handleUnsubscribe(new Request(`${BASE}?token=${TOKEN}`, { method: "HEAD" }), d);
  assertEquals(head.status, 200);
  const redirect = await handleUnsubscribe(new Request(`${BASE}?token=${TOKEN}`), { ...d, pageUrl: "https://app.example.invalid/unsubscribe" });
  assertEquals(redirect.status, 303);
  assertEquals(redirect.headers.get("location"), `https://app.example.invalid/unsubscribe?token=${TOKEN}`);
  assertEquals(calls.length, 0, "no side effect on GET/HEAD");
});

Deno.test("signature, expiry and format: invalid 400, expired 410, malformed never reaches the database", async () => {
  const tampered = TOKEN.slice(0, -1) + "8";
  const expired = TOKEN.replace("MDAw", "MDEw");
  const { d, calls } = fakeDb({ [TOKEN]: "valid", [tampered]: "invalid", [expired]: "expired" });
  const bad = await handleUnsubscribe(post(tampered, "List-Unsubscribe=One-Click"), d);
  assertEquals([bad.status, await bad.text()], [400, "unsubscribe_invalid"]);
  const old = await handleUnsubscribe(post(expired, "List-Unsubscribe=One-Click"), d);
  assertEquals([old.status, await old.text()], [410, "unsubscribe_expired"]);
  for (const t of ["", "short.abc", `${"a".repeat(30)}.${"G".repeat(40)}`, `<script>.${"a".repeat(40)}`]) {
    const r = await handleUnsubscribe(post(t, "List-Unsubscribe=One-Click"), d);
    assertEquals(r.status, 400, t);
  }
  assertEquals(calls, [tampered, expired]);
});

Deno.test("oversized body, other methods and database outage are bounded and never echo the token", async () => {
  const { d } = fakeDb();
  const big = await handleUnsubscribe(post(TOKEN, "List-Unsubscribe=One-Click&x=" + "a".repeat(4000)), d);
  assertEquals(big.status, 413);
  const put = await handleUnsubscribe(new Request(`${BASE}?token=${TOKEN}`, { method: "PUT" }), d);
  assertEquals([put.status, put.headers.get("allow")], [405, "GET, HEAD, POST"]);
  const down = await handleUnsubscribe(post(TOKEN, "List-Unsubscribe=One-Click"), { ...d, apply: () => Promise.reject(new Error("db down " + TOKEN)) });
  const body = await down.text();
  assertEquals([down.status, down.headers.get("retry-after")], [503, "60"]);
  assert(!body.includes(TOKEN));
});

Deno.test("database error messages map to public reasons only", () => {
  assertEquals(reasonFromError("unsubscribe_invalid"), "invalid");
  assertEquals(reasonFromError("unsubscribe_expired"), "expired");
  assertEquals(reasonFromError("permission denied for function"), "unavailable");
  assertEquals(reasonFromError(undefined), "unavailable");
  assert(isOneClickBody("application/x-www-form-urlencoded; charset=utf-8", "a=1&List-Unsubscribe=One-Click"));
});
