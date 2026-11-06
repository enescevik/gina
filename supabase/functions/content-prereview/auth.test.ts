import { resolveCaller, secretMatches } from "./auth.ts";

function assert(value: unknown, message = "assertion failed"): asserts value {
  if (!value) throw Error(message);
}
const SECRET = "s".repeat(64);
const req = (headers: Record<string, string>) => new Request("https://edge.local/content-prereview", { method: "POST", headers });
function deps(over: Partial<{ secret: string | undefined; anonymous: boolean; validUser: boolean; rpcOk: boolean }> = {}) {
  const log: string[] = [];
  return {
    log,
    deps: {
      secret: "secret" in over ? over.secret : SECRET,
      user: async (token: string) => {
        log.push(`user:${token}`);
        return over.validUser === false ? null : { id: "u1", is_anonymous: over.anonymous ?? false };
      },
      request: async (_t: string, kind: unknown, id: unknown) => {
        log.push(`request:${kind}:${id}`);
        return over.rpcOk ?? true;
      },
    },
  };
}
const body = { kind: "curriculum_candidate", id: "6d4399b9-46b1-47ba-bc6b-5558f48c4c7b" };

Deno.test("H07 secretMatches: exact match only; unset secret rejects everything", () => {
  assert(secretMatches(SECRET, SECRET));
  assert(!secretMatches(SECRET, SECRET.slice(1) + "t"));
  assert(!secretMatches(SECRET, SECRET.slice(1)));
  assert(!secretMatches(undefined, ""));
  assert(!secretMatches("", ""));
});

Deno.test("H07 system caller needs the exact cron secret; a wrong secret never falls through to the user path", async () => {
  const ok = deps();
  assert((await resolveCaller(ok.deps, req({ "x-cron-secret": SECRET }), { drain: true }))?.kind === "system");
  const wrong = deps();
  assert(await resolveCaller(wrong.deps, req({ "x-cron-secret": "nope", authorization: "Bearer t" }), body) === null);
  assert(wrong.log.length === 0, "no user lookup / queueing with a bad cron secret");
  const unset = deps({ secret: undefined });
  assert(await resolveCaller(unset.deps, req({ "x-cron-secret": "" }), { drain: true }) === null, "unset secret + empty header");
});

Deno.test("H07 user caller: token required, anonymous / invalid / unauthorized role rejected, drain and pilot refused", async () => {
  assert(await resolveCaller(deps().deps, req({}), body) === null, "no token");
  assert(await resolveCaller(deps({ validUser: false }).deps, req({ authorization: "Bearer t" }), body) === null, "invalid token");
  assert(await resolveCaller(deps({ anonymous: true }).deps, req({ authorization: "Bearer t" }), body) === null, "anonymous user");
  assert(await resolveCaller(deps({ rpcOk: false }).deps, req({ authorization: "Bearer t" }), body) === null, "role RPC refused");
  for (const extra of [{ drain: true }, { pilot: true, confirm_paid: true }]) {
    const d = deps();
    assert(await resolveCaller(d.deps, req({ authorization: "Bearer t" }), { ...body, ...extra }) === null, JSON.stringify(extra));
    assert(d.log.length === 0, "system modes never reach auth or the queue with a user token");
  }
  const good = deps();
  const caller = await resolveCaller(good.deps, req({ authorization: "Bearer t" }), body);
  assert(caller?.kind === "admin" && good.log.join("|") === `user:t|request:${body.kind}:${body.id}`);
});
