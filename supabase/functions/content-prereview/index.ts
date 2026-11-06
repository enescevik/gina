import { createClient } from "npm:@supabase/supabase-js@2";
import { apiKeyOrResponse, resolveAi } from "../_shared/prova.ts";
import { generateWith } from "../_shared/ai-route.ts";
import { json, serviceClient } from "../_shared/supabase.ts";
import { type Caller, createHandler } from "./handler.ts";
import { resolveCaller } from "./auth.ts";

import { prereviewConfig } from "../_shared/prereview-config.ts";

const service = serviceClient();
Deno.serve(createHandler({
  service,
  caller: (req, body): Promise<Caller | null> =>
    resolveCaller({
      secret: Deno.env.get("CONTENT_PREREVIEW_SECRET"),
      user: async (token) => {
        const { data, error } = await service.auth.getUser(token);
        return error || !data.user ? null : { id: data.user.id, is_anonymous: data.user.is_anonymous };
      },
      // Authority is proven in the database: the role-gated RPC also queues the record.
      request: async (token, kind, id) => {
        const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false },
        });
        const requested = await user.rpc("request_content_prereview", { p_kind: kind, p_id: id });
        return !requested.error && !!requested.data;
      },
    }, req, body),
  // C08: secret name from the resolved adapter; no fallback to another provider's key.
  key: (config) => apiKeyOrResponse(config),
  resolve: async () => {
    const { data, error } = await service.from("app_settings").select("value").eq("key", "content_prereview.plan").maybeSingle();
    if (error) return json({ error: "ai_configuration_unavailable" }, 503);
    const plan = typeof data?.value === "string" ? data.value : "pro";
    const resolved = await resolveAi(service, plan, 1500, "content_prereview");
    if (resolved instanceof Response) return resolved;
    const { data: budget, error: budgetError } = await service.from("app_settings").select("value").eq("key", "content_prereview.max_input_tokens").maybeSingle();
    if (budgetError) return json({ error: "ai_configuration_unavailable" }, 503);
    try { return prereviewConfig(resolved, budget?.value); }
    catch { return json({ error: "ai_configuration_unavailable" }, 503); }
  },
  call: generateWith,
}));
