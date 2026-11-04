import { readParent } from "../_shared/auth.ts";
import { apiKeyOrResponse } from "../_shared/prova.ts";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import { handleWeeklySummary } from "./handler.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  try {
    return await handleWeeklySummary(req, {
      parent: readParent,
      db: serviceClient(),
      key: apiKeyOrResponse,
    });
  } catch {
    return json({ error: "weekly_unavailable" }, 503);
  }
});
