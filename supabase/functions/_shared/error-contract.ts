// U08 — Edge hata sözleşmesi. Tipler ve sınıflandırıcı core'daki tek kaynaktan gelir; burada yalnız
// HTTP yanıtı kurulur. Eski `error` alanı korunur, `code/category/retryable/retry_after_s/details` eklenir.
// Ham sunucu hatası, UUID veya JSON kullanıcıya gitmez: güvenli olmayan kod `server_error` olur.
import {
  CATEGORY_STATUS,
  classifyServerError,
  errorBody,
  SAFE_ERROR_CODE,
  type ServerErrorBody,
} from "../../../packages/core/src/shared-limits.ts";
import { corsHeaders } from "./supabase.ts";

export {
  CATEGORY_STATUS,
  classifyServerError,
  ERROR_CATEGORIES,
  ERROR_CODE_RULES,
  errorBody,
  SAFE_ERROR_CODE,
} from "../../../packages/core/src/shared-limits.ts";
export type { ErrorCategory, ErrorClassification, ServerErrorBody } from "../../../packages/core/src/shared-limits.ts";

export interface FailOptions {
  details?: Record<string, unknown>;
  retry_after_s?: number;
}

/** Sözleşmeye uyan hata yanıtı. Durum verilmezse kategoriden türetilir. */
export function fail(code: string, status?: number, options: FailOptions = {}): Response {
  const safe = SAFE_ERROR_CODE.test(code) ? code : "server_error";
  const body = errorBody(safe, {
    status,
    details: options.details as ServerErrorBody["details"],
    retry_after_s: options.retry_after_s,
  });
  const httpStatus = status ?? CATEGORY_STATUS[body.category] ?? 500;
  const headers: Record<string, string> = {
    ...corsHeaders,
    "content-type": "application/json; charset=utf-8",
  };
  if (body.retry_after_s !== undefined) headers["retry-after"] = String(body.retry_after_s);
  return new Response(JSON.stringify(body), { status: httpStatus, headers });
}

/** RPC/Storage hata mesajını yalnız izin verilen desenle geçirir; aksi hâlde verilen yedek kodu kullanır. */
export function sanitizedCode(message: unknown, allowed: RegExp, fallback: string): string {
  return typeof message === "string" && allowed.test(message) && SAFE_ERROR_CODE.test(message) ? message : fallback;
}

/** Yanıt gövdesinin sözleşmeye uyduğunu test ve ara katmanlarda doğrulamak için. */
export function isContractBody(value: unknown): value is ServerErrorBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.error !== "string" || typeof v.code !== "string" || v.error !== v.code) return false;
  const classified = classifyServerError({ body: v as Partial<ServerErrorBody> });
  return classified.code === v.code && classified.category === v.category && typeof v.retryable === "boolean";
}
