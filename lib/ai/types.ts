/**
 * Lexia AI - Core Type Contracts
 * 
 * Defines the shared interfaces between the Controller, AI Services,
 * and Tool executors. Every AI provider must conform to these contracts.
 */

// ============================================
// Intent Classification
// ============================================

/**
 * High-level intent categories that the controller can classify.
 * Each intent maps to a preferred provider/model combination.
 */
export type LexiaIntent =
  | 'legal_analysis'       // Complex reasoning, jurisprudence, case strategy
  | 'document_drafting'    // Writing, reformulation, long-form generation
  | 'procedural_query'     // Checklists, deadlines, process steps
  | 'document_summary'     // Summarizing legal documents
  | 'general_chat'         // Casual / general questions
  | 'case_query'           // Database queries about a specific case
  | 'unknown'

/**
 * Result of intent classification performed by the controller.
 */
export interface IntentClassification {
  intent: LexiaIntent
  confidence: number         // 0-1 confidence score
  provider: AIProvider       // Which provider to route to
  model: string              // Specific model string
  requiresContext: boolean   // Whether case context is needed
  toolsAllowed: string[]     // Which tools this intent can trigger
}

// ============================================
// AI Provider Abstraction
// ============================================

/**
 * Supported AI providers.
 * 'gateway' uses Vercel AI Gateway (model string routing).
 * 'openai_direct' and 'anthropic_direct' bypass the gateway.
 */
export type AIProvider = 'gateway' | 'openai_direct' | 'anthropic_direct'

/**
 * Configuration for a specific AI service execution.
 */
export interface AIServiceConfig {
  provider: AIProvider
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string
}

/**
 * Standard request contract for all AI services.
 * Every service receives this shape regardless of provider.
 */
export interface AIServiceRequest {
  /** The user's current message text */
  userMessage: string
  /** Full conversation history in model format */
  conversationHistory: Array<{ role: string; content: string }>
  /** Optional case context for grounding */
  caseContext: CaseContextData | null
  /** Service configuration decided by the controller */
  config: AIServiceConfig
  /** Additional metadata */
  metadata: {
    userId: string
    sessionId?: string
    requestId: string
  }
}

/**
 * Standard response contract from all AI services.
 * The controller and UI don't need to know which provider generated this.
 */
export interface AIServiceResponse {
  /** The generated text content */
  content: string
  /** Which provider actually served the request */
  provider: AIProvider
  /** The model used */
  model: string
  /** Token usage for billing/tracking */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** Finish reason */
  finishReason: string
}

// ============================================
// Case Context (shared between layers)
// ============================================

/**
 * Case context passed from the UI to the controller.
 * This is the "light" version sent in the request body.
 */
export interface CaseContextInput {
  caseId: string
  caseNumber: string
  title: string
  type: string
}

/**
 * Enriched case context after the controller fetches additional data.
 * Used by AI services for grounding responses.
 */
export interface CaseContextData extends CaseContextInput {
  status: string
  description: string | null
  companyName: string | null
  deadlines: Array<{
    title: string
    dueDate: string
    status: string
  }>
  tasks: Array<{
    title: string
    status: string
    priority: string
  }>
  recentNotes: Array<{
    content: string
    createdAt: string
  }>
}

// ============================================
// Tool Classification
// ============================================

/**
 * Tool categories for the controller's decision-making.
 * 
 * - 'deterministic': Pure code execution, no AI involved (calculateDeadline, queryCaseInfo)
 * - 'semantic':      Requires AI to generate output (summarizeDocument, generateDraft)
 */
export type ToolCategory = 'deterministic' | 'semantic'

/**
 * Registry entry for each tool.
 * The controller uses this to decide how to execute a tool.
 */
export interface ToolRegistryEntry {
  name: string
  category: ToolCategory
  description: string
  /** For semantic tools: which provider/model should handle it */
  preferredProvider?: AIProvider
  preferredModel?: string
  /** Which intents can trigger this tool */
  allowedIntents: LexiaIntent[]
}

// ============================================
// Controller Types
// ============================================

/**
 * The controller's decision about how to handle a request.
 */
export interface ControllerDecision {
  /** Classified intent */
  classification: IntentClassification
  /** Service config to use */
  serviceConfig: AIServiceConfig
  /** Whether to enrich case context before processing */
  enrichContext: boolean
  /** Trace ID for audit logging */
  traceId: string
}

/**
 * Audit log entry for every Lexia interaction.
 * Enables traceability and compliance.
 */
export interface LexiaAuditEntry {
  traceId: string
  userId: string
  timestamp: string
  intent: LexiaIntent
  provider: AIProvider
  model: string
  caseId: string | null
  messageCount: number
  tokensUsed: number
  durationMs: number
  toolsInvoked: string[]
}
