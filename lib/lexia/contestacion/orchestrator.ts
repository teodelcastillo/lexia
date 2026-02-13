/**
 * Contestación de Demanda - Orchestrator (Etapa 1 + Etapa 2)
 *
 * Etapa 1: Deterministic rules for parse.
 * Etapa 2: Agent (LLM) decides via getAgentDecision in agent.ts.
 * executeAction runs the chosen action (parse, analyze, generate_questions, consolidate).
 */

import type {
  ContestacionSessionState,
  OrchestratorAction,
  BlockAnalysis,
} from './types'
import { parseDemandStructure } from './parse-demand'
import { analyzeDemandBlocks } from './analyze-blocks'
import { generateQuestionsForBlocks } from './generate-questions'
import { consolidateUserResponses } from './consolidate-responses'

/**
 * Decides the next action based on current state and demand input.
 * Etapa 1: deterministic rules (parse phase).
 */
export function getNextAction(
  state: ContestacionSessionState | null,
  demandaRaw: string | null
): OrchestratorAction {
  const hasDemanda = !!demandaRaw?.trim()

  if (state === null) {
    if (!hasDemanda) {
      return { type: 'wait_user', payload: { reason: 'Se requiere el texto de la demanda' } }
    }
    return { type: 'parse' }
  }

  if (!state.bloques || state.bloques.length === 0) {
    if (hasDemanda) {
      return { type: 'parse' }
    }
    return { type: 'wait_user', payload: { reason: 'Se requiere el texto de la demanda para parsear' } }
  }

  return { type: 'complete' }
}

/**
 * Executes the given action and returns the updated state.
 */
export async function executeAction(
  action: OrchestratorAction,
  currentState: ContestacionSessionState | null,
  demandaRaw: string | null
): Promise<ContestacionSessionState> {
  const state = currentState ?? { bloques: [] }
  const bloques = state.bloques ?? []

  switch (action.type) {
    case 'parse': {
      if (!demandaRaw?.trim()) {
        return state
      }
      const result = await parseDemandStructure(demandaRaw)
      return {
        ...state,
        bloques: result.bloques,
        tipo_demanda_detectado: result.tipo_demanda_detectado,
        pretensiones_principales: result.pretensiones_principales,
        ultima_accion: 'parse',
        ultima_accion_at: new Date().toISOString(),
      }
    }
    case 'analyze': {
      if (!bloques.length || !demandaRaw?.trim()) return state
      const analisisList = await analyzeDemandBlocks(bloques, demandaRaw)
      const analisisPorBloque: Record<string, BlockAnalysis> = {}
      for (const a of analisisList) {
        analisisPorBloque[a.bloque_id] = a
      }
      return {
        ...state,
        analisis_por_bloque: analisisPorBloque,
        ultima_accion: 'analyze',
        ultima_accion_at: new Date().toISOString(),
      }
    }
    case 'generate_questions': {
      const analisis = state.analisis_por_bloque ?? {}
      const bloqueIds = action.payload?.bloque_ids
      const preguntas = await generateQuestionsForBlocks(bloques, analisis, bloqueIds)
      return {
        ...state,
        preguntas_generadas: preguntas,
        ultima_accion: 'generate_questions',
        ultima_accion_at: new Date().toISOString(),
      }
    }
    case 'ready_for_redaction': {
      const respuestas = state.respuestas_usuario ?? {}
      const formDataConsolidado = await consolidateUserResponses(respuestas, bloques)
      return {
        ...state,
        form_data_consolidado: formDataConsolidado,
        listo_para_redaccion: true,
        ultima_accion: 'ready_for_redaction',
        ultima_accion_at: new Date().toISOString(),
      }
    }
    case 'wait_user':
    case 'need_more_info':
    case 'complete':
    case 'error':
      return state
    default:
      return state
  }
}
