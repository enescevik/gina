import { z } from "zod";
export const pushRecoveryCommandSchema = z.object({
  request: z.uuid(),
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  revision: z.number().int().min(0).max(1),
  reason: z.string().trim().min(10).max(1000),
  confirmed: z.literal(true),
}).strict();
export type PushRecoveryCommand = z.infer<typeof pushRecoveryCommandSchema>;
export function readPushRecoveryReceipt(
  value: unknown,
  command: PushRecoveryCommand,
) {
  const r = z.object({
    request: z.uuid(),
    id: z.number().int().positive(),
    revision: z.number().int().positive(),
    status: z.literal("pending"),
  }).strict().parse(value);
  if (
    r.request !== command.request || r.id !== command.id ||
    r.revision !== command.revision + 1
  ) throw Error("push_receipt_invalid");
  return r;
}
