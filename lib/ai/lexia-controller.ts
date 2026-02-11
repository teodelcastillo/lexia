/**
 * Lexia Controller - Central Orchestration Layer
 * 
 * The controller is the brain of the Lexia architecture. It:
 * 1. Classifies the user's intent from their message
 * 2. Decides which AI provider/model to use
 * 3. Enriches case context if needed
 * 4. Builds the appropriate service configuration
 * 5. Delegates execution to the API route (streamText)
 * 
 * The controller does NOT call AI models directly. It returns
 * a ControllerDecision that the route handler uses to configure
 * the streamText call. This keeps streaming in the HTTP layer.
 * 
 * Architecture:
 *   UI (useChat) -> API Route -> Controller -> Decision -> streamText
 *                                    |
 *                                    v
 *                              Context Enrichment (Supabase)
 */

import type {
  CaseContextInput,
  CaseContextData,
  ControllerDecision,
  LexiaIntent,
  AIServiceConfig,
  LexiaAuditEntry,
} from './types'
import { resolveIntentRouting, getRoutingRule, MODEL_REGISTRY } from './providers'
import { buildSystemPrompt } from './prompts'

// ============================================
// Intent Classification (rule-based, no AI)
// ============================================

/**
 * Keyword patterns for each intent category.
 * This is a deterministic classifier - no AI call needed.
 * 
 * Future improvement: Replace with a lightweight classifier model
 * or use embeddings for more nuanced intent detection.
 */
const INTENT_PATTERNS: Record<LexiaIntent, RegExp[]> = {
  document_drafting: [
    /\b(redact|escrib|borrador|draft|generar?\s+(un|el|la)?\s*(escrito|demanda|contestaci|contrato|poder|carta|recurso|apelaci|ofrecimiento))/i,
    /\b(plantilla|modelo\s+de|template|carta\s+documento)\b/i,
    /\b(redacci[oó]n|mejorar?\s+texto|reescrib)/i,
  ],
  document_summary: [
    /\b(resum|sintetiz|analiz[ae]\s+(este|el|la|un)\s*(documento|texto|escrito|contrato|sentencia))/i,
    /\b(resumen|s[ií]ntesis|puntos?\s+clave|extracto)\b/i,
    /\b(qu[eé]\s+dice|de\s+qu[eé]\s+trata|identific[ae]\s+(las\s+)?partes)\b/i,
  ],
  legal_analysis: [
    /\b(anali[zs]|evalua|dictam[ei]n|jurisprudencia|doctrina|fundament)/i,
    /\b(estrategia\s+legal|viabilidad|posibilidad|chances|probabilidad)/i,
    /\b(argumento|defensa|impugn|nulidadd?|prescripci[oó]n|caducidad)\b/i,
    /\b(qu[eé]\s+opinas?\s+sobre|c[oó]mo\s+analiz|qu[eé]\s+dice\s+la\s+ley)\b/i,
  ],
  procedural_query: [
    /\b(checklist|lista\s+de\s+(pasos|verificaci)|paso\s+a\s+paso)\b/i,
    /\b(plazo|vencimiento|t[eé]rmino|d[ií]as?\s+h[aá]biles|calcul[ae]\s+(el\s+)?plazo)\b/i,
    /\b(procedimiento|etapa\s+procesal|tr[aá]mite|requisitos?\s+formales)\b/i,
    /\b(cu[aá]nto\s+tiempo|cu[aá]ndo\s+vence|fecha\s+l[ií]mite)\b/i,
  ],
  case_query: [
    /\b(este\s+caso|el\s+caso|mi\s+caso|estado\s+del\s+caso)\b/i,
    /\b(tareas?\s+pendientes?|documentos?\s+del\s+caso|notas?\s+del\s+caso)\b/i,
    /\b(qu[eé]\s+tengo\s+pendiente|pr[oó]ximos?\s+vencimientos?)\b/i,
    /\b(informaci[oó]n\s+del\s+caso|datos?\s+del\s+expediente)\b/i,
  ],
  general_chat: [
    /\b(hola|buenas?|gracias|adi[oó]s|chau)\b/i,
    /\b(qu[eé]\s+puedes?\s+hacer|ayuda|c[oó]mo\s+funciona)\b/i,
  ],
  unknown: [],
}

/**
 * Classifies the user's intent based on keyword patterns.
 * Returns the intent with the highest confidence.
 */
function classifyIntent(message: string, hasCaseContext: boolean): { intent: LexiaIntent; confidence: number } {
  const scores: Partial<Record<LexiaIntent, number>> = {}

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    let matchCount = 0
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        matchCount++
      }
    }
    if (matchCount > 0) {
      // Normalize by number of patterns for this intent
      scores[intent as LexiaIntent] = matchCount / patterns.length
    }
  }

  // If case context is active and message references "the case", boost case_query
  if (hasCaseContext && /\b(caso|expediente|este|el)\b/i.test(message)) {
    scores.case_query = (scores.case_query || 0) + 0.3
  }

  // Find the highest scoring intent
  let bestIntent: LexiaIntent = 'general_chat'
  let bestScore = 0

  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      bestIntent = intent as LexiaIntent
    }
  }

  // If no strong match, default to general_chat
  if (bestScore < 0.1) {
    return { intent: 'general_chat', confidence: 0.5 }
  }

  return { intent: bestIntent, confidence: Math.min(bestScore, 1.0) }
}

// ============================================
// Context Enrichment
// ============================================

/**
 * Fetches and enriches case context from the database.
 * Converts the lightweight CaseContextInput into a full CaseContextData.
 */
export async function enrichCaseContext(
  supabase: { from: (table: string) => unknown },
  caseInput: CaseContextInput
): Promise<CaseContextData | null> {
  try {
    // biome-ignore lint: Supabase client typing is dynamic
    const { data: caseData } = await (supabase as any)
      .from('cases')
      .select(`
        *,
        companies(company_name),
        deadlines(title, due_date, status),
        tasks(title, status, priority),
        case_notes(content, created_at)
      `)
      .eq('id', caseInput.caseId)
      .single()

    if (!caseData) return null

    const deadlines = (caseData.deadlines as Array<{ title: string; due_date: string; status: string }>) || []
    const tasks = (caseData.tasks as Array<{ title: string; status: string; priority: string }>) || []
    const notes = (caseData.case_notes as Array<{ content: string; created_at: string }>) || []

    return {
      ...caseInput,
      status: caseData.status || 'unknown',
      description: caseData.description || null,
      companyName: (caseData.companies as { company_name?: string } | null)?.company_name || null,
      deadlines: deadlines.slice(0, 5).map(d => ({
        title: d.title,
        dueDate: d.due_date,
        status: d.status,
      })),
      tasks: tasks.filter(t => t.status !== 'completed').slice(0, 5).map(t => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
      })),
      recentNotes: notes.slice(0, 3).map(n => ({
        content: n.content,
        createdAt: n.created_at,
      })),
    }
  } catch (error) {
    console.error('[Lexia Controller] Error enriching case context:', error)
    return null
  }
}

// ============================================
// Main Controller Function
// ============================================

/**
 * Processes a user request and returns a decision about how to handle it.
 * This is the main entry point for the controller.
 * 
 * @param userMessage - The user's latest message text
 * @param caseInput - Optional case context from the UI
 * @param userId - Authenticated user ID
 * @returns ControllerDecision with all config needed for streamText
 */
export function processRequest(
  userMessage: string,
  caseInput: CaseContextInput | null,
  userId: string,
): ControllerDecision {
  // 1. Classify intent
  const { intent, confidence } = classifyIntent(userMessage, !!caseInput)

  // 2. Resolve routing (provider, model, tools)
  const classification = resolveIntentRouting(intent, confidence, !!caseInput)

  // 3. Get routing rule for temperature/token config
  const rule = getRoutingRule(intent)
  const modelConfig = MODEL_REGISTRY[rule.primaryModel]

  // 4. Build service configuration
  const serviceConfig: AIServiceConfig = {
    provider: classification.provider,
    model: classification.model,
    temperature: rule.temperature,
    maxTokens: rule.maxTokens,
    systemPrompt: '', // Will be set after context enrichment
  }

  // 5. Generate trace ID for audit
  const traceId = `lexia-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

  return {
    classification,
    serviceConfig,
    enrichContext: classification.requiresContext && !!caseInput,
    traceId,
  }
}

/**
 * Finalizes the controller decision by building the system prompt
 * with the enriched case context. Called after context enrichment.
 */
export function finalizeDecision(
  decision: ControllerDecision,
  caseContext: CaseContextData | null,
): ControllerDecision {
  const systemPrompt = buildSystemPrompt(
    decision.classification.intent,
    caseContext,
  )

  return {
    ...decision,
    serviceConfig: {
      ...decision.serviceConfig,
      systemPrompt,
    },
  }
}

/**
 * Creates an audit log entry from a completed request.
 * Can be stored in the database for traceability.
 */
export function createAuditEntry(
  decision: ControllerDecision,
  userId: string,
  messageCount: number,
  tokensUsed: number,
  durationMs: number,
  toolsInvoked: string[],
): LexiaAuditEntry {
  return {
    traceId: decision.traceId,
    userId,
    timestamp: new Date().toISOString(),
    intent: decision.classification.intent,
    provider: decision.classification.provider,
    model: decision.classification.model,
    caseId: null,
    messageCount,
    tokensUsed,
    durationMs,
    toolsInvoked,
  }
}
