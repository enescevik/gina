import { TIMETABLE_PNG } from "./fixture.ts";
import {
  TIMETABLE_SCHEMA,
  TIMETABLE_SYSTEM,
  validateTimetableExtraction,
} from "../_shared/timetable-extraction.ts";
import { handlePreflight } from "./handler.ts";
import { callClaude, resolveAi } from "../_shared/prova.ts";
import { serviceClient } from "../_shared/supabase.ts";

Deno.serve((req) =>
  handlePreflight(req, {
    operatorKey: Deno.env.get("GINA_PREFLIGHT_TOKEN"),
    expiresAt: Deno.env.get("GINA_PREFLIGHT_EXPIRES_AT"),
    providerKey: Deno.env.get("ANTHROPIC_API_KEY"),
    fetch,
    smoke: async (mode) => {
      const config = await resolveAi(serviceClient(), "pro", 256);
      if (config instanceof Response) {
        throw new Error("configuration_unavailable");
      }
      if (mode === "document-smoke") {
        const result = await callClaude<unknown>(
          Deno.env.get("ANTHROPIC_API_KEY")!,
          {
            ...config,
            maxOutputTokens: Math.min(config.maxOutputTokens, 1024),
          },
          TIMETABLE_SYSTEM,
          [{
            type: "text",
            text:
              "Extract this synthetic timetable. Locale: tr. Missing times must remain null.",
          }, {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: TIMETABLE_PNG,
            },
          }],
          TIMETABLE_SCHEMA,
        );
        const output = validateTimetableExtraction(result.output, 1);
        const monday = output.lessons.find((lesson) => lesson.day === 1);
        const tuesday = output.lessons.find((lesson) => lesson.day === 2);
        return {
          valid: output.lessons.length === 2 && monday?.start === "09:00" &&
            monday.end === "09:40" && tuesday?.start === "10:00" &&
            tuesday.end === null,
          model: config.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        };
      }
      // Fixed, non-personal input; no caller-supplied prompt/model or automatic retry.
      const result = await callClaude<{ sum: number }>(
        Deno.env.get("ANTHROPIC_API_KEY")!,
        { ...config, maxOutputTokens: 256 },
        "This is a synthetic connectivity test. Return only the requested sum.",
        "What is 2 + 3?",
        {
          type: "object",
          properties: { sum: { type: "integer" } },
          required: ["sum"],
          additionalProperties: false,
        },
      );
      return {
        valid: result.output.sum === 5,
        model: config.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      };
    },
  })
);
