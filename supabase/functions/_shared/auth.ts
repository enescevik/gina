import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { serviceClient } from "./supabase.ts";

export interface ParentContext { familyId: string; userId: string }
export interface AdminContext { userId: string }

/** Verified admin: live Auth user, `gina.admin` claim and a current public.admins row. Never a parent/device token. */
export async function readAdmin(req: Request, db: SupabaseClient = serviceClient()): Promise<AdminContext | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return null;
  try {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous) return null;
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.sub !== data.user.id || payload.gina?.admin !== true) return null;
    const { data: admin, error: adminError } = await db.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (adminError || !admin) return null;
    return { userId: data.user.id };
  } catch { return null; }
}

/** Verify the JWT with Auth, then check live membership: deleted/revoked accounts cannot use stale claims. */
export async function readParent(req: Request, db: SupabaseClient = serviceClient()): Promise<ParentContext | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!token) return null;
  try {
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous) return null;
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.sub !== data.user.id || payload.gina?.role !== "parent" || !payload.gina.family_id) return null;
    const { data: member, error: memberError } = await db.from("family_members").select("family_id")
      .eq("user_id", data.user.id).eq("family_id", payload.gina.family_id).maybeSingle();
    if (memberError || !member) return null;
    const { data: active, error: activeError } = await db.from("active_families").select("family_id")
      .eq("user_id", data.user.id).maybeSingle();
    if (activeError || (active && active.family_id !== member.family_id)) return null;
    return { familyId: member.family_id, userId: data.user.id };
  } catch { return null; }
}
