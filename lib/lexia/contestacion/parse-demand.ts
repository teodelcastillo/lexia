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

const PARSE_MODEL = 'anthropic/claude-sonnet-4-20250514'

const DemandParseSchema = z.object({
  bloques: z.array(
    z.object({
      id: z.string(),
      titulo: z.string(),
      contenido: z.string(),
      tipo: z.enum(['objeto', 'hechos', 'rubros', 'prueba', 'petitorio', 'otro']),
      orden: z.number(),
    })
  ),
  tipo_demanda_detectado: z.string(),
  pretensiones_principales: z.array(z.string()),
})

const PARSE_SYSTEM_PROMPT = `Eres un asistente legal experto que analiza demandas judiciales argentinas (Córdoba, Argentina).

Tu tarea es parsear el texto de una demanda y extraer sus secciones/bloques con el contenido COMPLETO de cada una. No resumas ni omitas texto.

Estructura típica de demandas:
- I. OBJETO (comparecencia, demandados, pretensiones, mediación)
- II. HECHOS (con subsecciones numeradas I, II, III, IV, V...)
- III. o IV. RUBROS RECLAMADOS (daño emergente, lucro cesante)
- IV. o V. PRUEBA (documental, testimonial, informativa)
- V. o VI. RESERVA DEL CASO FEDERAL (si existe)
- VI. o VII. PETITORIO

Instrucciones:
1. Detecta cada bloque por su título (numeración romana I, II, III... o "ANTE UD.", "POR LO EXPUESTO", etc.).
2. Extrae el contenido COMPLETO de cada bloque, sin resumir. Incluye todos los párrafos, subsecciones y detalles.
3. Asigna tipo: objeto, hechos, rubros, prueba, petitorio. Si no encaja, usa "otro".
4. Genera id único por bloque (bloque_1, bloque_2, ...).
5. Ordena según aparición en el documento (orden 1, 2, 3...).
6. tipo_demanda_detectado: describe el tipo (ej: "incumplimiento contractual locación", "daños y perjuicios").
7. pretensiones_principales: lista las pretensiones concretas (ej: "condena al pago de daños", "desalojo").`

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
      maxTokens: 16384,
      temperature: 0.1,
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
      tipo_demanda_detectado: object.tipo_demanda_detectado?.trim() || undefined,
      pretensiones_principales:
        object.pretensiones_principales?.length > 0
          ? object.pretensiones_principales
          : undefined,
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
