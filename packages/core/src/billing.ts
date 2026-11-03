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
