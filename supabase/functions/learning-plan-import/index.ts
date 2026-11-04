import { preflight, serviceClient } from "../_shared/supabase.ts";
import { apiKeyOrResponse, readParent } from "../_shared/prova.ts";
import { handleLearningPlanImport } from "./handler.ts";
Deno.serve((req) =>
  req.method === "OPTIONS" ? preflight() : handleLearningPlanImport(req, {
    db: serviceClient(),
    parent: readParent,
    key: apiKeyOrResponse,
  })
);
