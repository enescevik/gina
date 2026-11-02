import { cleanupSources } from "../_shared/source-cleanup.ts";
import { json, serviceClient } from "../_shared/supabase.ts";
Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const secret = Deno.env.get("SOURCE_CLEANUP_SECRET");
  const supplied = req.headers.get("x-cron-secret") ?? "";
  if (!secret || secret.length !== supplied.length) {
    return json({ error: "forbidden" }, 403);
  }
  let difference = 0;
  for (let i = 0; i < secret.length; i++) {
    difference |= secret.charCodeAt(i) ^ supplied.charCodeAt(i);
  }
  if (difference) return json({ error: "forbidden" }, 403);
  try {
    const result = await cleanupSources(serviceClient());
    return json(
      { ok: result.failed === 0, ...result },
      result.failed ? 503 : 200,
    );
  } catch {
    return json({ error: "source_cleanup_failed" }, 503);
  }
});
