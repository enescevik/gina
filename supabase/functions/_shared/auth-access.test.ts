import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { accessResponse, parentOrResponse, readParentAccess } from "./auth.ts";
import { isContractBody } from "./error-contract.ts";
const b64 = (v: unknown) => btoa(JSON.stringify(v)).replace(/=+$/, "");
function fixture({ valid = true, member = true, anonymous = false } = {}) {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: () => ({ data: member ? { family_id: "family" } : null, error: null }) };
  return {
    auth: { getUser: () => ({ data: { user: valid ? { id: "owner", is_anonymous: anonymous } : null }, error: valid ? null : {} }) },
    from: () => chain,
  } as unknown as SupabaseClient;
}
const req = (payload: Record<string, unknown> | null, header = true) =>
  new Request("https://local", header && payload ? { headers: { authorization: `Bearer h.${b64(payload)}.s` } } : {});
const parent = { sub: "owner", gina: { role: "parent", family_id: "family" } };
Deno.test("U08: session_expired, unauthorized and permission_denied are separated", async () => {
  const expired = await readParentAccess(req({ ...parent, exp: Math.floor(Date.now() / 1000) - 5 }), fixture());
  if (expired.ok || expired.code !== "session_expired") throw Error("expired token not classified");
  const fresh = await readParentAccess(req({ ...parent, exp: Math.floor(Date.now() / 1000) + 60 }), fixture());
  if (!fresh.ok) throw Error("valid token rejected");
  for (const [access, code] of [
    [await readParentAccess(req(null, false), fixture()), "unauthorized"],
    [await readParentAccess(req(parent), fixture({ valid: false })), "unauthorized"],
    [await readParentAccess(req({ ...parent, sub: "victim" }), fixture()), "unauthorized"],
    [await readParentAccess(req({ ...parent, gina: { role: "device", family_id: "family" } }), fixture()), "forbidden"],
    [await readParentAccess(req(parent), fixture({ member: false })), "forbidden"],
    [await readParentAccess(req(parent), fixture({ anonymous: true })), "forbidden"],
  ] as const) {
    if (access.ok || access.code !== code) throw Error(`expected ${code}, got ${JSON.stringify(access)}`);
    const res = accessResponse(access);
    const body = await res.json();
    if (!isContractBody(body)) throw Error("response does not follow the contract");
    const expected = code === "forbidden" ? ["permission_denied", 403] : [code, 401];
    if (body.category !== expected[0] || res.status !== expected[1] || body.error !== code || body.retryable !== false) {
      throw Error(`wrong mapping for ${code}: ${res.status} ${JSON.stringify(body)}`);
    }
  }
  const ok = await parentOrResponse(req(parent), fixture());
  if (ok instanceof Response || ok.familyId !== "family") throw Error("parentOrResponse rejected a valid parent");
});
