/**
 * Contestación de Demanda - Agent (Etapa 2)
 *
 * LLM-based agent that decides the next orchestration step based on state.
 * Can skip steps if user already provided everything, or iterate if more info needed.
 */

import { generateObject } from 'ai'
import { zodSchema } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'
import type { ContestacionSessionState, OrchestratorAction } from './types'

const AGENT_MODEL = 'openai/gpt-4o-mini'

const AgentDecisionSchema = z.object({
  action: z.enum([
    'analyze',
    'generate_questions',
    'wait_user',
    'need_more_info',
    'ready_for_redaction',
  ]),
  reason: z.string(),
  bloque_ids: z.array(z.string()),
  preguntas_prioritarias: z.array(z.string()),
})

const AGENT_SYSTEM_PROMPT = `Eres un orquestador del flujo de contestación de demanda (Córdoba, Argentina).

Dado el estado actual de la sesión, decides la próxima acción. Acciones posibles:

1. **analyze**: Si hay bloques parseados pero NO hay análisis por bloque. Ejecutar análisis profundo.
2. **generate_questions**: Si hay análisis pero NO hay preguntas generadas, o si el agente pidió más preguntas para bloques específicos. Genera preguntas para el abogado.
3. **wait_user**: Si hay preguntas pero el usuario aún no respondió. Esperar a que complete las respuestas.
4. **need_more_info**: Si el usuario respondió pero falta información en bloques específicos (bloque_ids). Indicar qué bloques necesitan más detalle.
5. **ready_for_redaction**: Si hay respuestas suficientes en todos los bloques relevantes. Pasar a consolidar y redacción.

Reglas:
- Si no hay analisis_por_bloque y hay bloques → analyze (reason: "", bloque_ids: [], preguntas_prioritarias: [])
- Si hay analisis pero no preguntas_generadas → generate_questions (reason: "", bloque_ids: [] si no aplica, preguntas_prioritarias: [])
- Si hay preguntas pero no respuestas_usuario o respuestas incompletas → wait_user (reason: breve explicación, bloque_ids: [], preguntas_prioritarias: [])
- Si hay respuestas pero faltan bloques críticos (hechos, rubros) sin respuesta → need_more_info con bloque_ids de esos bloques y reason explicando qué falta
- Si todas las respuestas están completas y son suficientes → ready_for_redaction (reason: "", bloque_ids: [], preguntas_prioritarias: [])

Siempre incluye reason, bloque_ids y preguntas_prioritarias. Usa "" o [] cuando no aplique.`

/**
 * Gets the agent's decision for the next step based on current state and optional user input.
 */
export async function getAgentDecision(
  state: ContestacionSessionState,
  userInput?: string | null
): Promise<OrchestratorAction> {
  const bloques = state.bloques ?? []
  const analisis = state.analisis_por_bloque ?? {}
  const preguntas = state.preguntas_generadas ?? []
  const respuestas = state.respuestas_usuario ?? {}

  const stateSummary = JSON.stringify(
    {
      bloques_count: bloques.length,
      bloques_ids: bloques.map((b) => b.id),
      bloques_tipos: bloques.map((b) => ({ id: b.id, tipo: b.tipo })),
      analisis_count: Object.keys(analisis).length,
      preguntas_count: preguntas.length,
      respuestas_count: Object.keys(respuestas).length,
      respuestas_por_bloque: Object.fromEntries(
        Object.entries(respuestas).map(([k, v]) => [
          k,
          { postura: v.postura, has_fundamentacion: !!v.fundamentacion },
        ])
      ),
    },
    null,
    2
  )

  try {
    const { object } = await generateObject({
      model: resolveModel(AGENT_MODEL),
      schema: zodSchema(AgentDecisionSchema),
      prompt: `Estado actual:
${stateSummary}
${userInput ? `\nÚltimo input del usuario: "${userInput}"` : ''}

Decide la próxima acción.`,
      system: AGENT_SYSTEM_PROMPT,
      maxTokens: 512,
      temperature: 0.2,
    })

    switch (object.action) {
      case 'analyze':
        return { type: 'analyze' }
      case 'generate_questions':
        return {
          type: 'generate_questions',
          payload:
            object.bloque_ids?.length > 0
              ? { bloque_ids: object.bloque_ids }
              : undefined,
        }
      case 'wait_user':
        return {
          type: 'wait_user',
          payload: {
            reason:
              object.reason?.trim() ||
              'Completá las respuestas por bloque para continuar.',
          },
        }
      case 'need_more_info':
        return {
          type: 'need_more_info',
          payload: {
            bloque_ids: object.bloque_ids ?? [],
            reason:
              object.reason?.trim() || 'Falta información en algunos bloques.',
          },
        }
      case 'ready_for_redaction':
        return { type: 'ready_for_redaction' }
      default:
        return {
          type: 'wait_user',
          payload: { reason: 'Continuá completando las respuestas.' },
        }
    }
  } catch (err) {
    console.error('[Contestacion] getAgentDecision error:', err)
    if (preguntas.length && Object.keys(respuestas).length < bloques.length) {
      return {
        type: 'wait_user',
        payload: { reason: 'Completá las respuestas por bloque.' },
      }
    }
    if (preguntas.length && Object.keys(respuestas).length >= bloques.length) {
      return { type: 'ready_for_redaction' }
    }
    return {
      type: 'wait_user',
      payload: { reason: 'Error al evaluar. Intentá enviar las respuestas nuevamente.' },
    }
  }
}
