import { assert, assertEquals } from "jsr:@std/assert";
import { authorizedBearer, bearerToken, timingSafeEqual } from "./auth.ts";

Deno.test("timingSafeEqual: equal strings true, differing or shifted false", () => {
  assert(timingSafeEqual("secret-value", "secret-value"));
  assert(!timingSafeEqual("secret-value", "secret-valuf"));
  assert(!timingSafeEqual("secret-value", "secret-valu"));
  assert(!timingSafeEqual("", "a"));
  assert(timingSafeEqual("", ""));
  assert(timingSafeEqual("çok-gizli", "çok-gizli"));
  assert(!timingSafeEqual("çok-gizli", "cok-gizli"));
});

Deno.test("timingSafeEqual: work is proportional to the longer input, not to the first mismatch", () => {
  // Statistical sanity check (not a proof): a mismatch at byte 0 and at the last byte take comparable time.
  const base = "x".repeat(4096);
  const early = "y" + base.slice(1), late = base.slice(0, -1) + "y";
  const time = (b: string) => {
    const t = performance.now();
    for (let i = 0; i < 2000; i++) timingSafeEqual(base, b);
    return performance.now() - t;
  };
  time(early);
  time(late); // warm-up
  const e = time(early), l = time(late);
  assert(Math.min(e, l) / Math.max(e, l) > 0.5, `early=${e.toFixed(1)}ms late=${l.toFixed(1)}ms`);
});

Deno.test("bearerToken parses the Authorization header", () => {
  assertEquals(bearerToken("Bearer abc"), "abc");
  assertEquals(bearerToken("bearer   abc "), "abc");
  assertEquals(bearerToken("Basic abc"), "");
  assertEquals(bearerToken(null), "");
  assertEquals(bearerToken("Bearer"), "");
});

Deno.test("authorizedBearer: either configured secret is accepted (existing contract), nothing else", () => {
  const secrets = ["push-secret-1234567890", "service-role-key-0987654321"];
  assert(authorizedBearer("Bearer push-secret-1234567890", secrets));
  assert(authorizedBearer("Bearer service-role-key-0987654321", secrets));
  assert(!authorizedBearer("Bearer push-secret-123456789", secrets));
  assert(!authorizedBearer("Bearer push-secret-1234567890x", secrets));
  assert(!authorizedBearer("Bearer ", secrets));
  assert(!authorizedBearer(null, secrets));
});

Deno.test("authorizedBearer: unset secrets are ignored; no secret configured means fail closed", () => {
  assert(authorizedBearer("Bearer only-one", [undefined, "only-one"]));
  assert(!authorizedBearer("Bearer undefined", [undefined, undefined]));
  assert(!authorizedBearer("Bearer ", ["", undefined]));
  assert(!authorizedBearer("Bearer anything", []));
});
