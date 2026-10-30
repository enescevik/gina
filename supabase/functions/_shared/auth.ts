import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { serviceClient } from "./supabase.ts";

export interface ParentContext { familyId: string; userId: string }

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
    return { familyId: member.family_id, userId: data.user.id };
  } catch { return null; }
}
