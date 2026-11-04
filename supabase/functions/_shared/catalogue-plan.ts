import { canonicalSubject } from "./blueprint-plan.ts";
/** This argument comes only from the private server binding, never from caller JSON. */
export function cataloguePlan(
  raw: unknown,
  grade: number,
  subject: string,
  topics: { topic: string; count: number }[],
) {
  if (!raw || typeof raw !== "object") throw Error("curriculum_scope_mismatch");
  const v = raw as Record<string, unknown>,
    candidate = v.candidate as Record<string, unknown>;
  if (
    v.origin !== "reviewed_catalogue" || !candidate ||
    candidate.grade !== grade ||
    canonicalSubject(candidate.subject) !== canonicalSubject(subject) ||
    !Array.isArray(candidate.blocks) ||
    candidate.blocks.length !== topics.length
  ) throw Error("curriculum_scope_mismatch");
  const blocks = candidate.blocks.map((raw, index) => {
    const block = raw as {
      count: number;
      outcomes: { text: string; code: string | null; cell: string }[];
    };
    if (
      topics[index].topic !== `Blok ${index + 1}` ||
      topics[index].count !== block.count || !Array.isArray(block.outcomes) ||
      !block.outcomes.length || block.outcomes.some((o) =>
        !o || typeof o.text !== "string" || !o.text
      )
    ) throw Error("curriculum_scope_mismatch");
    return {
      topic: topics[index].topic,
      count: block.count,
      outcomes: block.outcomes,
    };
  });
  if (blocks.reduce((n, b) => n + b.count, 0) !== candidate.question_count) {
    throw Error("curriculum_scope_mismatch");
  }
  return {
    ...v,
    candidate,
    officially_verified: false,
    learning_blocks: blocks,
    generation_guidance:
      "Her bloğun tam öğrenme çıktılarını ve soru sayısını koru; topic alanında blok anahtarını aynen kullan. Bunlar MEB onaylı sınav soruları değil, özgün çalışma taslaklarıdır.",
  };
}
