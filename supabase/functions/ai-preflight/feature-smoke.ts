import { type AiConfig, callClaude } from "../_shared/prova.ts";
import {
  SCHEMA,
  SYSTEM,
  validateOutput,
} from "../ai-weekly-summary/handler.ts";
import {
  LEARNING_PLAN_SCHEMA,
  LEARNING_PLAN_SYSTEM,
  validateLearningPlanExtraction,
} from "../_shared/learning-plan-extraction.ts";
import { setupPrompt } from "../_shared/setup-prompt.ts";
import { setupDocumentResult } from "../_shared/setup-drafts.ts";
import { LEARNING_PNG, SETUP_PNG } from "./feature-fixture.ts";

export const featureModes = [
  "weekly-smoke",
  "learning-smoke",
  "task-smoke",
  "reward-smoke",
] as const;
export type FeatureMode = typeof featureModes[number];

/** Fixed synthetic samples only. Never accept a prompt, file, family or model from the caller. */
export async function featureSmoke(
  mode: FeatureMode,
  key: string,
  config: AiConfig,
  generate = callClaude,
) {
  const cfg = {
    ...config,
    maxOutputTokens: Math.min(config.maxOutputTokens, 2048),
  };
  if (mode === "weekly-smoke") {
    const result = await generate(
      key,
      cfg,
      SYSTEM,
      JSON.stringify({
        locale: "tr",
        week_start: "2026-10-26",
        children: [
          {
            alias: "Çocuk A",
            grade: 5,
            tasks: [{ status: "approved", count: 2 }, {
              status: "done",
              count: 1,
            }],
            stars_earned: 4,
          },
          {
            alias: "Çocuk B",
            grade: 5,
            tasks: [],
            stars_earned: 0,
          },
        ],
      }),
      SCHEMA,
    );
    const output = validateOutput(result.output, ["Çocuk A", "Çocuk B"]);
    if (!Array.isArray(output.cocuk_basina)) throw Error("ai_result_invalid");
    const empty = output.cocuk_basina.find((c: Record<string, unknown>) =>
      c.etiket === "Çocuk B"
    );
    return {
      valid: Array.isArray(empty?.zorlananlar) &&
        empty.zorlananlar.length === 0,
      model: cfg.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      sample: output,
    };
  }
  const image = (data: string) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: "image/png" as const, data },
  });
  if (mode === "learning-smoke") {
    const result = await generate(key, cfg, LEARNING_PLAN_SYSTEM, [
      { type: "text", text: JSON.stringify({ locale: "tr", grade: 5 }) },
      image(LEARNING_PNG),
    ], LEARNING_PLAN_SCHEMA);
    const output = validateLearningPlanExtraction(result.output, 1);
    const homework = output.items.find((i) => i.kind === "homework");
    const course = output.items.find((i) => i.kind === "course");
    return {
      valid: output.items.length === 2 && homework?.due_on === null &&
        homework.time === null &&
        course?.due_on === "2026-11-12" && course.time === "16:30",
      model: cfg.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      sample: output,
    };
  }
  const kind = mode === "task-smoke" ? "task" : "reward";
  const { system, schema } = setupPrompt({ kind }, true);
  const result = await generate<
    { suggestions?: unknown; document_notes?: unknown }
  >(key, cfg, system, [
    {
      type: "text",
      text: JSON.stringify({
        kind,
        grade: 5,
        age_band: "10-13",
        interests: ["reading", "nature"],
        locale: "tr",
      }),
    },
    image(SETUP_PNG),
  ], schema);
  const output = setupDocumentResult(
    result.output,
    kind,
    "00000000-0000-4000-8000-000000000001",
  );
  return {
    valid: output.suggestions.length > 0,
    model: cfg.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    sample: output,
  };
}
