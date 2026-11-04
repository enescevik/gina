import { z } from "zod";

export const groupCreateCommandSchema = z.object({
  request: z.uuid(),
  review: z.boolean().optional(),
  source: z.enum(["legacy", "package"]),
  sourceId: z.uuid(),
  version: z.number().int().positive().nullable(),
  title: z.string().trim().min(3).max(160),
  items: z.array(z.string().min(1).max(120)).min(1).max(50),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
  minutes: z.number().int().min(5).max(120),
  plans: z.array(z.enum(["free", "plus", "pro"])).min(1).max(3),
}).strict().refine((c) =>
  Date.parse(c.end) > Date.parse(c.start) &&
  Date.parse(c.end) - Date.parse(c.start) <= 31 * 86400000 &&
  new Set(c.items).size === c.items.length &&
  (c.source !== "package" || !!c.version)
);
export type GroupCreateCommand = z.infer<typeof groupCreateCommandSchema>;
