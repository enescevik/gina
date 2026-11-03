import { z } from "zod";
const plan = z.enum(["free", "plus", "pro"]);
const effective = z.object({plan, source:z.enum(["free", "store", "comp", "beta"]), expires_at:z.string().nullable()});
export const financeWorkspaceSchema = z.object({
  families:z.array(effective.extend({id:z.string().uuid(),name:z.string()})),
  detail:z.object({id:z.string().uuid(),name:z.string(),effective,
    subscriptions:z.array(z.object({id:z.string().uuid(),platform:z.enum(["apple","google"]),plan,
      product_id:z.string(),status:z.enum(["active","grace","on_hold","expired","revoked"]),
      expires_at:z.string(),auto_renewing:z.boolean(),updated_at:z.string()})),
    overrides:z.array(z.object({id:z.string().uuid(),plan,reason:z.string(),starts_at:z.string(),ends_at:z.string(),revoked_at:z.string().nullable()})),
  }).nullable(),
  notifications:z.array(z.object({id:z.string().uuid(),platform:z.enum(["apple","google"]),received_at:z.string(),attempts:z.number().int().nonnegative(),processed_at:z.string().nullable(),
    status:z.enum(["processing","done","failed","waiting"]),error_code:z.string().nullable(),family_id:z.string().uuid().nullable(),family_name:z.string().nullable()})),
  summary:z.object({unprocessed:z.number().int().nonnegative(),active_store_families:z.number().int().nonnegative(),active_overrides:z.number().int().nonnegative(),as_of:z.string()}),
});
export type FinanceWorkspace = z.infer<typeof financeWorkspaceSchema>;

const overrideReason = z.string().trim().min(3).max(1000);
export const overridePayloadSchema = z.discriminatedUnion("action", [
  z.object({ action:z.literal("grant"),family_id:z.string().uuid(),plan:z.enum(["plus","pro"]),reason:overrideReason,starts_at:z.string().datetime(),ends_at:z.string().datetime() }).strict(),
  z.object({ action:z.literal("expire"),override_id:z.string().uuid(),reason:overrideReason }).strict(),
]);
export const overrideCommandSchema = z.object({request:z.string().uuid(),payload:overridePayloadSchema}).strict();
export const overrideReceiptSchema = z.object({request_id:z.string().uuid(),action:z.enum(["grant","expire"]),override_id:z.string().uuid(),family_id:z.string().uuid()});
export type OverrideCommand = z.infer<typeof overrideCommandSchema>;
export type OverridePayload = z.infer<typeof overridePayloadSchema>;

export const reconcileCommandSchema=z.object({request:z.string().uuid(),family:z.string().uuid(),subscription:z.string().uuid(),reason:z.string().trim().min(3).max(1000)}).strict();
export const reconcileJobSchema=z.object({id:z.string().uuid(),family_id:z.string().uuid(),subscription_id:z.string().uuid(),reason:z.string(),status:z.enum(['queued','processing','succeeded','unchanged','failed']),code:z.string().nullable(),attempts:z.number().int().nonnegative(),created_at:z.string(),completed_at:z.string().nullable(),retry_after:z.string().nullable()});
export const reconcileJobsSchema=z.array(reconcileJobSchema);
export type ReconcileCommand=z.infer<typeof reconcileCommandSchema>;
export type ReconcileJob=z.infer<typeof reconcileJobSchema>;
