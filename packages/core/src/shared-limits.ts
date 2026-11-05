// U08 — Ortak kontroller ve durumlar: hata sınıflandırma sözleşmesi, çoklu kaynak sınırı
// okuyucusu ve sayı/süre giriş aralıkları. İstemci (mobil/web/yönetim) ve sunucu (Edge,
// `supabase/functions/_shared/error-contract.ts`) bu dosyayı aynen içe aktarır; DB tarafında
// `public.shared_source_limits()` ve `public.shared_input_ranges()` aynı değerleri döner
// (20261106120000_shared_limits.sql) ve testler iki tarafın eşitliğini doğrular.

// ---------------------------------------------------------------------------
// 1. Hata sınıflandırma sözleşmesi
// ---------------------------------------------------------------------------

export const ERROR_CATEGORIES = [
  "permission_denied",
  "offline",
  "unauthorized",
  "session_expired",
  "service_unavailable",
  "rate_limited",
  "validation",
  "conflict",
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

/** Edge fonksiyonlarının hata gövdesi. `error` eski alan (korunur), diğerleri U08 ile eklendi. */
export interface ServerErrorBody {
  /** Eski istemcilerin okuduğu kod; `code` ile aynı değer. */
  error: string;
  code: string;
  category: ErrorCategory;
  retryable: boolean;
  retry_after_s?: number;
  /** Yalnız sayı/kısa sabit metin; ham sunucu hatası, UUID veya JSON asla girmez. */
  details?: Record<string, number | string | boolean | null>;
}

export interface ErrorClassification {
  code: string;
  category: ErrorCategory;
  retryable: boolean;
  retry_after_s?: number;
}

type Rule = { category: ErrorCategory; retryable: boolean; retry_after_s?: number };
const rule = (category: ErrorCategory, retryable = false, retry_after_s?: number): Rule =>
  retry_after_s === undefined ? { category, retryable } : { category, retryable, retry_after_s };

/** Bilinen sunucu kodları → kategori. Yeni kod eklenirken buraya yazılır; tablo rapora da girer. */
export const ERROR_CODE_RULES: Readonly<Record<string, Rule>> = {
  // Kimlik ve yetki
  unauthorized: rule("unauthorized"),
  session_expired: rule("session_expired"),
  forbidden: rule("permission_denied"),
  source_not_available: rule("permission_denied"),
  plan_has_no_ai: rule("permission_denied"),
  source_cleanup_forbidden: rule("permission_denied"),
  // Doğrulama
  invalid_input: rule("validation"),
  method_not_allowed: rule("validation"),
  source_size_or_type: rule("validation"),
  source_file_limit: rule("validation"),
  source_page_limit: rule("validation"),
  source_dimensions: rule("validation"),
  source_invalid: rule("validation"),
  source_pdf_invalid_or_encrypted: rule("validation"),
  source_ai_consent_required: rule("validation"),
  source_consent_required: rule("validation"),
  source_storage_limit: rule("validation"),
  library_media_invalid: rule("validation"),
  ai_input_too_large: rule("validation"),
  plan_import_invalid: rule("validation"),
  // Çakışma / durum
  request_conflict: rule("conflict"),
  child_archived: rule("conflict"),
  question_in_use: rule("conflict"),
  source_upload_incomplete: rule("conflict"),
  source_not_ready: rule("conflict"),
  source_changed: rule("conflict"),
  plan_import_unavailable: rule("conflict"),
  generation_in_progress: rule("conflict", true, 20),
  // Hız / kota
  ai_rate_limited: rule("rate_limited", true, 60),
  source_rate_limited: rule("rate_limited", true, 60),
  ai_quota_exceeded: rule("rate_limited"),
  // Servis
  ai_disabled: rule("service_unavailable"),
  ai_not_configured: rule("service_unavailable"),
  ai_configuration_unavailable: rule("service_unavailable", true),
  ai_model_unavailable: rule("service_unavailable"),
  ai_model_unsupported: rule("service_unavailable"),
  provider_unconfigured: rule("service_unavailable"),
  ai_temporarily_unavailable: rule("service_unavailable", true, 120),
  ai_result_uncertain: rule("service_unavailable"),
  ai_result_invalid: rule("service_unavailable"),
  generation_failed: rule("service_unavailable"),
  entitlement_failed: rule("service_unavailable", true),
  save_failed: rule("service_unavailable", true),
  data_failed: rule("service_unavailable", true),
  source_failed: rule("service_unavailable", true),
  source_unavailable: rule("service_unavailable"),
  source_upload_failed: rule("service_unavailable", true),
  library_media_failed: rule("service_unavailable", true),
  server_error: rule("service_unavailable", true),
};

/** Kullanıcıya gidebilecek kod biçimi: kısa, sabit, küçük harf. UUID/JSON/ham mesaj geçmez. */
export const SAFE_ERROR_CODE = /^[a-z][a-z0-9_]{0,63}$/;

const STATUS_CATEGORY: Readonly<Record<number, ErrorCategory>> = {
  400: "validation",
  401: "unauthorized",
  402: "permission_denied",
  403: "permission_denied",
  404: "conflict",
  405: "validation",
  409: "conflict",
  413: "validation",
  422: "validation",
  429: "rate_limited",
};

export const CATEGORY_STATUS: Readonly<Record<ErrorCategory, number>> = {
  validation: 400,
  unauthorized: 401,
  session_expired: 401,
  permission_denied: 403,
  conflict: 409,
  rate_limited: 429,
  service_unavailable: 503,
  offline: 0,
};

export interface ClassifyInput {
  /** Sunucu gövdesindeki `code` veya eski `error` alanı. */
  code?: unknown;
  /** HTTP durumu; ağ hatasında yok. */
  status?: number | null;
  /** İstek hiç yanıt almadı (fetch TypeError / zaman aşımı). */
  network?: boolean;
  /** Sunucu gövdesi zaten sözleşmeye uyuyorsa doğrudan geçirilir. */
  body?: Partial<ServerErrorBody> | null;
}

/**
 * Hem istemci hem sunucu aynı fonksiyonla sınıflandırır. Bilinmeyen kod güvenli değilse
 * `server_error` olur; kategori HTTP durumundan türetilir. Ağ hatası `offline` (tekrar edilebilir).
 * Gateway `verify_jwt` reddi (401, gövdede `error` yok) istemci için `session_expired` sayılır:
 * oturumun yenilenmesi gerekir.
 */
export function classifyServerError(input: ClassifyInput): ErrorClassification {
  if (input.network) return { code: "offline", category: "offline", retryable: true };
  const body = input.body ?? null;
  if (
    body && typeof body.code === "string" && SAFE_ERROR_CODE.test(body.code) &&
    typeof body.category === "string" && (ERROR_CATEGORIES as readonly string[]).includes(body.category) &&
    typeof body.retryable === "boolean"
  ) {
    return {
      code: body.code,
      category: body.category,
      retryable: body.retryable,
      ...(typeof body.retry_after_s === "number" ? { retry_after_s: body.retry_after_s } : {}),
    };
  }
  const raw = typeof input.code === "string" ? input.code : typeof body?.error === "string" ? body.error : undefined;
  const code = raw && SAFE_ERROR_CODE.test(raw) ? raw : undefined;
  const known = code ? ERROR_CODE_RULES[code] : undefined;
  if (code && known) return { code, ...known };
  const status = input.status ?? null;
  if (status === 401 && !code) return { code: "session_expired", category: "session_expired", retryable: false };
  const category: ErrorCategory = status === null
    ? "service_unavailable"
    : status >= 500
    ? "service_unavailable"
    : STATUS_CATEGORY[status] ?? (status >= 400 ? "validation" : "service_unavailable");
  return {
    code: code ?? "server_error",
    category,
    retryable: category === "service_unavailable",
  };
}

/** Sunucu gövdesi kurucusu; `error` eski alan olarak aynı kodu taşır. */
export function errorBody(
  code: string,
  options: { status?: number; details?: ServerErrorBody["details"]; retry_after_s?: number } = {},
): ServerErrorBody {
  const classified = classifyServerError({ code, status: options.status ?? null });
  const details = options.details ? sanitizeDetails(options.details) : undefined;
  const body: ServerErrorBody = {
    error: classified.code,
    code: classified.code,
    category: classified.category,
    retryable: classified.retryable,
  };
  const retry = options.retry_after_s ?? classified.retry_after_s;
  if (retry !== undefined) body.retry_after_s = retry;
  if (details && Object.keys(details).length) body.details = details;
  return body;
}

const SAFE_DETAIL_TEXT = /^[a-z0-9_./-]{1,64}$/i;
/** Ayrıntı alanı yalnız sonlu sayı, boolean, null ve kısa sabit metin taşır. */
export function sanitizeDetails(details: Record<string, unknown>): ServerErrorBody["details"] {
  const out: NonNullable<ServerErrorBody["details"]> = {};
  for (const [key, value] of Object.entries(details)) {
    if (!SAFE_ERROR_CODE.test(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean" || value === null) out[key] = value;
    else if (typeof value === "string" && SAFE_DETAIL_TEXT.test(value) && !UUID.test(value)) out[key] = value;
  }
  return out;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// 2. Çoklu kaynak (dosya/galeri/kamera) sınırları
// ---------------------------------------------------------------------------

/** DB tohumlarıyla aynı: `sources.max_files` = 5 (1–10), source-file.ts bayt sınırları,
 * learning_source_sets toplam sayfa/bayt, ai_operation_policies.max_media_* (S06). */
export const SOURCE_LIMIT_DEFAULTS = {
  max_files: 5,
  max_files_min: 1,
  max_files_max: 10,
  max_image_bytes: 4_194_304,
  max_pdf_bytes: 10_485_760,
  max_pdf_pages: 5,
  max_total_pages: 20,
  max_total_bytes: 20_971_520,
  analysis_cost: "per_operation",
} as const;

export interface SourceLimits {
  max_files: number;
  max_image_bytes: number;
  max_pdf_bytes: number;
  max_pdf_pages: number;
  max_total_pages: number;
  max_total_bytes: number;
  analysis_cost: "per_operation";
}

const int = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/**
 * `get_learning_source_policy()` / `shared_source_limits()` çıktısını okur. Eksik veya bozuk
 * alan varsayılana düşer; `max_files` 1–10 aralığına, toplam bayt S06 politika tavanına kırpılır.
 * İstemci ve sunucu yalnız bu okuyucuyu kullanır.
 */
export function readSourceLimits(raw: unknown): SourceLimits {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = SOURCE_LIMIT_DEFAULTS;
  return {
    max_files: int(r.max_files, d.max_files, d.max_files_min, d.max_files_max),
    max_image_bytes: int(r.max_image_bytes, d.max_image_bytes, 1, d.max_image_bytes),
    max_pdf_bytes: int(r.max_pdf_bytes, d.max_pdf_bytes, 1, d.max_pdf_bytes),
    max_pdf_pages: int(r.max_pdf_pages, d.max_pdf_pages, 1, d.max_pdf_pages),
    max_total_pages: int(r.max_total_pages, d.max_total_pages, 1, d.max_total_pages),
    max_total_bytes: int(r.max_total_bytes, d.max_total_bytes, 1, d.max_total_bytes),
    analysis_cost: "per_operation",
  };
}

export interface SourceFileLike {
  mime: string;
  bytes: number;
  pages?: number | null;
}

export type SourceSelectionCheck =
  | { ok: true; remaining: number; total_bytes: number; total_pages: number }
  | {
    ok: false;
    code: "source_file_limit" | "source_size_or_type";
    category: "validation";
    details: Record<string, number | string>;
  };

/**
 * Seçim/ekleme anında ve sunucuda aynı kural: adet, dosya başına tür/bayt/sayfa, toplam bayt/sayfa.
 * Limit aşımında `validation` + kalan sayı döner; istemci kullanıcıya "en fazla N, kalan K" gösterir.
 */
export function checkSourceSelection(files: readonly SourceFileLike[], limits: SourceLimits): SourceSelectionCheck {
  if (files.length > limits.max_files) {
    return {
      ok: false,
      code: "source_file_limit",
      category: "validation",
      details: { max_files: limits.max_files, selected: files.length, remaining: 0 },
    };
  }
  let total_bytes = 0, total_pages = 0;
  for (const [index, file] of files.entries()) {
    const pdf = file.mime === "application/pdf";
    const image = file.mime === "image/png" || file.mime === "image/jpeg";
    const pages = pdf ? file.pages ?? 0 : 1;
    if (
      (!pdf && !image) || !Number.isInteger(file.bytes) || file.bytes < 1 ||
      file.bytes > (pdf ? limits.max_pdf_bytes : limits.max_image_bytes) ||
      (pdf && (!Number.isInteger(pages) || pages < 1 || pages > limits.max_pdf_pages))
    ) {
      return {
        ok: false,
        code: "source_size_or_type",
        category: "validation",
        details: {
          index,
          max_bytes: pdf ? limits.max_pdf_bytes : limits.max_image_bytes,
          max_pdf_pages: limits.max_pdf_pages,
        },
      };
    }
    total_bytes += file.bytes;
    total_pages += pages;
  }
  if (total_bytes > limits.max_total_bytes || total_pages > limits.max_total_pages) {
    return {
      ok: false,
      code: "source_size_or_type",
      category: "validation",
      details: {
        max_total_bytes: limits.max_total_bytes,
        max_total_pages: limits.max_total_pages,
        total_bytes,
        total_pages,
      },
    };
  }
  return { ok: true, remaining: limits.max_files - files.length, total_bytes, total_pages };
}

// ---------------------------------------------------------------------------
// 3. Sayı/süre girişleri: hazır seçimler ve elle giriş aralıkları (tek sözleşme)
// ---------------------------------------------------------------------------

export interface InputRange {
  min: number;
  max: number;
  step: number;
  presets: readonly number[];
  unit: "minutes" | "count" | "stars" | "points" | "year";
}

/** Mobil `NumberChoice` kullanımları, core zod şemaları ve DB check kısıtlarıyla aynı aralıklar.
 * DB karşılığı `public.shared_input_ranges()`; core testi migration metniyle eşitliği doğrular. */
export const INPUT_RANGES = {
  prova_minutes: { min: 1, max: 180, step: 5, presets: [10, 15, 20, 30, 45, 60], unit: "minutes" },
  prova_target: { min: 1, max: 100, step: 1, presets: [5, 10, 15, 20], unit: "count" },
  source_question_count: { min: 1, max: 30, step: 1, presets: [3, 5, 10, 20, 30], unit: "count" },
  task_stars: { min: 0, max: 10, step: 1, presets: [1, 2, 3, 5], unit: "stars" },
  reward_cost_stars: { min: 1, max: 500, step: 1, presets: [5, 10, 20, 50, 100], unit: "stars" },
  timetable_lesson_minutes: { min: 5, max: 180, step: 5, presets: [30, 35, 40, 45, 50], unit: "minutes" },
  timetable_break_minutes: { min: 0, max: 120, step: 5, presets: [5, 10, 15, 20], unit: "minutes" },
  study_item_minutes: { min: 5, max: 60, step: 5, presets: [5, 10, 15, 20, 40, 60], unit: "minutes" },
  group_exam_minutes: { min: 5, max: 120, step: 5, presets: [20, 30, 40, 60], unit: "minutes" },
  school_max_score: { min: 1, max: 9999, step: 1, presets: [10, 20, 50, 100], unit: "points" },
  setup_task_stars: { min: 1, max: 5, step: 1, presets: [1, 2, 3, 5], unit: "stars" },
  setup_reward_stars: { min: 1, max: 100, step: 1, presets: [5, 10, 20, 50], unit: "stars" },
} as const satisfies Record<string, InputRange>;
export type InputRangeKey = keyof typeof INPUT_RANGES;

export type InputRangeCheck =
  | { ok: true; value: number }
  | { ok: false; code: "invalid_input"; category: "validation"; details: { field: string; min: number; max: number } };

/** Elle giriş de hazır seçim de aynı aralıktan geçer. Tam sayı dışı, aralık dışı ve sonlu olmayan değer reddedilir. */
export function checkInputRange(key: InputRangeKey, value: unknown): InputRangeCheck {
  const range = INPUT_RANGES[key];
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < range.min || n > range.max) {
    return { ok: false, code: "invalid_input", category: "validation", details: { field: key, min: range.min, max: range.max } };
  }
  return { ok: true, value: n };
}

/** Hazır seçimler aralığın içinde kalır; istemci aralık dışı ön ayarı göstermez. */
export function presetsWithin(key: InputRangeKey, min: number = INPUT_RANGES[key].min, max: number = INPUT_RANGES[key].max): number[] {
  return INPUT_RANGES[key].presets.filter((v) => v >= min && v <= max);
}
