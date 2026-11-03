import type { ProvaBlock, Tables } from "@gina/core";
import { supabase } from "@/lib/supabase";
export type BuilderQuestion = Tables<"question_bank">;
export interface BuilderGroup {
  id: string;
  title: string;
  body: string;
  grade: number;
  subject: string;
  version: number;
  series_id: string;
  question_source_members: {
    question_id: string;
    position: number;
    prompt: string;
  }[];
}
export interface BuilderMaterial {
  questions: BuilderQuestion[];
  groups: BuilderGroup[];
}
export async function loadBuilderMaterial(
  blocks: ProvaBlock[],
): Promise<BuilderMaterial> {
  const groupIds = blocks.filter((b) => b.kind === "group").map((b) => b.id);
  const groups = groupIds.length
    ? await supabase.from("question_source_groups").select(
      "id,title,body,grade,subject,version,series_id,question_source_members(question_id,position,prompt)",
    ).in("id", groupIds)
    : { data: [], error: null };
  if (groups.error) throw groups.error;
  const ids = [
    ...blocks.filter((b) => b.kind === "question").map((b) => b.id),
    ...groups.data.flatMap((g) =>
      g.question_source_members.map((m) => m.question_id)
    ),
  ];
  const questions = ids.length
    ? await supabase.from("question_bank").select("*").in("id", ids)
    : { data: [], error: null };
  if (questions.error) throw questions.error;
  return { questions: questions.data, groups: groups.data };
}
export function questionsOf(block: ProvaBlock, material: BuilderMaterial) {
  if (block.kind === "question") {
    const q = material.questions.find((q) => q.id === block.id);
    return q ? [q] : [];
  }
  const group = material.groups.find((g) => g.id === block.id);
  return [...(group?.question_source_members ?? [])].sort((a, b) =>
    a.position - b.position
  ).flatMap((m) => {
    const q = material.questions.find((q) => q.id === m.question_id);
    return q ? [{ ...q, stem: m.prompt }] : [];
  });
}
export function hasAnswer(q: BuilderQuestion) {
  if (q.kind === "open_ended") return !!q.expected_answer?.trim();
  return Array.isArray(q.choices) &&
    q.choices.some((c) =>
      c && typeof c === "object" && "key" in c && c.key === q.correct_key
    );
}
