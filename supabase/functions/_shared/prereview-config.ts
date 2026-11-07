import type { AiConfig } from './prova.ts';

/** Review packages contain both stems and teacher material. Keep their bounded
 * input budget separate from family generation/grading, including every fallback. */
export function prereviewConfig(config: AiConfig, setting: unknown, outputSetting?: unknown): AiConfig {
  const limit = setting ?? 24000;
  if (!Number.isInteger(limit) || Number(limit) < 1000 || Number(limit) > 32000) {
    throw Error('ai_configuration_unavailable');
  }
  if (outputSetting !== undefined && (!Number.isInteger(outputSetting) || Number(outputSetting) < 1500 || Number(outputSetting) > 32000)) {
    throw Error('ai_configuration_unavailable');
  }
  const apply = (step: AiConfig): AiConfig => {
    const output = outputSetting === undefined ? step.maxOutputTokens : Number(outputSetting);
    const context = step.capabilities?.contextTokens ?? Number(limit) + output;
    if (output >= context) throw Error('ai_configuration_unavailable');
    return {
      ...step, maxOutputTokens: output, maxInputTokens: Math.min(Number(limit), context - output),
      // Match the reasoning setting used by the recorded review calibration.
      ...(step.adapter === 'openai-chat' && ['gpt-6.1-sol', 'gpt-6-astra'].includes(step.model)
        ? { reasoningEffort: 'medium' as const, imageDetail: 'high' as const, estimatedImageTokens: 4096 } : {}),
    };
  };
  return {
    ...apply(config),
    ...(config.chain ? { chain: { ...config.chain, steps: config.chain.steps.map(step => ({ ...step, config: apply(step.config) })) } } : {}),
  };
}
