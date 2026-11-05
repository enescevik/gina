import { z } from "zod";
const snapshot = z.object({
  title: z.string().nullable(),
  body: z.string(),
  subject: z.string().nullable(),
  visibility: z.string(),
  archived_at: z.string().nullable(),
});
export const noteHistorySchema = z.object({
  rows: z.array(
    z.object({
      revision: z.number(),
      action: z.string(),
      before_value: snapshot.nullable(),
      after_value: snapshot,
      created_at: z.string(),
    }),
  ),
  has_more: z.boolean(),
});
