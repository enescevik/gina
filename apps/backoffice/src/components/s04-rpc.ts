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
    | "admin_import_education_calendar_seed",
  args?: Record<string, unknown>,
): Promise<unknown> {
  const client = supabase();
  const call = client.rpc as unknown as UntypedRpc;
  const r = await call.call(client, fn, args);
  if (r.error) throw r.error;
  return r.data;
}
