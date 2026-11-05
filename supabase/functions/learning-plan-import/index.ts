import { preflight, serviceClient } from "../_shared/supabase.ts";
import { apiKeyOrResponse } from "../_shared/prova.ts";
import { parentOrResponse } from "../_shared/auth.ts";
import { handleLearningPlanImport } from "./handler.ts";
Deno.serve((req) =>
  req.method === "OPTIONS" ? preflight() : handleLearningPlanImport(req, {
    db: serviceClient(),
    parent: (r) => parentOrResponse(r),
    key: apiKeyOrResponse,
  })
);
