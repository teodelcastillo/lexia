/**
 * Lexia AI Module - Public API
 * 
 * This barrel file exports the public interface of the AI module.
 * Import from '@/lib/ai' rather than individual files.
 * 
 * Architecture:
 * 
 *   lib/ai/
 *   ├── index.ts            <- You are here (public API)
 *   ├── types.ts            <- Core type contracts
 *   ├── providers.ts        <- Provider registry & model config
 *   ├── prompts.ts          <- System prompt management
 *   ├── tools.ts            <- Tool definitions & registry
 *   └── lexia-controller.ts <- Orchestration logic
 */

// Types (consumers need these for type safety)
export type {
  LexiaIntent,
  IntentClassification,
  AIProvider,
  AIServiceConfig,
  AIServiceRequest,
  AIServiceResponse,
  CaseContextInput,
  CaseContextData,
  ToolCategory,
  ToolRegistryEntry,
  ControllerDecision,
  LexiaAuditEntry,
} from './types'

// Controller (main entry point for API routes)
export {
  processRequest,
  enrichCaseContext,
  finalizeDecision,
  createAuditEntry,
} from './lexia-controller'

// Tools (used by API routes for streamText)
export {
  lexiaTools,
  getToolsForIntent,
  TOOL_REGISTRY,
} from './tools'

// Providers (for admin/config UIs)
export {
  MODEL_REGISTRY,
  ROUTING_RULES,
  resolveIntentRouting,
  getRoutingRule,
  getModelConfig,
} from './providers'

// Prompts (for testing/debugging)
export { buildSystemPrompt } from './prompts'

// Resolver (model string -> LanguageModel)
export { resolveModel } from './resolver'

// Orchestrator (stream with fallback; used by API route)
export { runStreamWithFallback } from './orchestrator'

// Credits and usage (for quota enforcement and recording)
export { getCreditsForIntent, getPlanCreditsLimit, CREDITS_BY_INTENT, PLAN_CREDITS } from './credits'
export {
  checkCreditsRemaining,
  recordLexiaUsage,
  getUserLexiaPlan,
  getCurrentPeriodUsage,
  type UserLexiaPlan,
  type PeriodUsage,
  type CreditsRemaining,
} from './usage'
