import { createClient, type SupabaseClient, type SupportedStorage } from "@supabase/supabase-js";

import type { Database } from "@gina/core";

export type GinaClient = SupabaseClient<Database>;

export interface GinaClientOptions {
  url: string;
  anonKey: string;
  /** Oturum deposu: mobilde expo-sqlite/kv-store, webde localStorage. */
  storage?: SupportedStorage;
  /** Mobilde false: oturumu URL'den değil depodan okur. */
  detectSessionInUrl?: boolean;
}

/**
 * Tüm istemcilerin (mobil, web, admin) kullandığı tek Supabase istemci fabrikası.
 * `service_role` anahtarı hiçbir istemciye verilmez; yalnızca Edge Function ve pg_cron kullanır.
 */
export function createGinaClient(options: GinaClientOptions): GinaClient {
  return createClient<Database>(options.url, options.anonKey, {
    auth: {
      storage: options.storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: options.detectSessionInUrl ?? false,
      flowType: "pkce",
    },
  });
}
