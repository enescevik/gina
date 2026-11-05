// Admin-only server-side acquisition of official ÖDSGM distribution files (M01).
// Deploy: `supabase functions deploy curriculum-source-fetch` (verify_jwt stays on).
// The caller sends a target (exam family, year, term, subject, optional grade/exam/link); the function reads the
// official index page, follows the meb.ai hop with host/IP checks, downloads the workbook under size/time limits,
// inspects the ZIP directory only, stores the original and records a revision receipt. Same bytes → no new work.
import { readAdmin } from "../_shared/auth.ts";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";
import { handleCurriculumSourceFetch } from "./handler.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  try {
    const db = serviceClient();
    const admin = await readAdmin(req, db);
    return await handleCurriculumSourceFetch(req, { db, admin });
  } catch {
    return json({ error: "source_fetch_failed" }, 500);
  }
});
