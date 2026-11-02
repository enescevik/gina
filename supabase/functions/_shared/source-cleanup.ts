import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
export async function cleanupSources(db: SupabaseClient) {
  const { error: expiryError } = await db.rpc(
    "expire_unlinked_learning_sources",
  );
  if (expiryError) throw new Error("source_cleanup_unavailable");
  const { data: queue, error } = await db.from("source_deletion_queue").select(
    "object_path",
  ).order("last_attempt_at", { nullsFirst: true }).order("created_at").limit(
    100,
  );
  if (error) throw new Error("source_cleanup_unavailable");
  let failed = 0;
  for (const item of queue ?? []) {
    const { error: removeError } = await db.storage.from("gina-private-sources")
      .remove([item.object_path]);
    const { error: recordError } = await db.rpc("record_source_cleanup", {
      p_path: item.object_path,
      p_success: !removeError,
    });
    if (removeError || recordError) failed++;
  }
  return { checked: queue?.length ?? 0, failed };
}
