// H02: admin-only, per-revision extraction of an official ÖDSGM workbook started from the backoffice panel with the
// admin's own session. Deploy: `supabase functions deploy curriculum-source-extract` (verify_jwt stays on).
// Reads the stored original (or the official URL under the acquisition policy), verifies the SHA-256, runs the Deno
// port of the Python extractor and imports review-only candidates. Never approves, publishes or picks a scenario.
import { readAdmin } from "../_shared/auth.ts";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import { handleCurriculumSourceExtract } from "./handler.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  try {
    const db = serviceClient();
    const admin = await readAdmin(req, db);
    return await handleCurriculumSourceExtract(req, { db, admin });
  } catch {
    return json({ error: "source_extract_failed" }, 500);
  }
});
