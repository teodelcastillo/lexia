/**
 * Lexia AI - Provider model resolver
 *
 * Resolves a model string (e.g. 'openai/gpt-4-turbo') to the LanguageModel
 * instance required by the AI SDK streamText(). No Vercel AI Gateway;
 * uses OpenAI and Anthropic providers directly with env API keys
 * (OPENAI_API_KEY, ANTHROPIC_API_KEY).
 */

import { openai as openaiProvider } from '@ai-sdk/openai'
import { anthropic as anthropicProvider } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'

/**
 * Resolves a model identifier to an AI SDK LanguageModel.
 * Model strings are in the form 'openai/gpt-4-turbo' or 'anthropic/claude-sonnet-4-20250514'.
 */
export function resolveModel(modelString: string): LanguageModel {
  if (modelString.startsWith('openai/')) {
    const modelId = modelString.slice('openai/'.length)
    return openaiProvider(modelId)
  }
  if (modelString.startsWith('anthropic/')) {
    const modelId = modelString.slice('anthropic/'.length)
    return anthropicProvider(modelId)
  }
  throw new Error(`Unsupported model string: ${modelString}. Use "openai/..." or "anthropic/...".`)
}
