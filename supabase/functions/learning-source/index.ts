import { libraryDataUri } from "../_shared/library-source.ts";
import { cleanupSources } from "../_shared/source-cleanup.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { readParent } from "../_shared/auth.ts";
import { inspectSource } from "../_shared/source-file.ts";
import { json, preflight, serviceClient } from "../_shared/supabase.ts";
const BUCKET = "gina-private-sources";
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const raw = await req.text();
    if (raw.length > 4096) return json({ error: "invalid_input" }, 400);
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      return json({ error: "invalid_input" }, 400);
    }
    if (!input || !uuid(input.id)) return json({ error: "invalid_input" }, 400);
    const token = req.headers.get("authorization") ?? "";
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: token } },
        auth: { persistSession: false },
      },
    );
    const db = serviceClient();
    if (input.action === "view") {
      if (input.question_id !== undefined && !uuid(input.question_id)) {
        return json({ error: "invalid_input" }, 400);
      }
      const { data: source, error } = await caller.rpc(
        "get_learning_source_access",
        { p_source_id: input.id, p_question_id: input.question_id ?? null },
      );
      if (error || !source) return json({ error: "source_not_available" }, 403);
      if (source.object_path.startsWith("library/")) {
        return json({
          url: await libraryDataUri(db, source.id, source.object_path),
          mime: source.mime,
          name: source.name,
          expires_in: 120,
        });
      }
      const { data, error: signedError } = await db.storage.from(BUCKET)
        .createSignedUrl(source.object_path, 120);
      if (signedError || !data) {
        return json({ error: "source_not_available" }, 503);
      }
      return json({
        url: data.signedUrl,
        mime: source.mime,
        name: source.name,
        expires_in: 120,
      });
    }
    const parent = await readParent(req, db);
    if (!parent) return json({ error: "forbidden" }, 403);
    if (input.action === "reserve") {
      if (!Deno.env.get("SOURCE_CLEANUP_SECRET")) {
        return json({ error: "source_unavailable" }, 503);
      }
      const { data: source, error } = await caller.rpc(
        "reserve_learning_source",
        {
          p_id: input.id,
          p_kind: input.kind,
          p_name: input.name,
          p_mime: input.mime,
          p_bytes: input.bytes,
          p_sha256: input.sha256,
          p_consent: input.consent === true,
        },
      );
      if (error || !source) {
        const code = error?.message ?? "source_failed";
        return json({
          error: /^(source_[a-z_]+|request_conflict)$/.test(code)
            ? code
            : "source_failed",
        }, 400);
      }
      if (source.status === "ready") {
        return json({ id: source.id, ready: true });
      }
      if (source.status !== "awaiting_upload") {
        return json({ error: "source_invalid" }, 400);
      }
      const { data, error: uploadError } = await db.storage.from(BUCKET)
        .createSignedUploadUrl(source.object_path, { upsert: false });
      if (uploadError || !data) {
        return json({ error: "source_upload_failed" }, 503);
      }
      return json({
        id: source.id,
        bucket: BUCKET,
        path: source.object_path,
        token: data.token,
      });
    }
    if (input.action === "finalize") {
      const { data: source, error } = await db.from("learning_sources").select(
        "*",
      ).eq("id", input.id).eq("family_id", parent.familyId).maybeSingle();
      if (error || !source) return json({ error: "source_not_available" }, 404);
      if (source.status === "ready") {
        return json({
          id: source.id,
          ready: true,
          width: source.width,
          height: source.height,
          pages: source.pages,
        });
      }
      if (source.status !== "awaiting_upload") {
        return json({ error: "source_invalid" }, 400);
      }
      const { data: blob, error: downloadError } = await db.storage.from(BUCKET)
        .download(source.object_path);
      if (downloadError || !blob) {
        return json({ error: "source_upload_incomplete" }, 409);
      }
      let info;
      try {
        if (blob.size !== source.bytes) throw new Error("source_changed");
        info = await inspectSource(
          new Uint8Array(await blob.arrayBuffer()),
          source.mime,
        );
        if (info.hash !== source.sha256) throw new Error("source_changed");
      } catch (e) {
        await db.from("learning_sources").update({ status: "invalid" }).eq(
          "id",
          source.id,
        ).eq("status", "awaiting_upload");
        await db.from("source_deletion_queue").upsert({
          object_path: source.object_path,
        }, { onConflict: "object_path", ignoreDuplicates: true });
        const message = e instanceof Error ? e.message : "source_invalid";
        return json({
          error: /^source_[a-z_]+$/.test(message) ? message : "source_invalid",
        }, 400);
      }
      const { data: saved, error: saveError } = await db.from(
        "learning_sources",
      ).update({
        status: "ready",
        width: info.width,
        height: info.height,
        pages: info.pages,
        verified_at: new Date().toISOString(),
      }).eq("id", source.id).eq("status", "awaiting_upload").select("id")
        .maybeSingle();
      if (saveError) return json({ error: "source_failed" }, 503);
      if (!saved) {
        const { data: confirmed, error: confirmError } = await db.from(
          "learning_sources",
        ).select("status,sha256").eq("id", source.id).eq(
          "family_id",
          parent.familyId,
        ).maybeSingle();
        if (
          confirmError || confirmed?.status !== "ready" ||
          confirmed.sha256 !== source.sha256
        ) return json({ error: "source_failed" }, 503);
      }
      return json({
        id: source.id,
        ready: true,
        width: info.width,
        height: info.height,
        pages: info.pages,
      });
    }
    if (input.action === "delete") {
      const { error } = await caller.rpc("delete_learning_source", {
        p_source_id: input.id,
      });
      if (error) {
        return json({
          error: error.message === "question_in_use"
            ? "question_in_use"
            : "source_failed",
        }, 409);
      }
      // Metadata has already revoked access; failed physical cleanup remains queued.
      try {
        await cleanupSources(db);
      } catch { /* Hourly worker retries without restoring access. */ }
      return json({ ok: true });
    }
    return json({ error: "invalid_input" }, 400);
  } catch {
    return json({ error: "source_failed" }, 500);
  }
});
