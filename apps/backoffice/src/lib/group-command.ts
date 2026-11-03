import { groupCreateCommandSchema, type GroupCreateCommand } from "@gina/core";
import { createLibraryQueue } from "./library-review";
import { supabase } from "./supabase";

export const groupCreateQueue = (user: string) => createLibraryQueue(user, "group-create", value => groupCreateCommandSchema.parse(value));
export async function sendGroupCreate(c: GroupCreateCommand) {
  const shared = { p_id: c.request, p_title: c.title, p_start: c.start, p_end: c.end, p_minutes: c.minutes, p_plans: c.plans };
  const query = c.source === "package"
    ? supabase().rpc("admin_create_package_group_exam", { ...shared, p_package_id: c.sourceId, p_publication_version: c.version!, p_units: c.items })
    : supabase().rpc("admin_create_group_exam", { ...shared, p_collection: c.sourceId, p_items: c.items });
  const { data, error } = await query.abortSignal(AbortSignal.timeout(25000));
  if (error) throw error;
  if (data !== c.request) throw Error("group_receipt_invalid");
}
