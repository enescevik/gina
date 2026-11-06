import { createClient } from "npm:@supabase/supabase-js@2";
import { apiKeyOrResponse, resolveAi } from "../_shared/prova.ts";
import { generateWith } from "../_shared/ai-route.ts";
import { json, serviceClient } from "../_shared/supabase.ts";
import { type Caller, createHandler } from "./handler.ts";

function secretMatches(expected: string | undefined, supplied: string): boolean {
  if (!expected || expected.length !== supplied.length) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return difference === 0;
}

const service = serviceClient();
Deno.serve(createHandler({
  service,
  caller: async (req, body): Promise<Caller | null> => {
    const cron = req.headers.get("x-cron-secret");
    if (cron !== null) {
      return secretMatches(Deno.env.get("CONTENT_PREREVIEW_SECRET"), cron) ? { kind: "system" } : null;
    }
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token || body.drain === true || body.pilot === true) return null;
    const { data, error } = await service.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous) return null;
    // Authority is proven in the database: the admin-only RPC also queues the record.
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const requested = await user.rpc("request_content_prereview", { p_kind: body.kind, p_id: body.id });
    if (requested.error || !requested.data) return null;
    return { kind: "admin", userId: data.user.id };
  },
  // C08: secret name from the resolved adapter; no fallback to another provider's key.
  key: (config) => apiKeyOrResponse(config),
  resolve: async () => {
    const { data, error } = await service.from("app_settings").select("value").eq("key", "content_prereview.plan").maybeSingle();
    if (error) return json({ error: "ai_configuration_unavailable" }, 503);
    const plan = typeof data?.value === "string" ? data.value : "pro";
    return resolveAi(service, plan, 1500);
  },
  call: generateWith,
}));
