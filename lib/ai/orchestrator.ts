/**
 * Lexia AI - Stream orchestrator with fallback
 *
 * Single place that: resolves the provider model, runs streamText with the
 * controller's decision, and on failure retries with the configured fallback model.
 * The route stays a thin HTTP layer and delegates to this orchestrator.
 */

import { streamText, stepCountIs } from 'ai'
import type { ControllerDecision } from './types'
import { resolveModel } from './resolver'
import { getRoutingRule, getModelConfig } from './providers'

/** Messages compatible with streamText (ModelMessage[]). */
export type StreamOptions = {
  messages: Array<{ role: string; content: unknown }>
  decision: ControllerDecision
  tools: Record<string, unknown>
}

export type OrchestratorResult = {
  result: ReturnType<typeof streamText>
  decision: ControllerDecision
}

/**
 * Runs streamText with the primary model from the decision; on throw, retries
 * with the intent's fallback model and returns the fallback result and updated decision.
 */
export async function runStreamWithFallback(
  options: StreamOptions
): Promise<OrchestratorResult> {
  const { messages, decision, tools } = options
  const config = decision.serviceConfig

  const streamOptions = {
    system: config.systemPrompt,
    messages,
    stopWhen: stepCountIs(5),
    tools,
    toolChoice: 'auto' as const,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  }

  try {
    const model = resolveModel(config.model)
    const result = streamText({
      model,
      ...streamOptions,
    } as Parameters<typeof streamText>[0])
    return { result, decision }
  } catch (primaryError) {
    console.warn('[Lexia Orchestrator] Primary model failed, using fallback:', primaryError)
    const rule = getRoutingRule(decision.classification.intent)
    const fallbackConfig = getModelConfig(rule.fallbackModel)
    if (!fallbackConfig) {
      throw primaryError
    }
    const fallbackDecision: ControllerDecision = {
      ...decision,
      classification: {
        ...decision.classification,
        model: fallbackConfig.model,
        provider: fallbackConfig.provider,
      },
      serviceConfig: {
        ...decision.serviceConfig,
        model: fallbackConfig.model,
        maxTokens: rule.maxTokens,
      },
    }
    const model = resolveModel(fallbackConfig.model)
    const result = streamText({
      model,
      ...streamOptions,
    } as Parameters<typeof streamText>[0])
    return { result, decision: fallbackDecision }
  }
}
