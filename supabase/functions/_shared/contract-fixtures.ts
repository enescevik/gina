// U08 test yardımcıları (deno test bu dosyayı kendi başına koşmaz): sahte Auth/üyelik istemcisi,
// JWT biçimli belirteç ve hata sözleşmesi doğrulaması. Gerçek `parentOrResponse` bu sahte istemciyle çalışır.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isContractBody } from "./error-contract.ts";

const b64 = (v: unknown) => btoa(JSON.stringify(v)).replace(/=+$/, "");
export const PARENT_FAMILY = "00000000-0000-4000-8000-00000000fa01";
export const PARENT_USER = "00000000-0000-4000-8000-00000000fa02";
export const parentClaims = (extra: Record<string, unknown> = {}) => ({
  sub: PARENT_USER,
  exp: Math.floor(Date.now() / 1000) + 600,
  gina: { role: "parent", family_id: PARENT_FAMILY },
  ...extra,
});
export const bearer = (payload: Record<string, unknown>) => `Bearer h.${b64(payload)}.s`;

/** Auth + `family_members`/`active_families` okumasını taklit eder. */
export function authDb({ valid = true, member = true, anonymous = false } = {}) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: member ? { family_id: PARENT_FAMILY } : null, error: null }),
  };
  return {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: { user: valid ? { id: PARENT_USER, is_anonymous: anonymous } : null },
          error: valid ? null : { message: "invalid" },
        }),
    },
    from: () => chain,
  } as unknown as SupabaseClient;
}

export interface AuthCase {
  name: string;
  authorization: string | null;
  db: SupabaseClient;
  status: number;
  code: "unauthorized" | "session_expired" | "forbidden";
  category: "unauthorized" | "session_expired" | "permission_denied";
}

/** Kimlik yok / süresi dolmuş / doğrulanamayan / cihaz rolü / üyelik yok. */
export function authCases(): AuthCase[] {
  return [
    { name: "no token", authorization: null, db: authDb(), status: 401, code: "unauthorized", category: "unauthorized" },
    {
      name: "expired token",
      authorization: bearer(parentClaims({ exp: Math.floor(Date.now() / 1000) - 30 })),
      db: authDb(),
      status: 401,
      code: "session_expired",
      category: "session_expired",
    },
    {
      name: "unverifiable token",
      authorization: bearer(parentClaims()),
      db: authDb({ valid: false }),
      status: 401,
      code: "unauthorized",
      category: "unauthorized",
    },
    {
      name: "device role",
      authorization: bearer(parentClaims({ gina: { role: "device", family_id: PARENT_FAMILY } })),
      db: authDb(),
      status: 403,
      code: "forbidden",
      category: "permission_denied",
    },
    {
      name: "not a member",
      authorization: bearer(parentClaims()),
      db: authDb({ member: false }),
      status: 403,
      code: "forbidden",
      category: "permission_denied",
    },
  ];
}

/** Gövde sözleşmeye uyar, eski `error` alanı kodla aynı, durum ve kategori beklenen. */
export async function expectContract(
  res: Response,
  status: number,
  code: string,
  category?: string,
): Promise<Record<string, unknown>> {
  const body = await res.json();
  if (res.status !== status) throw Error(`status ${res.status} != ${status}: ${JSON.stringify(body)}`);
  if (!isContractBody(body)) throw Error(`not a contract body: ${JSON.stringify(body)}`);
  if (body.error !== code || body.code !== code) throw Error(`code ${body.code} != ${code}`);
  if (category && body.category !== category) throw Error(`category ${body.category} != ${category}`);
  return body as unknown as Record<string, unknown>;
}

export const sourceLimitsRow = (overrides: Record<string, unknown> = {}) => ({
  max_files: 5,
  max_image_bytes: 4194304,
  max_pdf_bytes: 10485760,
  max_pdf_pages: 5,
  max_total_pages: 20,
  max_total_bytes: 20971520,
  analysis_cost: "per_operation",
  source: "app_settings",
  ...overrides,
});
