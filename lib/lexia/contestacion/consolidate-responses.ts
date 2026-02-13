/**
 * Contestación de Demanda - Consolidate User Responses
 *
 * Consolidates BlockResponse per block into formData structure for contestación:
 * hechos_admitidos, hechos_negados, defensas, excepciones.
 */

import { generateObject } from 'ai'
import { zodSchema } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'
import type { DemandBlock, BlockResponse, FormDataConsolidado } from './types'

const CONSOLIDATE_MODEL = 'openai/gpt-4o-mini'

const ConsolidateSchema = z.object({
  hechos_admitidos: z.string(),
  hechos_negados: z.string(),
  defensas: z.string(),
  excepciones: z.string().optional(),
})

const CONSOLIDATE_SYSTEM_PROMPT = `Eres un abogado que redacta contestaciones de demanda en Argentina (Córdoba).

Tu tarea es consolidar las respuestas del demandado por cada bloque de la demanda en la estructura formal de una contestación:

1. **hechos_admitidos**: Texto redactado con los hechos que el demandado admite (agrupa los bloques con postura "admitir" o "admitir_parcial").
2. **hechos_negados**: Texto redactado con los hechos que el demandado niega (agrupa los bloques con postura "negar" o "negar_con_matices").
3. **defensas**: Fundamentación y defensas de fondo que el demandado plantea. Incluye la fundamentación de cada bloque cuando corresponda.
4. **excepciones**: Si el demandado plantea excepciones procesales (prescripción, caducidad, etc.), inclúyelas aquí. Si no hay, deja vacío.

Redacta en lenguaje jurídico formal, numerado cuando corresponda. Usa la información de fundamentacion y prueba_ofrecida de cada respuesta.`

/**
 * Consolidates user responses into formData for the contestación draft.
 */
export async function consolidateUserResponses(
  respuestas: Record<string, BlockResponse>,
  bloques: DemandBlock[]
): Promise<FormDataConsolidado> {
  const respuestasList = Object.values(respuestas)
  if (!respuestasList.length) {
    return {
      hechos_admitidos: '',
      hechos_negados: '',
      defensas: '',
      excepciones: '',
    }
  }

  const context = respuestasList
    .map((r) => {
      const b = bloques.find((x) => x.id === r.bloque_id)
      return `Bloque ${r.bloque_id} (${b?.titulo ?? '?'}): postura=${r.postura}, fundamentacion=${r.fundamentacion ?? '-'}, prueba=${(r.prueba_ofrecida ?? []).join(', ') || '-'}`
    })
    .join('\n')

  try {
    const { object } = await generateObject({
      model: resolveModel(CONSOLIDATE_MODEL),
      schema: zodSchema(ConsolidateSchema),
      prompt: `Consolida las siguientes respuestas del demandado en la estructura de contestación:

RESPUESTAS POR BLOQUE:
${context}`,
      system: CONSOLIDATE_SYSTEM_PROMPT,
      maxTokens: 2048,
      temperature: 0.3,
    })

    return {
      hechos_admitidos: object.hechos_admitidos ?? '',
      hechos_negados: object.hechos_negados ?? '',
      defensas: object.defensas ?? '',
      excepciones: object.excepciones ?? '',
    }
  } catch (err) {
    console.error('[Contestacion] consolidateUserResponses error:', err)
    return {
      hechos_admitidos: '',
      hechos_negados: '',
      defensas: '',
      excepciones: '',
    }
  }
}
