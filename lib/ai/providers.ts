/**
 * Lexia AI - Provider Registry & Model Configuration
 * 
 * Centralizes all provider/model configuration. The controller uses
 * this registry to decide which model to use for each intent.
 * 
 * Adding a new provider:
 * 1. Add it to AIProvider type in types.ts
 * 2. Add model configs here
 * 3. Update intent routing rules
 * 4. Create a service file if it needs custom logic
 */

import type { AIProvider, LexiaIntent, IntentClassification } from './types'

// ============================================
// Model Configuration
// ============================================

interface ModelConfig {
  provider: AIProvider
  model: string
  displayName: string
  maxTokens: number
  defaultTemperature: number
  costPer1kInput: number   // USD per 1k input tokens (for tracking)
  costPer1kOutput: number  // USD per 1k output tokens
  strengths: string[]
}

/**
 * Available model configurations.
 * Each model is mapped to a unique key for referencing.
 */
export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // OpenAI models via Gateway
  'gpt4-turbo': {
    provider: 'gateway',
    model: 'openai/gpt-4-turbo',
    displayName: 'GPT-4 Turbo',
    maxTokens: 4096,
    defaultTemperature: 0.7,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.03,
    strengths: ['legal_analysis', 'procedural_query', 'general_chat'],
  },
  'gpt4o': {
    provider: 'gateway',
    model: 'openai/gpt-4o',
    displayName: 'GPT-4o',
    maxTokens: 4096,
    defaultTemperature: 0.5,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    strengths: ['document_summary', 'case_query', 'general_chat'],
  },
  'gpt4o-mini': {
    provider: 'gateway',
    model: 'openai/gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    maxTokens: 2048,
    defaultTemperature: 0.5,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    strengths: ['case_query', 'general_chat'],
  },
  // Anthropic models via Gateway
  'claude-sonnet': {
    provider: 'gateway',
    model: 'anthropic/claude-sonnet-4-20250514',
    displayName: 'Claude Sonnet 4',
    maxTokens: 4096,
    defaultTemperature: 0.7,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    strengths: ['document_drafting', 'document_summary', 'legal_analysis'],
  },
  'claude-haiku': {
    provider: 'gateway',
    model: 'anthropic/claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    maxTokens: 2048,
    defaultTemperature: 0.5,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    strengths: ['document_summary', 'general_chat'],
  },
} as const

// ============================================
// Intent-to-Model Routing Rules
// ============================================

/**
 * Default routing rules mapping intents to preferred models.
 * The controller uses these to build the IntentClassification.
 * 
 * Priority order: first match wins.
 * Can be overridden per-user or per-organization in the future.
 */
interface RoutingRule {
  intent: LexiaIntent
  primaryModel: string      // Key into MODEL_REGISTRY
  fallbackModel: string     // Fallback if primary fails
  temperature: number
  maxTokens: number
  toolsAllowed: string[]
}

export const ROUTING_RULES: RoutingRule[] = [
  {
    intent: 'legal_analysis',
    primaryModel: 'gpt4-turbo',
    fallbackModel: 'claude-sonnet',
    temperature: 0.4,
    maxTokens: 3000,
    toolsAllowed: ['getProceduralChecklist', 'queryCaseInfo', 'calculateDeadline'],
  },
  {
    intent: 'document_drafting',
    primaryModel: 'claude-sonnet',
    fallbackModel: 'gpt4-turbo',
    temperature: 0.6,
    maxTokens: 4096,
    toolsAllowed: ['generateDraft', 'queryCaseInfo'],
  },
  {
    intent: 'document_summary',
    primaryModel: 'gpt4o',
    fallbackModel: 'claude-haiku',
    temperature: 0.3,
    maxTokens: 2048,
    toolsAllowed: ['summarizeDocument'],
  },
  {
    intent: 'procedural_query',
    primaryModel: 'gpt4-turbo',
    fallbackModel: 'gpt4o',
    temperature: 0.3,
    maxTokens: 2048,
    toolsAllowed: ['getProceduralChecklist', 'calculateDeadline'],
  },
  {
    intent: 'case_query',
    primaryModel: 'gpt4o-mini',
    fallbackModel: 'gpt4o',
    temperature: 0.2,
    maxTokens: 1024,
    toolsAllowed: ['queryCaseInfo', 'calculateDeadline'],
  },
  {
    intent: 'general_chat',
    primaryModel: 'gpt4o-mini',
    fallbackModel: 'gpt4o',
    temperature: 0.7,
    maxTokens: 1024,
    toolsAllowed: [],
  },
  {
    intent: 'unknown',
    primaryModel: 'gpt4o',
    fallbackModel: 'gpt4o-mini',
    temperature: 0.5,
    maxTokens: 1024,
    toolsAllowed: ['queryCaseInfo'],
  },
]

// ============================================
// Routing Functions
// ============================================

/**
 * Resolves the routing configuration for a given intent.
 * Returns the full IntentClassification with provider and model details.
 */
export function resolveIntentRouting(
  intent: LexiaIntent,
  confidence: number,
  hasCaseContext: boolean
): IntentClassification {
  const rule = ROUTING_RULES.find(r => r.intent === intent)
    || ROUTING_RULES.find(r => r.intent === 'unknown')!

  const modelConfig = MODEL_REGISTRY[rule.primaryModel]
  if (!modelConfig) {
    throw new Error(`Model "${rule.primaryModel}" not found in MODEL_REGISTRY`)
  }

  return {
    intent,
    confidence,
    provider: modelConfig.provider,
    model: modelConfig.model,
    requiresContext: hasCaseContext || ['legal_analysis', 'case_query'].includes(intent),
    toolsAllowed: rule.toolsAllowed,
  }
}

/**
 * Gets the routing rule for a specific intent.
 */
export function getRoutingRule(intent: LexiaIntent): RoutingRule {
  return ROUTING_RULES.find(r => r.intent === intent)
    || ROUTING_RULES.find(r => r.intent === 'unknown')!
}

/**
 * Gets a model configuration by its registry key.
 */
export function getModelConfig(key: string): ModelConfig | undefined {
  return MODEL_REGISTRY[key]
}
