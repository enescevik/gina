// S06 — AI yetenek matrisi: özellik → girdi türü → gereken model yeteneği → paket sınırı.
// Çalışma zamanındaki tek kaynak veritabanıdır (ai_models, ai_providers, ai_feature_requirements,
// ai_operation_policies, ai_settings); bu modül tipleri, kuralları ve varsayılan tohumları tanımlar.
// Kural: bir model yalnız adı yazılarak desteklenmiş sayılmaz — adapter + yetenek beyanı +
// sözleşme sürümü gerekir; aksi hâlde `unsupported` ve etkilenen özellikler listelenir.

export const AI_FEATURES = [
  "weekly_summary",
  "daily_tips",
  "photo_calendar",
  "document_analysis",
  "question_generation",
  "open_ended_grading",
  "study_plan",
  "pre_review",
  "setup_suggestions",
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

export const AI_INPUT_KINDS = ["text", "image", "pdf"] as const;
export type AiInputKind = (typeof AI_INPUT_KINDS)[number];

export const AI_PROVIDERS = ["anthropic", "openai_compatible", "gemini"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

/** Edge tarafında gerçekten var olan adapter kimlikleri. Yeni adapter eklenmeden yeni değer yazılmaz. */
export const AI_ADAPTERS = ["anthropic-messages", "openai-chat", "gemini-generate"] as const;
export type AiAdapterId = (typeof AI_ADAPTERS)[number];

export type AiPlan = "free" | "plus" | "pro";
export const AI_PLANS: AiPlan[] = ["free", "plus", "pro"];

/** Sunucudaki iş kuyruğu eylem kodu (ai_operation_jobs.action / özel rezervasyon RPC'si). */
export type AiAction = "weekly" | "import" | "learning_import" | "generate" | "grade" | "plan" | "setup" | "preflight";

export type AiCostClass = "low" | "medium" | "high";
export type AiTokenizer = "provider_count" | "estimate";

export interface ModelCapabilities {
  vision: boolean;
  pdf: boolean;
  jsonSchema: boolean;
  contextTokens: number;
  tokenizer: AiTokenizer;
}

/** ai_models satırının yetenekle ilgili alanları. */
export interface AiModelRecord extends Partial<ModelCapabilities> {
  id: string;
  provider: string;
  active: boolean;
  adapter: string | null;
  contractVersion: string | null;
  costClass?: AiCostClass;
}

export interface AiProviderRecord {
  id: AiProviderId;
  displayName: string;
  adapter: AiAdapterId;
  /** Yalnız gizli anahtarın ADI (Vault/Edge secret). Değer hiçbir zaman kodda veya DB'de tutulmaz. */
  keySecretName: string;
  dataRegion: "us" | "eu" | "tr" | "global";
  /** Veri Türkiye dışına çıkıyor mu (KVKK yurt dışı aktarım). */
  crossBorder: boolean;
  costClass: AiCostClass;
  status: "active" | "unconfigured" | "unsupported";
}

export interface FeatureRequirement {
  feature: AiFeature;
  input: AiInputKind;
  action: AiAction;
  requires: { vision: boolean; pdf: boolean; jsonSchema: boolean; minContextTokens: number };
  /** Bu özelliğin sunulduğu paketler. */
  plans: AiPlan[];
  /** Mevcut Edge giriş noktası; null = henüz ayrı uç nokta yok. */
  entryPoint: string | null;
}

export interface PlanFeatureLimit {
  plan: AiPlan;
  feature: AiFeature;
  monthlyOperations: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxMediaItems: number;
  maxMediaBytes: number;
}

const req = (
  vision: boolean,
  pdf: boolean,
  minContextTokens: number,
): FeatureRequirement["requires"] => ({ vision, pdf, jsonSchema: true, minContextTokens });

const PAID: AiPlan[] = ["plus", "pro"];
const PRO: AiPlan[] = ["pro"];

/** Özellik → girdi türü → gereken yetenek. Girdi türü satırda yoksa o özellik o girdiyi kabul etmez. */
export const FEATURE_MATRIX: readonly FeatureRequirement[] = [
  { feature: "weekly_summary", input: "text", action: "weekly", requires: req(false, false, 16_000), plans: PAID, entryPoint: "ai-weekly-summary" },
  { feature: "daily_tips", input: "text", action: "weekly", requires: req(false, false, 16_000), plans: PRO, entryPoint: null },
  { feature: "photo_calendar", input: "image", action: "import", requires: req(true, false, 32_000), plans: PAID, entryPoint: "timetable-import" },
  { feature: "document_analysis", input: "image", action: "learning_import", requires: req(true, false, 32_000), plans: PAID, entryPoint: "learning-plan-import" },
  { feature: "document_analysis", input: "pdf", action: "learning_import", requires: req(false, true, 64_000), plans: PAID, entryPoint: "learning-plan-import" },
  { feature: "question_generation", input: "text", action: "generate", requires: req(false, false, 32_000), plans: PAID, entryPoint: "prova-generate" },
  { feature: "question_generation", input: "image", action: "generate", requires: req(true, false, 32_000), plans: PAID, entryPoint: "prova-generate" },
  { feature: "question_generation", input: "pdf", action: "generate", requires: req(false, true, 64_000), plans: PAID, entryPoint: "prova-generate" },
  { feature: "open_ended_grading", input: "text", action: "grade", requires: req(false, false, 32_000), plans: PRO, entryPoint: "prova-grade" },
  { feature: "open_ended_grading", input: "image", action: "grade", requires: req(true, false, 32_000), plans: PRO, entryPoint: "prova-review" },
  { feature: "study_plan", input: "text", action: "plan", requires: req(false, false, 32_000), plans: PRO, entryPoint: "prova-plan" },
  { feature: "pre_review", input: "text", action: "preflight", requires: req(false, false, 8_000), plans: [], entryPoint: "ai-preflight" },
  { feature: "pre_review", input: "image", action: "preflight", requires: req(true, false, 8_000), plans: [], entryPoint: "ai-preflight" },
  { feature: "pre_review", input: "pdf", action: "preflight", requires: req(false, true, 8_000), plans: [], entryPoint: "ai-preflight" },
  { feature: "setup_suggestions", input: "text", action: "setup", requires: req(false, false, 16_000), plans: PAID, entryPoint: "setup-suggestions" },
  { feature: "setup_suggestions", input: "image", action: "setup", requires: req(true, false, 32_000), plans: PAID, entryPoint: "setup-suggestions" },
  { feature: "setup_suggestions", input: "pdf", action: "setup", requires: req(false, true, 64_000), plans: PAID, entryPoint: "setup-suggestions" },
];

/** Sağlayıcı kayıt varsayılanları (ai_providers tohumu). Değer değil, yalnız secret adı. */
export const PROVIDER_DEFAULTS: readonly AiProviderRecord[] = [
  { id: "anthropic", displayName: "Anthropic", adapter: "anthropic-messages", keySecretName: "ANTHROPIC_API_KEY", dataRegion: "us", crossBorder: true, costClass: "medium", status: "active" },
  { id: "openai_compatible", displayName: "OpenAI uyumlu (Chat Completions)", adapter: "openai-chat", keySecretName: "OPENAI_API_KEY", dataRegion: "us", crossBorder: true, costClass: "medium", status: "unconfigured" },
  { id: "gemini", displayName: "Google Gemini", adapter: "gemini-generate", keySecretName: "GEMINI_API_KEY", dataRegion: "global", crossBorder: true, costClass: "low", status: "unconfigured" },
];

export const MEDIA_BYTES = { image: 4 * 1024 * 1024, pdf: 10 * 1024 * 1024 } as const;

/** Paket sınırı varsayılanları — mevcut DB tohumlarıyla aynı (ai_operation_policies, plans.prova_ai_generate_monthly,
 * plans.setup_ai_monthly, ai_settings varsayılan token'ları, sources.max_files, source-file bayt sınırları).
 * Çalışma zamanında tek kaynak DB'dir (admin_ai_policy_matrix / get_ai_usage). */
export const PLAN_LIMIT_DEFAULTS: readonly PlanFeatureLimit[] = (() => {
  const rows: PlanFeatureLimit[] = [];
  const monthly: Record<AiFeature, Record<AiPlan, number>> = {
    weekly_summary: { free: 0, plus: 5, pro: 5 },
    daily_tips: { free: 0, plus: 0, pro: 0 },
    photo_calendar: { free: 0, plus: 5, pro: 20 },
    document_analysis: { free: 0, plus: 5, pro: 20 },
    question_generation: { free: 0, plus: 100, pro: 300 },
    open_ended_grading: { free: 0, plus: 0, pro: 30 },
    study_plan: { free: 0, plus: 0, pro: 30 },
    pre_review: { free: 0, plus: 0, pro: 0 },
    setup_suggestions: { free: 0, plus: 10, pro: 30 },
  };
  for (const feature of AI_FEATURES) {
    for (const plan of AI_PLANS) {
      const inputs = FEATURE_MATRIX.filter((r) => r.feature === feature).map((r) => r.input);
      const media = inputs.includes("pdf") ? MEDIA_BYTES.pdf : inputs.includes("image") ? MEDIA_BYTES.image : 0;
      rows.push({
        plan,
        feature,
        monthlyOperations: monthly[feature][plan],
        maxInputTokens: 8_000,
        maxOutputTokens: 1_500,
        maxMediaItems: media && monthly[feature][plan] > 0 ? 5 : 0,
        maxMediaBytes: media,
      });
    }
  }
  return rows;
})();

export function featureRequirements(feature: AiFeature, input?: AiInputKind): FeatureRequirement[] {
  return FEATURE_MATRIX.filter((r) => r.feature === feature && (input === undefined || r.input === input));
}

export function capabilitiesOf(model: AiModelRecord): ModelCapabilities | null {
  if (!Number.isInteger(model.contextTokens) || (model.contextTokens ?? 0) <= 0) return null;
  if (model.tokenizer !== "provider_count" && model.tokenizer !== "estimate") return null;
  return {
    vision: model.vision === true,
    pdf: model.pdf === true,
    jsonSchema: model.jsonSchema === true,
    contextTokens: model.contextTokens as number,
    tokenizer: model.tokenizer,
  };
}

export type ModelSupportReason =
  | "adapter_missing"
  | "adapter_unknown"
  | "contract_missing"
  | "capabilities_missing"
  | "provider_unknown"
  | "provider_unconfigured"
  | "provider_unsupported";

export interface FeatureSupport {
  feature: AiFeature;
  input: AiInputKind;
  supported: boolean;
  missing: string[];
}

export interface ModelSupport {
  supported: boolean;
  reasons: ModelSupportReason[];
  features: FeatureSupport[];
  unsupportedFeatures: { feature: AiFeature; input: AiInputKind }[];
}

/** Bir model/özellik/girdi için eksik yetenekler. Model desteksizse her satır desteksizdir. */
export function featureSupport(model: AiModelRecord, feature: AiFeature, input: AiInputKind, caps = capabilitiesOf(model)): FeatureSupport {
  const row = FEATURE_MATRIX.find((r) => r.feature === feature && r.input === input);
  if (!row) return { feature, input, supported: false, missing: ["input_not_accepted"] };
  if (!caps) return { feature, input, supported: false, missing: ["capabilities_missing"] };
  const missing: string[] = [];
  if (row.requires.vision && !caps.vision) missing.push("vision");
  if (row.requires.pdf && !caps.pdf) missing.push("pdf");
  if (row.requires.jsonSchema && !caps.jsonSchema) missing.push("json_schema");
  if (caps.contextTokens < row.requires.minContextTokens) missing.push("context_tokens");
  return { feature, input, supported: missing.length === 0, missing };
}

export function modelSupport(model: AiModelRecord, providers: readonly AiProviderRecord[] = PROVIDER_DEFAULTS): ModelSupport {
  const reasons: ModelSupportReason[] = [];
  if (!model.adapter) reasons.push("adapter_missing");
  else if (!(AI_ADAPTERS as readonly string[]).includes(model.adapter)) reasons.push("adapter_unknown");
  if (!model.contractVersion) reasons.push("contract_missing");
  const caps = capabilitiesOf(model);
  if (!caps) reasons.push("capabilities_missing");
  const provider = providers.find((p) => p.id === model.provider);
  if (!provider) reasons.push("provider_unknown");
  else if (provider.status === "unconfigured") reasons.push("provider_unconfigured");
  else if (provider.status === "unsupported") reasons.push("provider_unsupported");
  const features = FEATURE_MATRIX.map((r) => {
    const f = featureSupport(model, r.feature, r.input, caps);
    return reasons.length ? { ...f, supported: false, missing: [...new Set([...reasons, ...f.missing])] } : f;
  });
  return {
    supported: reasons.length === 0,
    reasons,
    features,
    unsupportedFeatures: features.filter((f) => !f.supported).map(({ feature, input }) => ({ feature, input })),
  };
}

export interface PlanAiSetting {
  plan: AiPlan;
  modelId: string | null;
  enabled: boolean;
}

export interface ModelDisablePreview {
  modelId: string;
  affectedPlans: AiPlan[];
  affectedFeatures: { feature: AiFeature; inputs: AiInputKind[]; plans: AiPlan[] }[];
  /** Aynı sağlayıcıdan, desteklenen ve etkin alternatif modeller. */
  alternatives: string[];
}

/** Model kapatıldığında hangi paket ve özelliklerin duracağı. */
export function modelDisablePreview(modelId: string, settings: readonly PlanAiSetting[], models: readonly AiModelRecord[], providers = PROVIDER_DEFAULTS): ModelDisablePreview {
  const affectedPlans = settings.filter((s) => s.enabled && s.modelId === modelId).map((s) => s.plan);
  const byFeature = new Map<AiFeature, { inputs: Set<AiInputKind>; plans: Set<AiPlan> }>();
  for (const row of FEATURE_MATRIX) {
    const plans = row.plans.filter((p) => affectedPlans.includes(p));
    if (!plans.length) continue;
    const entry = byFeature.get(row.feature) ?? { inputs: new Set(), plans: new Set() };
    entry.inputs.add(row.input);
    plans.forEach((p) => entry.plans.add(p));
    byFeature.set(row.feature, entry);
  }
  const target = models.find((m) => m.id === modelId);
  const alternatives = models
    .filter((m) => m.id !== modelId && m.active && (!target || m.provider === target.provider) && modelSupport(m, providers).supported)
    .map((m) => m.id);
  return {
    modelId,
    affectedPlans,
    affectedFeatures: [...byFeature].map(([feature, v]) => ({ feature, inputs: [...v.inputs], plans: [...v.plans] })),
    alternatives,
  };
}

export interface ProviderChangeImpact {
  from: AiProviderId;
  to: AiProviderId;
  blocked: boolean;
  blockReasons: ("provider_unconfigured" | "provider_unsupported" | "no_supported_model" | "same_provider")[];
  affectedFeatures: { feature: AiFeature; inputs: AiInputKind[]; plans: AiPlan[] }[];
  /** Veri işleyen değişir: aydınlatma/açık rıza metni ve DPA güncellemesi gerekir. */
  newProcessor: boolean;
  crossBorderTransfer: boolean;
  regionChange: { from: AiProviderRecord["dataRegion"]; to: AiProviderRecord["dataRegion"] } | null;
  costClass: { from: AiCostClass; to: AiCostClass; direction: "up" | "down" | "same" };
  /** Hedef sağlayıcıda desteklenen etkin modeller. */
  candidateModels: string[];
  /** Hedefte hiçbir model desteklemediği özellik/girdi satırları. */
  featureGaps: { feature: AiFeature; input: AiInputKind }[];
}

const COST_RANK: Record<AiCostClass, number> = { low: 0, medium: 1, high: 2 };

export function providerChangeImpact(
  from: AiProviderId,
  to: AiProviderId,
  settings: readonly PlanAiSetting[],
  models: readonly AiModelRecord[],
  providers: readonly AiProviderRecord[] = PROVIDER_DEFAULTS,
): ProviderChangeImpact {
  const src = providers.find((p) => p.id === from);
  const dst = providers.find((p) => p.id === to);
  if (!src || !dst) throw new Error("provider_unknown");
  const blockReasons: ProviderChangeImpact["blockReasons"] = [];
  if (from === to) blockReasons.push("same_provider");
  if (dst.status === "unconfigured") blockReasons.push("provider_unconfigured");
  if (dst.status === "unsupported") blockReasons.push("provider_unsupported");
  const candidates = models.filter((m) => m.provider === to && m.active && modelSupport(m, providers).supported);
  if (!candidates.length) blockReasons.push("no_supported_model");
  const fromPlans = settings
    .filter((s) => s.enabled && s.modelId && models.some((m) => m.id === s.modelId && m.provider === from))
    .map((s) => s.plan);
  const byFeature = new Map<AiFeature, { inputs: Set<AiInputKind>; plans: Set<AiPlan> }>();
  const featureGaps: ProviderChangeImpact["featureGaps"] = [];
  for (const row of FEATURE_MATRIX) {
    const plans = row.plans.filter((p) => fromPlans.includes(p));
    if (!plans.length) continue;
    const entry = byFeature.get(row.feature) ?? { inputs: new Set(), plans: new Set() };
    entry.inputs.add(row.input);
    plans.forEach((p) => entry.plans.add(p));
    byFeature.set(row.feature, entry);
    if (!candidates.some((m) => featureSupport(m, row.feature, row.input).supported)) featureGaps.push({ feature: row.feature, input: row.input });
  }
  const dir = COST_RANK[dst.costClass] - COST_RANK[src.costClass];
  return {
    from,
    to,
    blocked: blockReasons.length > 0,
    blockReasons,
    affectedFeatures: [...byFeature].map(([feature, v]) => ({ feature, inputs: [...v.inputs], plans: [...v.plans] })),
    newProcessor: from !== to,
    crossBorderTransfer: dst.crossBorder,
    regionChange: src.dataRegion === dst.dataRegion ? null : { from: src.dataRegion, to: dst.dataRegion },
    costClass: { from: src.costClass, to: dst.costClass, direction: dir > 0 ? "up" : dir < 0 ? "down" : "same" },
    candidateModels: candidates.map((m) => m.id),
    featureGaps,
  };
}

/** Sağlayıcı tokenizer'ı yokken kullanılan muhafazakâr tahmin (Türkçe için ~3 bayt/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(new TextEncoder().encode(text).length / 3);
}

export interface MediaCheck {
  ok: boolean;
  reason: "too_many_items" | "item_too_large" | "media_not_allowed" | null;
}

export function mediaWithinLimit(items: readonly { bytes: number }[], limit: Pick<PlanFeatureLimit, "maxMediaItems" | "maxMediaBytes">): MediaCheck {
  if (items.length === 0) return { ok: true, reason: null };
  if (limit.maxMediaItems === 0) return { ok: false, reason: "media_not_allowed" };
  if (items.length > limit.maxMediaItems) return { ok: false, reason: "too_many_items" };
  if (items.some((i) => i.bytes > limit.maxMediaBytes)) return { ok: false, reason: "item_too_large" };
  return { ok: true, reason: null };
}

export interface AiUsageRow {
  action: string;
  used: number;
  limit: number;
  remaining: number;
  renewsAt: string;
}

/** Yenilenme bilgisini tek biçimde hesaplar: kalan asla negatif gösterilmez. */
export function usageRow(action: string, used: number, limit: number, renewsAt: string): AiUsageRow {
  return { action, used, limit, remaining: Math.max(0, limit - used), renewsAt };
}
