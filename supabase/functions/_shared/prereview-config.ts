import type { AiConfig } from './prova.ts';

/** Review packages contain both stems and teacher material. Keep their bounded
 * input budget separate from family generation/grading, including every fallback. */
export function prereviewConfig(config: AiConfig, setting: unknown): AiConfig {
  const limit = setting ?? 24000;
  if (!Number.isInteger(limit) || Number(limit) < 1000 || Number(limit) > 32000) {
    throw Error('ai_configuration_unavailable');
  }
  const apply = (step: AiConfig): AiConfig => ({
    ...step,
    maxInputTokens: Math.max(0, Math.min(Number(limit),
      (step.capabilities?.contextTokens ?? Number(limit) + step.maxOutputTokens) - step.maxOutputTokens)),
  });
  return {
    ...apply(config),
    ...(config.chain ? { chain: { ...config.chain, steps: config.chain.steps.map(step => ({ ...step, config: apply(step.config) })) } } : {}),
  };
}
