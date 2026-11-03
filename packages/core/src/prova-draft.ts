import { z } from "zod";
export const provaBlockSchema = z.object({
  kind: z.enum(["question", "group"]),
  id: z.string().uuid(),
  source: z.enum(["library", "ai", "manual", "document"]),
}).strict();
export const provaDraftSchema = z.object({
  childId: z.string().uuid().nullable(),
  grade: z.number().int().min(1).max(12).nullable(),
  title: z.string().max(160),
  purpose: z.enum(["practice", "written", "trial"]),
  format: z.enum(["school", "meb", "practice"]),
  subjects: z.array(z.string().trim().min(1).max(80)).max(12),
  topics: z.array(z.string().trim().min(1).max(200)).max(30),
  target: z.number().int().min(1).max(100),
  minutes: z.number().int().min(1).max(180).nullable(),
  difficulty: z.enum(["kolay", "orta", "orta_ustu", "zor"]),
  kind: z.enum(["mixed", "multiple_choice", "open_ended"]),
  note: z.string().max(1500),
  step: z.number().int().min(0).max(3),
  blocks: z.array(provaBlockSchema).max(100),
}).strict().refine(
  (d) => new Set(d.blocks.map((b) => b.id)).size === d.blocks.length,
  "duplicate_block",
);
export type ProvaDraft = z.infer<typeof provaDraftSchema>;
export type ProvaBlock = z.infer<typeof provaBlockSchema>;
export const newProvaDraft = (): ProvaDraft => ({
  childId: null,
  grade: null,
  title: "",
  purpose: "written",
  format: "school",
  subjects: [],
  topics: [],
  target: 10,
  minutes: null,
  difficulty: "orta",
  kind: "mixed",
  note: "",
  step: 0,
  blocks: [],
});
export function appendProvaBlocks(
  draft: ProvaDraft,
  blocks: ProvaBlock[],
): ProvaDraft {
  const ids = new Set(draft.blocks.map((b) => b.id));
  return {
    ...draft,
    blocks: [
      ...draft.blocks,
      ...blocks.filter((b) => {
        if (ids.has(b.id)) return false;
        ids.add(b.id);
        return true;
      }),
    ],
  };
}
export function moveProvaBlock(
  blocks: ProvaBlock[],
  index: number,
  delta: number,
): ProvaBlock[] {
  const next = index + delta;
  if (
    index < 0 || index >= blocks.length || next < 0 || next >= blocks.length
  ) return blocks;
  const copy = [...blocks];
  [copy[index], copy[next]] = [copy[next]!, copy[index]!];
  return copy;
}
