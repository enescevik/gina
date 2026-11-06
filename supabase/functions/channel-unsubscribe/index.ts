// C10: public one-click unsubscribe endpoint (verify_jwt = false; the signed token is the authority).
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional CHANNEL_UNSUBSCRIBE_PAGE_URL (web page for GET).
import { serviceClient } from "../_shared/supabase.ts";
import { type ApplyResult, handleUnsubscribe, reasonFromError } from "./handler.ts";

Deno.serve((req) =>
  handleUnsubscribe(req, {
    pageUrl: Deno.env.get("CHANNEL_UNSUBSCRIBE_PAGE_URL") || null,
    async apply(token): Promise<ApplyResult> {
      const r = await serviceClient().rpc("channel_one_click_unsubscribe", { p_token: token });
      if (r.error) return { ok: false, reason: reasonFromError(r.error.message) };
      const data = r.data as { status?: string; channel?: string; purpose?: string } | null;
      if (!data || (data.status !== "unsubscribed" && data.status !== "already_done")) return { ok: false, reason: "unavailable" };
      return { ok: true, status: data.status, channel: String(data.channel), purpose: String(data.purpose) };
    },
  })
);
