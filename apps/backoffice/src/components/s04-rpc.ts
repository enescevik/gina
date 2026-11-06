import { supabase } from "@/lib/supabase";

/**
 * S04 RPC'leri (`suggest_subject`, `admin_subject_synonyms`, `admin_import_education_calendar_seed`)
 * henüz üretilmiş veritabanı tiplerinde yok; tipler yeniden üretilene kadar dar bir çağrı yüzeyi.
 * Yanıtlar çağıran tarafta doğrulanır (core şemaları).
 */
type RpcResult = { data: unknown; error: { message?: string } | null };
type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<RpcResult>;

export async function s04Rpc(
  fn:
    | "suggest_subject"
    | "admin_subject_synonyms"
    | "admin_import_education_calendar_seed"
    // C11
    | "admin_save_subject_synonym"
    | "admin_subject_synonym_changes"
    | "admin_education_calendar_checks"
    | "admin_publish_education_calendar"
    | "admin_import_education_holidays"
    | "admin_education_holidays"
    | "admin_set_education_holiday_status"
    | "admin_education_report_summary",
  args?: Record<string, unknown>,
): Promise<unknown> {
  const client = supabase();
  const call = client.rpc as unknown as UntypedRpc;
  const r = await call.call(client, fn, args);
  if (r.error) throw r.error;
  return r.data;
}
