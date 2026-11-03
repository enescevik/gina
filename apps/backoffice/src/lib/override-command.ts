import { overrideCommandSchema, overrideReceiptSchema, type OverrideCommand } from "@gina/core";
import { createLibraryQueue } from "./library-review";
import { supabase } from "./supabase";
export const overrideQueue = (user:string) => createLibraryQueue(user,"override",value=>overrideCommandSchema.parse(value));
export async function sendOverride(command:OverrideCommand) {
 const {data,error}=await supabase().rpc("admin_save_override",{p_request_id:command.request,p_command:command.payload}).abortSignal(AbortSignal.timeout(25000));
 if(error) throw error;
 const receipt=overrideReceiptSchema.parse(data),p=command.payload;
 if(receipt.request_id!==command.request || receipt.action!==p.action || (p.action==="grant" ? receipt.family_id!==p.family_id : receipt.override_id!==p.override_id)) throw Error("override_receipt_invalid");
 return receipt;
}
