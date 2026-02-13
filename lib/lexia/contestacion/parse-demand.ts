/**
 * Contestación de Demanda - Parse Demand Structure
 *
 * Parses raw demand text into structured blocks (titles + content).
 * Uses generateObject with Zod schema for structured output.
 */

import { generateObject } from 'ai'
import { zodSchema } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'
import type { DemandBlock } from './types'

const PARSE_MODEL = 'openai/gpt-4o-mini'

const DemandParseSchema = z.object({
  bloques: z.array(
    z.object({
      id: z.string(),
      titulo: z.string(),
      contenido: z.string(),
      tipo: z
        .enum(['objeto', 'hechos', 'rubros', 'prueba', 'petitorio', 'otro'])
        .optional(),
      orden: z.number(),
    })
  ),
  tipo_demanda_detectado: z.string().optional(),
  pretensiones_principales: z.array(z.string()).optional(),
})

const PARSE_SYSTEM_PROMPT = `Eres un asistente legal que analiza demandas judiciales argentinas (Córdoba, Argentina).

Tu tarea es parsear el texto de una demanda y extraer sus secciones/bloques. Las demandas suelen tener esta estructura:

- I. OBJETO (comparecencia, demandados, pretensiones, mediación)
- II. HECHOS (con subsecciones numeradas I, II, III, IV, V...)
- III. o IV. RUBROS RECLAMADOS (daño emergente, lucro cesante)
- IV. o V. PRUEBA (documental, testimonial, etc.)
- V. o VI. RESERVA DEL CASO FEDERAL
- VI. o VII. PETITORIO

Detecta cada bloque por su título (numeración romana o similar) y extrae el contenido completo de cada uno.
Asigna un tipo cuando sea claro: objeto, hechos, rubros, prueba, petitorio. Si no está claro, usa "otro".
Genera un id único para cada bloque (ej: bloque_1, bloque_2).
Ordena los bloques según su aparición en el documento (orden 1, 2, 3...).
Si detectas el tipo de demanda (ej: incumplimiento contractual locación), indícalo en tipo_demanda_detectado.
Si identificas las pretensiones principales, listalas en pretensiones_principales.`

/**
 * Parses raw demand text into structured blocks.
 * On failure or empty result, returns a single block with full content.
 */
export async function parseDemandStructure(
  demandaRaw: string
): Promise<{
  bloques: DemandBlock[]
  tipo_demanda_detectado?: string
  pretensiones_principales?: string[]
}> {
  const trimmed = demandaRaw?.trim() ?? ''
  if (!trimmed) {
    return {
      bloques: [],
    }
  }

  try {
    const { object } = await generateObject({
      model: resolveModel(PARSE_MODEL),
      schema: zodSchema(DemandParseSchema),
      prompt: `Analiza la siguiente demanda judicial y extrae sus bloques/secciones.

DEMANDA:
---
${trimmed.slice(0, 100_000)}
---`,
      system: PARSE_SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0.2,
    })

    if (!object.bloques || object.bloques.length === 0) {
      return {
        bloques: [
          {
            id: 'bloque_1',
            titulo: 'Contenido completo',
            contenido: trimmed,
            tipo: 'otro',
            orden: 1,
          },
        ],
      }
    }

    return {
      bloques: object.bloques as DemandBlock[],
      tipo_demanda_detectado: object.tipo_demanda_detectado,
      pretensiones_principales: object.pretensiones_principales,
    }
  } catch (err) {
    console.error('[Contestacion] parseDemandStructure error:', err)
    return {
      bloques: [
        {
          id: 'bloque_1',
          titulo: 'Contenido completo',
          contenido: trimmed,
          tipo: 'otro',
          orden: 1,
        },
      ],
    }
  }
}
