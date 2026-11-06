import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  classifyServerError,
  type ErrorAction,
  errorAction,
  type ErrorCategory,
  type ErrorClassification,
  type ServerErrorBody,
} from "@gina/core";

import i18n from "./i18n";
import { supabase } from "./supabase";

/** Prova AI Edge Function'ları (yalnız veli alanı; çocuk ekranları çağırmaz). */
export type ProvaAiFunction = "prova-review" | "prova-generate" | "prova-grade" | "prova-plan" | "setup-suggestions" | "timetable-import" | "learning-plan-import" | "ai-weekly-summary";

/** Sunucunun döndürdüğü hata kodu taşıyan hata; mesajı prova.ai.errors.* çevirisidir. C08: ortak sözleşmenin
 * kategori/retryable/eylem alanları da taşınır; özel çeviri yoksa kategori metni gösterilir (ham kod/JSON değil). */
export class ProvaAiError extends Error {
  public readonly category: ErrorCategory;
  public readonly retryable: boolean;
  public readonly retryAfterS: number | undefined;
  public readonly action: ErrorAction;
  constructor(
    public code: string,
    public status: number,
    classification?: ErrorClassification,
  ) {
    const c = classification ?? classifyServerError({ code, status: status || null, network: code === "network" });
    const key = `prova.ai.errors.${code}`;
    super(i18n.exists(key) ? i18n.t(key) : i18n.t(`c08.errorCategory.${c.category}`, { defaultValue: i18n.t("prova.ai.errors.unknown") }));
    this.category = c.category;
    this.retryable = c.retryable;
    this.retryAfterS = c.retry_after_s;
    this.action = errorAction(c);
  }
}

async function failureOf(error: unknown): Promise<ProvaAiError> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    let payload: Partial<ServerErrorBody> | null = null;
    try {
      payload = (await res.json()) as Partial<ServerErrorBody>;
    } catch {
      // Gövde yok/JSON değil (ör. gateway verify_jwt 401): durum koduna göre sınıflandırılır.
    }
    const c = classifyServerError({ body: payload, status: res.status });
    // Gövdesiz gateway 401 için kod session_expired; aksi hâlde sunucu kodu (eski `error` alanı dahil).
    const code = typeof payload?.code === "string" ? payload.code : typeof payload?.error === "string" ? payload.error : c.code;
    return new ProvaAiError(code, res.status, c);
  }
  return new ProvaAiError("network", 0, classifyServerError({ network: true }));
}

/**
 * C08: oturum süresi dolduysa (gateway'in gövdesiz 401'i dahil) oturum bir kez yenilenir ve AYNI gövde bir kez
 * tekrar gönderilir. Çağıranın taslağı/state'i dokunulmaz; gateway reddinde fonksiyon hiç çalışmadığı için
 * ücretli iş açılmamıştır. Yenileme başarısızsa `session_expired` hatası taşınır (ekran girişe yönlendirir).
 * Belirsiz ücretli sonuçta (ai_result_uncertain) hiçbir zaman otomatik tekrar yoktur.
 */
export async function invokeProvaAi<T>(name: ProvaAiFunction, body: Record<string, unknown>): Promise<T> {
  let refreshed = false;
  for (;;) {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (!error) return data as T;
    const failure = await failureOf(error);
    if (failure.action === "refresh_session" && !refreshed) {
      refreshed = true;
      const { data: session, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && session.session) continue;
    }
    throw failure;
  }
}

/** DB RPC hata kodlarını (plan_limit_prova_* vb.) aynı çeviriye bağlar. */
export function provaErrorMessage(error: unknown): string | null {
  if (!error) return null;
  const message = error instanceof Error ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message : null;
  if (message && !(error instanceof ProvaAiError)) {
    const key = `prova.ai.errors.${message}`;
    if (i18n.exists(key)) return i18n.t(key);
  }
  return message ?? i18n.t("sharedQuestions.saveFailed");
}

export interface GeneratedQuestion {
  id: string;
  topic: string;
  kind: "multiple_choice" | "open_ended";
  difficulty: "kolay" | "orta" | "orta_ustu" | "zor";
  stem: string;
  choices: { key: string; text: string }[] | null;
  correct_key: string | null;
  expected_answer: string | null;
  solution: string | null;
  explanation: string | null;
  source_urls: string[];
  /** D10: kişi adı uyarısı özeti (status + flags); `questionContentReviewOf` ile okunur. Eski sonuçlarda yok. */
  content_review?: unknown;
}

export interface GenerateResponse {
  ok: true;
  model: string;
  prompt_version: string;
  remaining: number;
  questions: GeneratedQuestion[];
}

export interface GradeResponse {
  ok: true;
  graded: number;
}

export interface PlanResponse {
  ok: true;
  plan_id: string;
}

export interface StudyPlanBody {
  ozet?: string;
  gunler?: { gun: number; konu: string; etkinlik: string; sure_dk: number }[];
  gorev_onerileri?: string[];
}
