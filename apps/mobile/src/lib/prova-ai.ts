import { FunctionsHttpError } from "@supabase/supabase-js";

import i18n from "./i18n";
import { supabase } from "./supabase";

/** Prova AI Edge Function'ları (yalnız veli alanı; çocuk ekranları çağırmaz). */
export type ProvaAiFunction = "prova-generate" | "prova-grade" | "prova-plan";

/** Sunucunun döndürdüğü hata kodu taşıyan hata; mesajı prova.ai.errors.* çevirisidir. */
export class ProvaAiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    const key = `prova.ai.errors.${code}`;
    super(i18n.exists(key) ? i18n.t(key) : i18n.t("prova.ai.errors.unknown"));
  }
}

export async function invokeProvaAi<T>(name: ProvaAiFunction, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response;
      let code = "unknown";
      try {
        const payload = (await res.json()) as { error?: string };
        if (payload.error) code = payload.error;
      } catch {
        // gövde JSON değil
      }
      throw new ProvaAiError(code, res.status);
    }
    throw new ProvaAiError("network", 0);
  }
  return data as T;
}

/** DB RPC hata kodlarını (plan_limit_prova_* vb.) aynı çeviriye bağlar. */
export function provaErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error && !(error instanceof ProvaAiError)) {
    const key = `prova.ai.errors.${error.message}`;
    if (i18n.exists(key)) return i18n.t(key);
  }
  return error instanceof Error ? error.message : String(error);
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
