import { json, serviceClient } from "./supabase.ts";
/** New builder calls bind generation to its saved, family-owned child/grade scope. Legacy standalone calls remain supported. */
export async function generationDraftScope(
  db: ReturnType<typeof serviceClient>,
  family: string,
  draftId: unknown,
  grade: number,
  subject: string,
) {
  if (draftId === undefined || draftId === null) return null;
  if (
    typeof draftId !== "string" ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(draftId)
  ) return json({ error: "invalid_input" }, 400);
  const { data: d, error } = await db.from("prova_drafts").select(
    "id,version,content,submitted_at",
  ).eq("id", draftId).eq("family_id", family).maybeSingle();
  if (error) return json({ error: "data_failed" }, 503);
  if (!d) return json({ error: "prova_draft_not_found" }, 404);
  const c = d.content;
  if (d.submitted_at) return json({ error: "prova_draft_submitted" }, 409);
  if (
    !c || c.grade !== grade || !Array.isArray(c.subjects) ||
    !c.subjects.includes(subject) || !c.childId
  ) return json({ error: "prova_draft_changed" }, 409);
  const { data: child, error: ce } = await db.from("children").select("grade,archived_at")
    .eq("id", c.childId).eq("family_id", family).maybeSingle();
  if (ce) return json({ error: "data_failed" }, 503);
  if (child?.archived_at) return json({ error: "child_archived" }, 409);
  if (!child || (child.grade >= 1 && child.grade !== grade)) {
    return json({ error: "prova_draft_changed" }, 409);
  }
  return { id: d.id, version: d.version, purpose: c.purpose };
}
