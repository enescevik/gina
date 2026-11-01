import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";

/** No caller-supplied user ID. Only the authenticated, non-anonymous account may be deleted. */
export async function deleteAccount(req: Request, dependencies?: { db: SupabaseClient; reauth: SupabaseClient }): Promise<Response> {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token) return json({ error: "forbidden" }, 403);
    const db = dependencies?.db ?? serviceClient();
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user?.email || user.is_anonymous) return json({ error: "forbidden" }, 403);
    const raw = await req.text();
    if (raw.length > 8192) return json({ error: "invalid_input" }, 400);
    let input;
    try { input = JSON.parse(raw); } catch { return json({ error: "invalid_input" }, 400); }
    if (input?.confirm !== true) return json({ error: "invalid_input" }, 400);
    let auth: SupabaseClient | undefined;
    if(input.reauthentication==='email_otp'){
      // getUser(token) above verifies the JWT. Token issue time is NOT fresh authentication.
      let claims;try{claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));}catch{return json({error:'reauthentication_failed'},403);}
      const now=Math.floor(Date.now()/1000);
      if(claims.sub!==user.id||!Array.isArray(claims.amr)||!claims.amr.some((a:{method?:string;timestamp?:number})=>a.method==='otp'&&typeof a.timestamp==='number'&&a.timestamp<=now&&now-a.timestamp<=300))return json({error:'reauthentication_failed'},403);
    }else{
      if(typeof input.password !== "string" || !input.password || input.password.length > 1024) return json({ error: "invalid_input" }, 400);
      auth = dependencies?.reauth ?? createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const verified = await auth.auth.signInWithPassword({ email: user.email, password: input.password });
      if (verified.error || verified.data.user?.id !== user.id) return json({ error: "reauthentication_failed" }, 403);
    }
    // The auth.users trigger transfers shared ownership or cascades the last parent's family, atomically.
    const { error } = await db.auth.admin.deleteUser(user.id, false);
    if (error) { await auth?.auth.signOut({ scope: "local" }); return json({ error: "deletion_failed" }, 500); }
    return json({ ok: true });
  } catch { return json({ error: "deletion_failed" }, 500); }
}
