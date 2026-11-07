import { z } from "zod";

/** QT50 (Faz 3) bulmaca istemci sözleşmesi. Puan SQL'de (`per_clue`); sunucuda `enabled=false`. */
export const PHASE3_INTERACTION_TYPES = ["crossword"] as const;
export type Phase3InteractionType = (typeof PHASE3_INTERACTION_TYPES)[number];
export const isPhase3Type = (t: string): t is Phase3InteractionType => (PHASE3_INTERACTION_TYPES as readonly string[]).includes(t);

const ID = z.string().regex(/^[a-z][a-z0-9_]{0,23}$/);
const CELL = z.string().regex(/^r[0-9]+_c[0-9]+$/);
export const crosswordPayloadSchema = z.object({
  rows: z.number().int().min(2).max(12),
  cols: z.number().int().min(2).max(12),
  blocks: z.array(CELL).optional(),
  clues: z.array(z.object({ id: ID, dir: z.enum(["across", "down"]), row: z.number().int().min(1), col: z.number().int().min(1), length: z.number().int().min(2).max(12), text: z.string().min(1).max(300) }).strict()).min(1).max(20),
}).strict();
export const crosswordAnswerSchema = z.object({ type: z.literal("crossword"), v: z.literal(1), cells: z.record(CELL, z.string().length(1)) }).strict();
export type CrosswordPayload = z.infer<typeof crosswordPayloadSchema>;
export type CrosswordAnswer = z.infer<typeof crosswordAnswerSchema>;
type Clue = CrosswordPayload["clues"][number];

/** TR büyük harf (i→İ, ı→I); ASCII eşitleme yok. */
export const trUpper = (t: string) => t.normalize("NFC").trim().toLocaleUpperCase("tr-TR");
export const clueCells = (c: Pick<Clue, "dir" | "row" | "col" | "length">) =>
  Array.from({ length: c.length }, (_, i) => `r${c.row + (c.dir === "down" ? i : 0)}_c${c.col + (c.dir === "across" ? i : 0)}`);
const LETTERS = /^[A-ZÇĞİIÖŞÜ]+$/;

export function crosswordContentErrors(p: unknown, k: unknown): string[] {
  const parsed = crosswordPayloadSchema.safeParse(p);
  if (!parsed.success) {
    const o = p as Record<string, unknown> | null;
    if (o && typeof o === "object" && Object.keys(o).some((x) => !["rows", "cols", "blocks", "clues"].includes(x))) return ["payload_unknown_field"];
    if (!o || typeof o.rows !== "number" || typeof o.cols !== "number" || o.rows < 2 || o.rows > 12 || o.cols < 2 || o.cols > 12) return ["grid_invalid"];
    return ["clues_invalid"];
  }
  const pl = parsed.data;
  const err = new Set<string>();
  const ids: string[] = [];
  const letters = new Map<string, string>();
  const key = (k ?? {}) as { answers?: Record<string, unknown>; weights?: unknown };
  for (const c of pl.clues) {
    if (ids.includes(c.id) || c.row > pl.rows || c.col > pl.cols || (c.dir === "across" && c.col + c.length - 1 > pl.cols) || (c.dir === "down" && c.row + c.length - 1 > pl.rows)) return ["clues_invalid"];
    ids.push(c.id);
    const cells = clueCells(c);
    if (cells.some((x) => (pl.blocks ?? []).includes(x))) err.add("clue_on_block");
    const ans = trUpper(String(key.answers?.[c.id] ?? ""));
    if (!ans) { err.add("key_missing_id"); continue; }
    if ([...ans].length !== c.length || !LETTERS.test(ans)) { err.add("key_value_invalid"); continue; }
    [...ans].forEach((ch, i) => {
      const prev = letters.get(cells[i]!);
      if (prev !== undefined && prev !== ch) err.add("crossing_mismatch");
      letters.set(cells[i]!, ch);
    });
  }
  if (!key.answers || typeof key.answers !== "object" || Object.keys(key.answers).some((x) => !ids.includes(x)) ||
    Object.keys(k as object).some((x) => !["answers", "weights"].includes(x))) err.add("key_unknown_id");
  return [...err].sort();
}

export function crosswordAnswerErrors(p: CrosswordPayload, a: Record<string, unknown>): string[] {
  if (Object.keys(a).some((x) => !["type", "v", "cells"].includes(x)) || !a.cells || typeof a.cells !== "object" || Array.isArray(a.cells)) return ["answer_invalid"];
  const allowed = new Set(p.clues.flatMap(clueCells));
  for (const [cell, v] of Object.entries(a.cells as Record<string, unknown>)) {
    if (!allowed.has(cell)) return ["answer_unknown_id"];
    if (typeof v !== "string" || [...v].length !== 1 || !LETTERS.test(trUpper(v))) return ["answer_value_invalid"];
  }
  return [];
}

export function crosswordAnswerState(p: CrosswordPayload, a: CrosswordAnswer | null | undefined): "unanswered" | "partial" | "complete" {
  const filled = Object.keys(a?.cells ?? {}).length;
  if (!filled) return "unanswered";
  return filled < new Set(p.clues.flatMap(clueCells)).size ? "partial" : "complete";
}
