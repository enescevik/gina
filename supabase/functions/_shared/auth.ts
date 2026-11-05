import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { serviceClient } from "./supabase.ts";
import { fail } from "./error-contract.ts";

export interface ParentContext { familyId: string; userId: string }

/** U08: kimlik sonucu üç ayrı durumla döner. `session_expired` (JWT süresi dolmuş),
 * `unauthorized` (kimlik yok/doğrulanamadı), `forbidden` (kimlik var; rol/aile sınırı). */
export type ParentAccess =
  | { ok: true; parent: ParentContext }
  | { ok: false; code: "unauthorized" | "session_expired" | "forbidden" };

function decodePayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const decoded = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded && typeof decoded === "object" ? decoded : null;
  } catch { return null; }
}

/** Verify the JWT with Auth, then check live membership: deleted/revoked accounts cannot use stale claims. */
export async function readParentAccess(req: Request, db: SupabaseClient = serviceClient()): Promise<ParentAccess> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return { ok: false, code: "unauthorized" };
  const payload = decodePayload(token);
  if (!payload) return { ok: false, code: "unauthorized" };
  // Süresi dolmuş token: Auth'a gitmeden önce ayrılır; istemci oturumu yeniler, tekrar giriş istemez.
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return { ok: false, code: "session_expired" };
  try {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return { ok: false, code: "unauthorized" };
    if (data.user.is_anonymous) return { ok: false, code: "forbidden" };
    if (payload.sub !== data.user.id) return { ok: false, code: "unauthorized" };
    const gina = payload.gina as { role?: unknown; family_id?: unknown } | undefined;
    if (gina?.role !== "parent" || typeof gina.family_id !== "string" || !gina.family_id) return { ok: false, code: "forbidden" };
    const { data: member, error: memberError } = await db.from("family_members").select("family_id")
      .eq("user_id", data.user.id).eq("family_id", gina.family_id).maybeSingle();
    if (memberError || !member) return { ok: false, code: "forbidden" };
    const { data: active, error: activeError } = await db.from("active_families").select("family_id")
      .eq("user_id", data.user.id).maybeSingle();
    if (activeError || (active && active.family_id !== member.family_id)) return { ok: false, code: "forbidden" };
    return { ok: true, parent: { familyId: member.family_id, userId: data.user.id } };
  } catch { return { ok: false, code: "unauthorized" }; }
}

/** Eski imza: ayrım gerekmeyen çağıranlar için null döner. */
export async function readParent(req: Request, db: SupabaseClient = serviceClient()): Promise<ParentContext | null> {
  const access = await readParentAccess(req, db);
  return access.ok ? access.parent : null;
}

/** Sözleşmeli yanıt: 401 `unauthorized` / 401 `session_expired` / 403 `forbidden`. */
export function accessResponse(access: Exclude<ParentAccess, { ok: true }>): Response {
  return fail(access.code, access.code === "forbidden" ? 403 : 401);
}

export async function parentOrResponse(req: Request, db: SupabaseClient = serviceClient()): Promise<ParentContext | Response> {
  const access = await readParentAccess(req, db);
  return access.ok ? access.parent : accessResponse(access);
}
