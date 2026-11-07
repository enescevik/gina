import { openAiUsage } from "./openai-usage.ts";
function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
Deno.test("OpenAI billing separates cache and does not add reasoning twice", () => {
  const u = openAiUsage({ prompt_tokens: 120, prompt_tokens_details: { cached_tokens: 80 }, completion_tokens: 60, completion_tokens_details: { reasoning_tokens: 20 } }, "req-test", "default");
  assert(u.input_tokens === 40 && u.cache_read_input_tokens === 80 && u.prompt_tokens_total === 120, "cache double counted");
  assert(u.output_tokens === 60 && u.reasoning_tokens === 20 && u.service_tier === "standard", "reasoning or tier");
});
Deno.test("OpenAI unreported or inconsistent billing counters stay unknown", () => {
  const absent = openAiUsage({ prompt_tokens: 120 }, null, undefined);
  assert(absent.input_tokens === null && absent.cache_read_input_tokens === null && absent.output_tokens === null, "unknown coerced to zero");
  const invalid = openAiUsage({ prompt_tokens: 10, prompt_tokens_details: { cached_tokens: 11 }, completion_tokens: -1 }, null, "flex");
  assert(invalid.input_tokens === null && invalid.cache_read_input_tokens === null && invalid.output_tokens === null && invalid.service_tier === null, "invalid billing accepted");
});
