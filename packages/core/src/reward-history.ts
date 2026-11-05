import { z } from "zod";
export const rewardSnapshotSchema = z.object({
  title: z.string(),
  icon: z.string(),
  origin: z.enum(["request", "migration"]),
});
export function rewardSnapshot(value: unknown) {
  const result = rewardSnapshotSchema.safeParse(value);
  return result.success ? result.data : null;
}
const summary = z.object({
  title: z.string(),
  icon: z.string(),
  cost_stars: z.number(),
  active: z.boolean(),
  archived_at: z.string().nullable(),
});
export const rewardHistorySchema = z.object({
  rows: z.array(
    z.object({
      revision: z.number(),
      action: z.string(),
      before_value: summary.nullable(),
      after_value: summary,
      created_at: z.string(),
    }),
  ),
  has_more: z.boolean(),
  pending: z.number(),
  approved: z.number(),
  goals: z.array(
    z.object({ child_id: z.string(), name: z.string(), archived: z.boolean() }),
  ),
});
export type RewardSummary = z.infer<typeof summary>;
