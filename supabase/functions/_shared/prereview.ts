import type { AiResult } from "./prova.ts";
// E01 content pre-review: rubric, provider output contract and the approval threshold.
// The verdict is advisory. `ai_approved` is not a publication and not the admin decision;
// the admin queue (needs_admin / ai_rejected_suggestion) always ends with a human decision.
// Nothing here calls a provider: the Edge handler injects the call.

// v4: lease-bound immutable library PNGs can be reviewed; missing media still fails closed.
export const PREREVIEW_PROMPT_VERSION = "prereview-v4";
export const PREREVIEW_CONFIDENCE_THRESHOLD = 0.85;
export const PREREVIEW_MAX_ATTEMPTS = 3;

export const PREREVIEW_KINDS = [
  "library_package",
  "contribution_set",
  "curriculum_candidate",
] as const;
export type PrereviewKind = (typeof PREREVIEW_KINDS)[number];

export const PREREVIEW_STATUSES = [
  "pending",
  "ai_approved",
  "needs_admin",
  "ai_rejected_suggestion",
] as const;
export type PrereviewStatus = (typeof PREREVIEW_STATUSES)[number];

/** The five rubric questions the model must answer for every record. */
export const RUBRIC_KEYS = [
  "solution_correct",
  "measures_target_skill",
  "age_language_appropriate",
  "copyright_or_copy_suspicion",
  "leaked_exam_suspicion",
] as const;
export type RubricKey = (typeof RUBRIC_KEYS)[number];
export const RUBRIC_ANSWERS = ["yes", "no", "unsure"] as const;
export type RubricAnswer = (typeof RUBRIC_ANSWERS)[number];
/** Expected answer for a clean record, per rubric key. */
export const RUBRIC_PASS: Record<RubricKey, RubricAnswer> = {
  solution_correct: "yes",
  measures_target_skill: "yes",
  age_language_appropriate: "yes",
  copyright_or_copy_suspicion: "no",
  leaked_exam_suspicion: "no",
};
export const FINDING_CODES = [
  "solution_incorrect",
  "answer_key_mismatch",
  "rubric_incomplete",
  "skill_mismatch",
  "age_or_language",
  "copyright_or_copy",
  "leaked_exam",
  "scenario_count_mismatch",
  "outcome_mismatch",
  "personal_data",
  "unsafe_content",
  "other",
] as const;
export type FindingCode = (typeof FINDING_CODES)[number];
export const FINDING_SEVERITIES = ["blocking", "advisory"] as const;

export interface PrereviewFinding {
  code: FindingCode;
  severity: (typeof FINDING_SEVERITIES)[number];
  detail: string;
  item?: string | null;
}
export interface PrereviewRubric {
  solution_correct: RubricAnswer;
  measures_target_skill: RubricAnswer;
  age_language_appropriate: RubricAnswer;
  copyright_or_copy_suspicion: RubricAnswer;
  leaked_exam_suspicion: RubricAnswer;
}
export interface PrereviewOutput {
  confidence: number;
  recommendation: "approve" | "admin_review" | "reject";
  rubric: PrereviewRubric;
  findings: PrereviewFinding[];
  summary: string;
}

export const SYSTEM =
  `Sen GINA içerik ön inceleme asistanısın. Sana bir kütüphane taslak paketi, bir aile katkı kopyası veya bir MEB ortak yazılı senaryo adayının normalize edilmiş tam metni verilir. Görevin: içeriği okuyup beş rubrik sorusunu cevaplamak, bulguları listelemek ve bir öneri vermek. Kararı sen vermiyorsun; onay/ret son kararı yönetici verir, bağımsız eğitimci incelemesi ayrı bir kademedir.
Rubrik: solution_correct (öğretmen cevabı/çözümü doğru ve beklenen cevapla tutarlı mı), measures_target_skill (soru iddia edilen kazanımı/beceriyi gerçekten ölçüyor mu; senaryo adayında blok sayıları ve çıktı metinleri tutarlı mı), age_language_appropriate (sınıf düzeyine, yaşa ve Türkçe diline uygun mu; cezalandırıcı/utandırıcı dil yok mu), copyright_or_copy_suspicion (telifli ders kitabı, yayınevi veya başka kaynağın aynen kopyası şüphesi var mı), leaked_exam_suspicion (okul yazılısı, öğretmen EBA havuzu veya gizli sınav sorusunun paylaşımı şüphesi var mı).
Her rubrik cevabı yes/no/unsure. Emin değilsen unsure yaz; uydurma. Her sorunlu nokta findings içinde code+severity+detail ile yer alsın; blocking yalnız yayını engelleyecek sorun için. Kişisel veri (çocuk adı, okul adı, telefon) görürsen personal_data bulgusu yaz. confidence 0-1 arasında, bulguların eksiksizliğine duyduğun güvendir; içerik iyi diye otomatik yüksek verme. recommendation: approve yalnız tüm rubrik geçerse; reject yalnız açık ve ciddi sorun varsa; aksi admin_review. summary en çok 600 karakter, Türkçe. Yalnız istenen JSON'u döndür.
Görseller: yalnız mesajda gerçekten eklenmiş görselleri incele. Kaynak anahtarını sorudaki source_key ile eşleştir; şekil, ölçek, etiket, grafik verisi ve cevabı birlikte kontrol et. Mesajda görsellerin gösterilmediği belirtiliyorsa veya gereken görsel eksik/okunamazsa solution_correct için unsure yaz ve eksikliği belirt. Alt metni görseli görmenin yerine kullanma.
Kapsam ayrımı: Kaynak hücresi/hash doğrulaması, içerikteki kazanım ilişkisi ve bağımsız alan uzmanı onayı ayrı olgulardır. subject_expert_approval=false, pending_subject_review ve okul senaryosu seçilmemiş olması kendi başına soru/çözüm/rubrik hatası değildir; bunları gerekiyorsa advisory olarak kaydet. Bunları yapılmış gibi gösterme. İçerik kazanımın verilen gerçek metnini ölçmüyorsa veya kaynak iddiası verilen kanıtla çelişiyorsa measures_target_skill=unsure/no ve somut bulgu yaz. Confidence yine incelemenin ve bulguların eksiksizliğine duyduğun güvendir; yönetici iş akışının tamamlanmışlığına verilen puan değildir. Gerçek içerik belirsizliğini, hesap/anahtar hatasını, rubrik çelişkisini, dil ve yaş sorununu açıkça işaretle. Yanıtın kısa olsun; her özeti en çok400 karakter tut. Hiçbir puan ya da öneri hedeflenmez. Her kaydı bağımsız incele.`;

export const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    confidence: { type: "number" },
    recommendation: { type: "string", enum: ["approve", "admin_review", "reject"] },
    rubric: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        RUBRIC_KEYS.map((k) => [k, { type: "string", enum: [...RUBRIC_ANSWERS] }]),
      ),
      required: [...RUBRIC_KEYS],
    },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string", enum: [...FINDING_CODES] },
          severity: { type: "string", enum: [...FINDING_SEVERITIES] },
          detail: { type: "string" },
          item: { type: ["string", "null"] },
        },
        required: ["code", "severity", "detail", "item"],
      },
    },
    summary: { type: "string" },
  },
  required: ["confidence", "recommendation", "rubric", "findings", "summary"],
};

function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function text(v: unknown, max: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}
function sameKeys(v: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(v).sort().join() === [...keys].sort().join();
}

/** Strict contract check. Anything off-shape is `ai_result_invalid` (retryable, counted). */
export function validateOutput(value: unknown): PrereviewOutput {
  if (
    !record(value) ||
    !sameKeys(value, ["confidence", "recommendation", "rubric", "findings", "summary"])
  ) throw Error("ai_result_invalid");
  const confidence = value.confidence;
  if (
    typeof confidence !== "number" || !Number.isFinite(confidence) ||
    confidence < 0 || confidence > 1
  ) throw Error("ai_result_invalid");
  if (
    value.recommendation !== "approve" && value.recommendation !== "admin_review" &&
    value.recommendation !== "reject"
  ) throw Error("ai_result_invalid");
  if (!record(value.rubric) || !sameKeys(value.rubric, RUBRIC_KEYS)) {
    throw Error("ai_result_invalid");
  }
  for (const key of RUBRIC_KEYS) {
    if (!(RUBRIC_ANSWERS as readonly string[]).includes(String(value.rubric[key]))) {
      throw Error("ai_result_invalid");
    }
  }
  if (!Array.isArray(value.findings) || value.findings.length > 40) {
    throw Error("ai_result_invalid");
  }
  const findings: PrereviewFinding[] = [];
  for (const f of value.findings) {
    if (
      !record(f) || !sameKeys(f, ["code", "severity", "detail", "item"]) ||
      !(FINDING_CODES as readonly string[]).includes(String(f.code)) ||
      !(FINDING_SEVERITIES as readonly string[]).includes(String(f.severity)) ||
      !text(f.detail, 1000) || !(f.item === null || text(f.item, 120))
    ) throw Error("ai_result_invalid");
    findings.push({
      code: f.code as FindingCode,
      severity: f.severity as PrereviewFinding["severity"],
      detail: f.detail,
      item: f.item as string | null,
    });
  }
  if (!text(value.summary, 600)) throw Error("ai_result_invalid");
  return {
    confidence,
    recommendation: value.recommendation,
    rubric: value.rubric as unknown as PrereviewRubric,
    findings,
    summary: value.summary,
  };
}

export interface Decision {
  status: Exclude<PrereviewStatus, "pending">;
  reason: string;
}

/**
 * Threshold: confidence >= 0.85, every rubric answer at its pass value, no blocking finding and
 * an explicit approve -> ai_approved. An explicit reject backed by a blocking finding at the same
 * confidence -> ai_rejected_suggestion (still an admin decision). Everything else -> needs_admin.
 */
export function decide(
  output: PrereviewOutput,
  threshold = PREREVIEW_CONFIDENCE_THRESHOLD,
  context: { mediaCount?: number; mediaReviewed?: boolean } = {},
): Decision {
  const blocking = output.findings.filter((f) => f.severity === "blocking");
  const rubricFails = RUBRIC_KEYS.filter((k) => output.rubric[k] !== RUBRIC_PASS[k]);
  if (output.confidence < threshold) return { status: "needs_admin", reason: "low_confidence" };
  if (output.recommendation === "reject" && blocking.length > 0) {
    return { status: "ai_rejected_suggestion", reason: "blocking_finding" };
  }
  if (blocking.length > 0) return { status: "needs_admin", reason: "blocking_finding" };
  if (rubricFails.length > 0) {
    return { status: "needs_admin", reason: `rubric_${rubricFails[0]}` };
  }
  if (output.recommendation !== "approve") {
    return { status: "needs_admin", reason: "model_requested_review" };
  }
  // Complete, hash-checked image delivery is required in addition to the unchanged quality gate.
  if ((context.mediaCount ?? 0) > 0 && context.mediaReviewed !== true) return { status: "needs_admin", reason: "media_not_reviewed" };
  return { status: "ai_approved", reason: "all_checks_passed" };
}

/** Images are counted by the database; reviewed is set only after complete verified delivery. */
export function mediaFlag(count: number, reviewed = false) {
  return {
    count,
    reviewed: count > 0 && reviewed,
    image_dependent_correctness: count > 0 ? (reviewed ? "reviewed" : "not_proven") : "not_applicable",
  } as const;
}

/** Stored verdict: what the admin sees next to the record. Includes model/prompt provenance. */
export function buildVerdict(
  output: PrereviewOutput,
  decision: Decision,
  meta: {
    model: string;
    providerUsage?: AiResult<unknown>["providerUsage"];
    provider?: string | null;
    promptVersion: string;
    inputTokens: number | null;
    outputTokens: number | null;
    mediaCount?: number;
    mediaReviewed?: boolean;
    mediaProof?: {source_key:string;sha256:string}[];
  },
) {
  return {
    model: meta.model,
    provider: meta.provider ?? null,
    prompt_version: meta.promptVersion,
    confidence: output.confidence,
    recommendation: output.recommendation,
    decision_reason: decision.reason,
    rubric: output.rubric,
    findings: output.findings,
    summary: output.summary,
    input_tokens: meta.inputTokens,
    output_tokens: meta.outputTokens,
    media: mediaFlag(meta.mediaCount ?? 0, meta.mediaReviewed),
    ...(meta.mediaProof ? { media_proof: meta.mediaProof } : {}),
    advisory: true,
    ...(meta.providerUsage ? { provider_usage: meta.providerUsage } : {}),
  };
}

/** Verdict for a run that never produced a valid model output (kill switch, retry limit, etc.). */
export function failureVerdict(
  reason: string,
  detail: string | null,
  meta: { model?: string | null; provider?: string | null; promptVersion?: string; mediaCount?: number; providerUsage?: AiResult<unknown>["providerUsage"] } = {},
) {
  return {
    model: meta.model ?? null,
    provider: meta.provider ?? null,
    prompt_version: meta.promptVersion ?? PREREVIEW_PROMPT_VERSION,
    confidence: 0,
    recommendation: "admin_review",
    decision_reason: reason,
    ...(meta.providerUsage ? { provider_usage: meta.providerUsage } : {}),
    rubric: null,
    findings: [{ code: "other", severity: "advisory", detail: detail ?? reason, item: null }],
    summary: null,
    media: mediaFlag(meta.mediaCount ?? 0),
    advisory: true,
  };
}

/** The user message: normalized content as JSON, never a bare URL. */
export function buildUserMessage(content: Record<string, unknown>, mediaCount = 0, mediaReviewed = false): string {
  const kind = String(content.kind ?? "");
  const intro = kind === "library_package"
    ? "Kütüphane taslak paketi (öğrenci alanları, öğretmen cevap/çözüm/rubrik, ortak kaynak metinleri):"
    : kind === "contribution_set"
    ? "Aile katkı kopyası (yayın için önerilen özgün soru; aile ve çocuk kimliği çıkarıldı):"
    : "MEB ortak yazılı senaryo adayı (bloklar, soru sayıları ve tam kazanım metinleri):";
  const media = mediaCount > 0
    ? (mediaReviewed ? `\nBu kayıttaki ${mediaCount} görsel, kaynak anahtarlarıyla mesajda eklenmiştir. Görselleri gerçekten incele.` : `\nBu kayıtta ${mediaCount} görsel var ve sana GÖSTERİLMEDİ (yalnız alt metin). Görsele bağlı doğruluğu kanıtlanmış sayma.`)
    : "";
  return `${intro}${media}\n${JSON.stringify(content)}`;
}
