import { z } from "zod";

/** ISO haftanın günü: 1 = Pazartesi … 7 = Pazar. */
export const isoWeekdaySchema = z.number().int().min(1).max(7);
export type IsoWeekday = z.infer<typeof isoWeekdaySchema>;

export const timeOfDaySchema = z.enum(["morning", "afternoon", "evening", "any"]);
export type TimeOfDay = z.infer<typeof timeOfDaySchema>;

export const completionStatusSchema = z.enum(["done", "approved", "returned"]);
export type CompletionStatus = z.infer<typeof completionStatusSchema>;

export const eventTypeSchema = z.enum([
  "school",
  "activity",
  "holiday",
  "exam",
  "family",
  "doctor",
  "birthday",
  "other",
]);
export type EventType = z.infer<typeof eventTypeSchema>;

export const noteVisibilitySchema = z.enum(["private", "family", "child", "teacher"]);
export type NoteVisibility = z.infer<typeof noteVisibilitySchema>;

/** JWT içindeki `gina` claim'i: Custom Access Token Hook tarafından üretilir. */
export const ginaClaimsSchema = z.object({
  family_id: z.uuid().nullable(),
  role: z.enum(["parent", "device", "none"]),
  device_id: z.uuid().nullable(),
  child_id: z.uuid().nullable(),
  admin: z.boolean(),
});
export type GinaClaims = z.infer<typeof ginaClaimsSchema>;

/** 4 haneli çocuk PIN'i ve ebeveyn PIN'i aynı kuralı kullanır. */
export const pinSchema = z.string().regex(/^\d{4}$/, "PIN 4 rakam olmalı");

/** Görev şablonu oluşturma/düzenleme formunun doğrulaması. */
export const taskTemplateInputSchema = z.object({
  child_id: z.uuid(),
  title: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(64).default("task-custom"),
  stars: z.number().int().min(0).max(10).default(1),
  days_of_week: z.array(isoWeekdaySchema).min(1).max(7),
  time_of_day: timeOfDaySchema.default("any"),
  starts_on: z.iso.date(),
  ends_on: z.iso.date().nullable().default(null),
  requires_approval: z.boolean().default(true),
});
export type TaskTemplateInput = z.infer<typeof taskTemplateInputSchema>;
