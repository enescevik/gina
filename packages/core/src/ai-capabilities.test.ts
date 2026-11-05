import { describe, expect, it } from "vitest";
import {
  AI_FEATURES,
  type AiModelRecord,
  estimateTokens,
  FEATURE_MATRIX,
  featureSupport,
  mediaWithinLimit,
  modelDisablePreview,
  modelSupport,
  PLAN_LIMIT_DEFAULTS,
  PROVIDER_DEFAULTS,
  providerChangeImpact,
  usageRow,
} from "./ai-capabilities";

const haiku: AiModelRecord = {
  id: "claude-haiku-5-5",
  provider: "anthropic",
  active: true,
  adapter: "anthropic-messages",
  contractVersion: "s06-v1",
  vision: true,
  pdf: true,
  jsonSchema: true,
  contextTokens: 200_000,
  tokenizer: "provider_count",
};
const sonnet: AiModelRecord = { ...haiku, id: "claude-sonnet-5-5" };
/** Yalnız adı yazılmış model: adapter, sözleşme ve yetenek yok. */
const nameOnly: AiModelRecord = {
  id: "gpt-5-mini",
  provider: "openai_compatible",
  active: true,
  adapter: null,
  contractVersion: null,
};
const settings = [
  { plan: "free" as const, modelId: null, enabled: false },
  { plan: "plus" as const, modelId: "claude-haiku-5-5", enabled: true },
  { plan: "pro" as const, modelId: "claude-sonnet-5-5", enabled: true },
];

describe("ai capability matrix", () => {
  it("covers every feature with at least one input row and json output", () => {
    for (const feature of AI_FEATURES) {
      const rows = FEATURE_MATRIX.filter((r) => r.feature === feature);
      expect(rows.length, feature).toBeGreaterThan(0);
      expect(rows.every((r) => r.requires.jsonSchema)).toBe(true);
    }
    expect(FEATURE_MATRIX.filter((r) => r.input === "image").every((r) => r.requires.vision)).toBe(true);
    expect(FEATURE_MATRIX.filter((r) => r.input === "pdf").every((r) => r.requires.pdf)).toBe(true);
  });

  it("marks a name-only model unsupported and lists every affected feature", () => {
    const support = modelSupport(nameOnly);
    expect(support.supported).toBe(false);
    expect(support.reasons).toEqual(["adapter_missing", "contract_missing", "capabilities_missing", "provider_unconfigured"]);
    expect(support.unsupportedFeatures.length).toBe(FEATURE_MATRIX.length);
    expect(support.unsupportedFeatures.some((f) => f.feature === "weekly_summary")).toBe(true);
  });

  it("a declared adapter without a contract test is still unsupported", () => {
    const declared = { ...nameOnly, adapter: "openai-chat", vision: true, pdf: false, jsonSchema: true, contextTokens: 128_000, tokenizer: "estimate" as const };
    const providers = PROVIDER_DEFAULTS.map((p) => (p.id === "openai_compatible" ? { ...p, status: "active" as const } : p));
    expect(modelSupport(declared, providers).reasons).toEqual(["contract_missing"]);
    expect(modelSupport({ ...declared, contractVersion: "s06-v1" }, providers).supported).toBe(true);
  });

  it("missing vision or pdf blocks only the matching input rows", () => {
    const textOnly = { ...haiku, vision: false, pdf: false };
    expect(featureSupport(textOnly, "weekly_summary", "text").supported).toBe(true);
    expect(featureSupport(textOnly, "photo_calendar", "image").missing).toEqual(["vision"]);
    expect(featureSupport(textOnly, "document_analysis", "pdf").missing).toEqual(["pdf"]);
    expect(featureSupport(haiku, "weekly_summary", "pdf").missing).toEqual(["input_not_accepted"]);
    expect(featureSupport({ ...haiku, contextTokens: 4_000 }, "study_plan", "text").missing).toEqual(["context_tokens"]);
  });

  it("anthropic seeds are fully supported", () => {
    expect(modelSupport(haiku).supported).toBe(true);
    expect(modelSupport(sonnet).unsupportedFeatures).toEqual([]);
  });

  it("model disable preview names affected plans, features and alternatives", () => {
    const preview = modelDisablePreview("claude-sonnet-5-5", settings, [haiku, sonnet, nameOnly]);
    expect(preview.affectedPlans).toEqual(["pro"]);
    const features = preview.affectedFeatures.map((f) => f.feature);
    expect(features).toContain("open_ended_grading");
    expect(features).toContain("study_plan");
    expect(features).toContain("weekly_summary");
    expect(preview.alternatives).toEqual(["claude-haiku-5-5"]);
    expect(modelDisablePreview("unknown", settings, [haiku, sonnet]).affectedPlans).toEqual([]);
  });

  it("provider change to an unconfigured provider is blocked but still reports impact", () => {
    const impact = providerChangeImpact("anthropic", "openai_compatible", settings, [haiku, sonnet, nameOnly]);
    expect(impact.blocked).toBe(true);
    expect(impact.blockReasons).toEqual(["provider_unconfigured", "no_supported_model"]);
    expect(impact.newProcessor).toBe(true);
    expect(impact.crossBorderTransfer).toBe(true);
    expect(impact.regionChange).toBeNull();
    expect(impact.affectedFeatures.map((f) => f.feature)).toContain("photo_calendar");
    expect(impact.featureGaps.length).toBe(impact.affectedFeatures.reduce((n, f) => n + f.inputs.length, 0));
  });

  it("provider change with a supported target model exposes region and cost class deltas", () => {
    const providers = PROVIDER_DEFAULTS.map((p) => (p.id === "gemini" ? { ...p, status: "active" as const } : p));
    const gemini: AiModelRecord = { ...haiku, id: "gemini-x", provider: "gemini", adapter: "gemini-generate", pdf: false };
    const impact = providerChangeImpact("anthropic", "gemini", settings, [haiku, sonnet, gemini], providers);
    expect(impact.blocked).toBe(false);
    expect(impact.candidateModels).toEqual(["gemini-x"]);
    expect(impact.regionChange).toEqual({ from: "us", to: "global" });
    expect(impact.costClass.direction).toBe("down");
    expect(impact.featureGaps.every((g) => g.input === "pdf")).toBe(true);
    expect(impact.featureGaps.length).toBeGreaterThan(0);
    expect(() => providerChangeImpact("anthropic", "nope" as never, settings, [])).toThrow("provider_unknown");
    expect(providerChangeImpact("anthropic", "anthropic", settings, [haiku, sonnet]).blockReasons).toEqual(["same_provider"]);
  });

  it("plan limits exist for every feature and plan; free has no AI", () => {
    expect(PLAN_LIMIT_DEFAULTS.length).toBe(AI_FEATURES.length * 3);
    expect(PLAN_LIMIT_DEFAULTS.filter((l) => l.plan === "free").every((l) => l.monthlyOperations === 0 && l.maxMediaItems === 0)).toBe(true);
    const photo = PLAN_LIMIT_DEFAULTS.find((l) => l.plan === "pro" && l.feature === "photo_calendar")!;
    expect(photo.monthlyOperations).toBe(20);
    expect(photo.maxMediaBytes).toBe(4 * 1024 * 1024);
    expect(mediaWithinLimit([{ bytes: 1 }], photo).ok).toBe(true);
    expect(mediaWithinLimit([{ bytes: 5 * 1024 * 1024 }], photo).reason).toBe("item_too_large");
    expect(mediaWithinLimit(new Array(6).fill({ bytes: 1 }), photo).reason).toBe("too_many_items");
    expect(mediaWithinLimit([{ bytes: 1 }], { maxMediaItems: 0, maxMediaBytes: 0 }).reason).toBe("media_not_allowed");
  });

  it("token estimate is conservative and usage never shows negative remaining", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("Çocuğun haftası")).toBeGreaterThanOrEqual(6);
    expect(usageRow("weekly", 7, 5, "2026-12-01T00:00:00Z").remaining).toBe(0);
    expect(usageRow("weekly", 2, 5, "2026-12-01T00:00:00Z")).toEqual({ action: "weekly", used: 2, limit: 5, remaining: 3, renewsAt: "2026-12-01T00:00:00Z" });
  });
});
