import { type AiUserContent } from "./prova.ts";
import { json, serviceClient } from "./supabase.ts";
/** Never accepts a client URL: only a verified, private document belonging to this family. */
export async function provaDocument(
  db: ReturnType<typeof serviceClient>,
  familyId: string,
  userId: string,
  requestId: string,
  sourceId: unknown,
  consent: unknown,
  purpose: "generate" | "setup" = "generate",
): Promise<
  | { media: Exclude<AiUserContent, string>; id: string; sha256: string }
  | Response
> {
  if (
    typeof sourceId !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(sourceId)
  ) return json({ error: "invalid_input" }, 400);
  if (consent !== true) {
    return json({ error: "source_ai_consent_required" }, 400);
  }
  const flag = await db.from("app_settings").select("value").eq(
    "key",
    "sources.enabled",
  ).maybeSingle();
  if (flag.error || flag.data?.value !== true) {
    return json({ error: "source_unavailable" }, 503);
  }
  const { data: source, error } = await db.from("learning_sources").select(
    "id,mime,bytes,pages,sha256,object_path",
  ).eq("id", sourceId).eq("family_id", familyId).eq("kind", "document").eq(
    "status",
    "ready",
  ).maybeSingle();
  if (error || !source) return json({ error: "source_not_ready" }, 404);
  if (
    !["application/pdf", "image/png", "image/jpeg"].includes(source.mime) ||
    source.bytes > 10485760 ||
    (source.mime === "application/pdf" && (!source.pages || source.pages > 5))
  ) return json({ error: "source_size_or_type" }, 400);
  const saved = await db.from("learning_source_ai_consents").upsert({
    source_id: sourceId,
    family_id: familyId,
    actor_id: userId,
    scope_id: requestId,
    purpose,
    version: "source-ai-v1",
  }, {
    onConflict: "source_id,actor_id,scope_id,purpose",
    ignoreDuplicates: true,
  });
  if (saved.error) return json({ error: "data_failed" }, 503);
  const downloaded = await db.storage.from("gina-private-sources").download(
    source.object_path,
  );
  if (
    downloaded.error || !downloaded.data ||
    downloaded.data.size !== source.bytes
  ) return json({ error: "data_failed" }, 503);
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer()),
    digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  if (
    Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("") !==
      source.sha256
  ) return json({ error: "source_not_ready" }, 409);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const media: Exclude<AiUserContent, string> =
    source.mime === "application/pdf"
      ? [{
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: btoa(binary),
        },
      }]
      : [{
        type: "image",
        source: {
          type: "base64",
          media_type: source.mime as "image/png" | "image/jpeg",
          data: btoa(binary),
        },
      }];
  return { media, id: source.id, sha256: source.sha256 };
}
