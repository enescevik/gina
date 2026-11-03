import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
/** Caller must first verify family/question access. Never fetches an arbitrary URL. */
export async function readSourceBlob(
  db: SupabaseClient,
  sourceId: string,
  path: string,
): Promise<Blob> {
  if (!path.startsWith("library/")) {
    const { data, error } = await db.storage.from("gina-private-sources")
      .download(path);
    if (error || !data) throw Error("source_not_ready");
    return data;
  }
  const { data, error } = await db.rpc("read_library_source_bytes", {
    p_source_id: sourceId,
  });
  if (
    error || !data || typeof data.base64 !== "string" ||
    data.base64.length > 750000
  ) throw Error("source_not_ready");
  const bytes = Uint8Array.from(
    atob(data.base64.replace(/\s/g, "")),
    (c) => c.charCodeAt(0),
  );
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (bytes.length !== data.bytes || hash !== data.sha256) {
    throw Error("source_not_ready");
  }
  return new Blob([bytes], { type: "image/png" });
}
export async function libraryDataUri(
  db: SupabaseClient,
  sourceId: string,
  path: string,
): Promise<string> {
  if (!path.startsWith("library/")) throw Error("source_not_ready");
  const bytes = new Uint8Array(
    await (await readSourceBlob(db, sourceId, path)).arrayBuffer(),
  );
  let binary = "";
  for (let n = 0; n < bytes.length; n += 8192) {
    binary += String.fromCharCode(...bytes.subarray(n, n + 8192));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}
