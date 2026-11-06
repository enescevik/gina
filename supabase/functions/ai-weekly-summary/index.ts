import { fail } from "../_shared/error-contract.ts";
import { parentOrResponse } from "../_shared/auth.ts";
import { apiKeyOrResponse } from "../_shared/prova.ts";
import { preflight, serviceClient } from "../_shared/supabase.ts";
import { handleWeeklySummary } from "./handler.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  try {
    return await handleWeeklySummary(req, {
      parent: (req) => parentOrResponse(req),
      db: serviceClient(),
      key: apiKeyOrResponse,
    });
  } catch {
    return fail("weekly_unavailable", 503);
  }
});
