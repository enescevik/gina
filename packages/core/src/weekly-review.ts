import { z } from "zod";
import { isCalendarDate } from "./form-validation";
const text = (max: number) => z.string().trim().min(1).max(max);
const date = z.string().refine(isCalendarDate);
export const weeklySummarySchema = z.object({
  haftanin_ozeti: text(1800),
  cocuk_basina: z.array(
    z.object({
      etiket: text(80),
      basarilar: z.array(text(500)).max(4),
      zorlananlar: z.array(text(500)).max(3),
      oneri: text(700),
    }).strict(),
  ),
  veliye_oneriler: z.array(text(500)).max(3),
}).strict();
export const weeklyReviewSchema = z.object({
  week_start: date,
  weeks: z.array(date).length(8),
  timezone: text(100),
  state: z.enum(["empty", "ready", "working", "uncertain", "failed"]),
  snapshot_at: z.string().nullable(),
  children: z.array(
    z.object({
      alias: text(80),
      name: text(150).nullable(),
      grade: z.number().int().nullable(),
      stars_earned: z.number().int().nonnegative(),
      tasks: z.array(
        z.object({
          status: z.enum(["done", "approved", "returned"]),
          count: z.number().int().nonnegative(),
        }).strict(),
      ),
    }).strict(),
  ),
  summary: weeklySummarySchema.nullable(),
  remaining: z.number().int().nonnegative(),
  can_generate: z.boolean(),
  access: z.enum(["no_children", "disabled", "quota", "available"]),
}).strict().superRefine((v, ctx) => {
  const labels = v.children.map((c) => c.alias),
    answers = v.summary?.cocuk_basina.map((c) => c.etiket) ?? [];
  if (
    new Set(labels).size !== labels.length || !v.weeks.includes(v.week_start) ||
    (v.state === "ready") !== (v.summary !== null) ||
    (v.summary &&
      (new Set(answers).size !== labels.length ||
        answers.length !== labels.length || answers.some((a) =>
          !labels.includes(a)
        ))) ||
    (v.can_generate &&
      (!["empty", "failed"].includes(v.state) || v.access !== "available" ||
        !v.children.length || v.remaining === 0))
  ) {
    ctx.addIssue({ code: "custom", message: "weekly_result_invalid" });
  }
});
export type WeeklyReview = z.infer<typeof weeklyReviewSchema>;
