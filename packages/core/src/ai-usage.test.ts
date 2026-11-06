import { describe, expect, it } from "vitest";

import { FEATURE_MATRIX, featureOffered } from "./ai-capabilities";
import { aiUsageRows, parseAiUsage } from "./ai-usage";
import { openScoreSource } from "./attempt-summary";
import { classifyServerError, errorAction } from "./shared-limits";

import migration from "../../../supabase/migrations/20261106290000_ai_routing_and_grade_split.sql?raw";

const usage = (over: Record<string, unknown> = {}) => ({
  plan: "pro",
  period_start: "2026-11-01T00:00:00+03:00",
  renews_at: "2026-12-01T00:00:00+03:00",
  enabled: true,
  paused: false,
  operations: [
    { action: "grade", enabled: true, limit: 30, used: 2, remaining: 28, max_media_items: 0, max_media_bytes: 0 },
    { action: "import", enabled: true, limit: 20, used: 20, remaining: 0, max_media_items: 5, max_media_bytes: 20971520 },
    { action: "plan", enabled: true, limit: 30, used: 0, remaining: 30, max_media_items: 0, max_media_bytes: 0 },
    { action: "weekly", enabled: true, limit: 5, used: 1, remaining: 4, max_media_items: 0, max_media_bytes: 0 },
  ],
  generate: { limit: 300, used: 12, remaining: 288 },
  setup: { limit: 30, remaining: 29 },
  features: [
    { feature: "daily_tips", action: "weekly", offered: false, in_plan: true, inputs: [], available: false },
    { feature: "document_analysis", action: "learning_import", offered: true, in_plan: true, inputs: ["image", "pdf"], available: true },
    { feature: "open_ended_grading", action: "grade", offered: true, in_plan: true, inputs: ["image", "text"], available: true },
    { feature: "photo_calendar", action: "import", offered: true, in_plan: true, inputs: ["image"], available: true },
    { feature: "question_generation", action: "generate", offered: true, in_plan: true, inputs: ["image", "pdf", "text"], available: true },
    { feature: "setup_suggestions", action: "setup", offered: true, in_plan: true, inputs: ["image", "pdf", "text"], available: true },
    { feature: "study_plan", action: "plan", offered: true, in_plan: true, inputs: ["text"], available: true },
    { feature: "weekly_summary", action: "weekly", offered: true, in_plan: true, inputs: ["text"], available: true },
  ],
  media: { max_files: 5, max_total_bytes: 20971520, max_image_bytes: 4194304, max_pdf_bytes: 10485760, max_pdf_pages: 5 },
  ...over,
});

describe("C08 AI usage single source", () => {
  it("daily_tips is not offered anywhere (core matrix and DB seed agree)", () => {
    expect(featureOffered("daily_tips")).toBe(false);
    expect(FEATURE_MATRIX.filter((r) => r.feature === "daily_tips").every((r) => r.offered === false)).toBe(true);
    expect(migration).toMatch(/update public\.ai_feature_requirements set offered=false where feature='daily_tips'/);
    for (const f of ["weekly_summary", "photo_calendar", "document_analysis", "question_generation", "open_ended_grading", "study_plan", "setup_suggestions"] as const) {
      expect(featureOffered(f)).toBe(true);
    }
  });

  it("parses get_ai_usage and lists only offered + available rows; tips never appear", () => {
    const parsed = parseAiUsage(usage());
    expect(parsed).not.toBeNull();
    const rows = aiUsageRows(parsed!);
    expect(rows.map((r) => r.key)).toEqual(["weekly", "import", "grade", "plan", "generate", "setup"]);
    expect(rows.flatMap((r) => r.features)).not.toContain("daily_tips");
    expect(rows.find((r) => r.key === "import")).toMatchObject({ used: 20, remaining: 0, features: ["photo_calendar", "document_analysis"] });
    expect(rows.find((r) => r.key === "setup")).toMatchObject({ used: 1, remaining: 29 });
  });

  it("plus without grading/plan shows no grading row; free shows nothing", () => {
    const plus = parseAiUsage(usage({
      plan: "plus",
      features: usage().features.map((f) => ["open_ended_grading", "study_plan"].includes(f.feature) ? { ...f, in_plan: false, available: false, inputs: [] } : f),
    }))!;
    expect(aiUsageRows(plus).map((r) => r.key)).not.toContain("grade");
    const free = parseAiUsage(usage({ plan: "free", enabled: false, features: usage().features.map((f) => ({ ...f, available: false })) }))!;
    expect(aiUsageRows(free)).toEqual([]);
  });

  it("broken or legacy (pre-C08) payload falls back safely", () => {
    expect(parseAiUsage(null)).toBeNull();
    expect(parseAiUsage({ plan: "gold" })).toBeNull();
    const legacy = parseAiUsage({ ...usage(), features: undefined, media: undefined, paused: undefined });
    expect(legacy?.features).toEqual([]);
    expect(aiUsageRows(legacy!)).toEqual([]);
  });
});

describe("C08 AI suggestion vs parent score", () => {
  it("distinguishes parent, AI suggestion, legacy AI and none", () => {
    expect(openScoreSource({ score: 80, graded_by: "parent", ai_score: 60 })).toBe("parent");
    expect(openScoreSource({ score: null, graded_by: null, ai_score: 60 })).toBe("ai_suggestion");
    expect(openScoreSource({ score: 70, graded_by: "ai", ai_score: 70 })).toBe("legacy_ai");
    expect(openScoreSource({ score: null, ai_score: null })).toBe("none");
  });
});

describe("C08 client error action", () => {
  it("gateway 401 without a contract body refreshes the session (same request, draft kept)", () => {
    expect(errorAction(classifyServerError({ status: 401, body: null }))).toBe("refresh_session");
    expect(errorAction(classifyServerError({ code: "session_expired", status: 401 }))).toBe("refresh_session");
    expect(errorAction(classifyServerError({ code: "unauthorized", status: 401 }))).toBe("sign_in");
  });
  it("uncertain paid result never invites a retry; rate limit and outages do", () => {
    expect(errorAction(classifyServerError({ code: "ai_result_uncertain", status: 502 }))).toBe("none");
    expect(errorAction(classifyServerError({ code: "ai_rate_limited", status: 429 }))).toBe("retry");
    expect(errorAction(classifyServerError({ code: "ai_temporarily_unavailable", status: 503 }))).toBe("retry");
    expect(errorAction(classifyServerError({ network: true }))).toBe("retry");
    expect(errorAction(classifyServerError({ code: "ai_quota_exceeded", status: 402 }))).toBe("upgrade");
    expect(errorAction(classifyServerError({ code: "plan_has_no_ai_grading", status: 402 }))).toBe("upgrade");
    expect(errorAction(classifyServerError({ code: "source_file_limit", status: 400 }))).toBe("fix_input");
    expect(errorAction(classifyServerError({ code: "ai_suggestion_changed", status: 400 }))).toBe("none");
  });
});
