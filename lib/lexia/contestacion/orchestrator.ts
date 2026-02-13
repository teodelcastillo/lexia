/**
 * Contestación de Demanda - Orchestrator (Etapa 1)
 *
 * Deterministic orchestrator that decides the next action based on state.
 * Interface allows swapping to LLM-based agent in Etapa 2.
 */

import type {
  ContestacionSessionState,
  OrchestratorAction,
} from './types'
import { parseDemandStructure } from './parse-demand'

/**
 * Decides the next action based on current state and demand input.
 * Etapa 1: deterministic rules.
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
 * For parse: calls parseDemandStructure and merges result into state.
 */
export async function executeAction(
  action: OrchestratorAction,
  currentState: ContestacionSessionState | null,
  demandaRaw: string | null
): Promise<ContestacionSessionState> {
  switch (action.type) {
    case 'parse': {
      if (!demandaRaw?.trim()) {
        return currentState ?? { bloques: [] }
      }
      const result = await parseDemandStructure(demandaRaw)
      return {
        ...(currentState ?? {}),
        bloques: result.bloques,
        tipo_demanda_detectado: result.tipo_demanda_detectado,
        pretensiones_principales: result.pretensiones_principales,
        ultima_accion: 'parse',
        ultima_accion_at: new Date().toISOString(),
      }
    }
    case 'wait_user':
    case 'complete':
    case 'error':
      return currentState ?? { bloques: [] }
    default:
      return currentState ?? { bloques: [] }
  }
}
