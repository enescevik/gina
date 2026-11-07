import {z} from 'zod';
export const outcomeObservationsSchema=z.array(z.object({
 scope:z.string(),grade:z.number().int(),subject:z.string(),curriculum:z.string().nullable(),outcomes:z.array(z.string()).min(1),
 observations:z.number().int().nonnegative(),scored:z.number().int().nonnegative(),pending:z.number().int().nonnegative(),blank:z.number().int().nonnegative(),
 mean_points:z.number().min(0).max(100).nullable(),limited_observation:z.boolean(),last_at:z.string(),
}).refine(v=>v.observations===v.scored+v.pending+v.blank&&v.limited_observation===(v.scored<5)&&((v.mean_points===null)===(v.scored<5))));

export function practiceDifficultySuggestion(rows: z.infer<typeof outcomeObservationsSchema>) {
  // Keep a single comparable outcome set. Combining groups can double-count
  // evidence or mix unrelated outcomes and curriculum versions.
  if (rows.length !== 1) return null;
  const row = rows[0]!;
  if (row.limited_observation || row.scored < 5 || row.pending > 0 || row.mean_points === null) return null;
  if (row.mean_points < 60) return { difficulty: "kolay", scored: row.scored } as const;
  if (row.mean_points >= 85) return { difficulty: "orta", scored: row.scored } as const;
  return null;
}
