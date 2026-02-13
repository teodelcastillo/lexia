/**
 * Contestación de Demanda - Generate Questions for Blocks
 *
 * Generates questions/proposals for the defendant's lawyer per block:
 * posture (admit/deny/partial), fundamentación, proof to offer.
 */

import { generateObject } from 'ai'
import { zodSchema } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'
import type { DemandBlock, BlockAnalysis, BlockQuestion } from './types'

const QUESTIONS_MODEL = 'anthropic/claude-sonnet-4-20250514'

const BlockQuestionItemSchema = z.object({
  bloque_id: z.string(),
  pregunta: z.string(),
  tipo: z.enum(['postura', 'prueba', 'fundamentacion', 'otro']),
  opciones_sugeridas: z.array(z.string()).optional(),
})

const GenerateQuestionsSchema = z.object({
  preguntas: z.array(BlockQuestionItemSchema),
})

const QUESTIONS_SYSTEM_PROMPT = `Eres un abogado experto que asesora al demandado en una contestación de demanda (Córdoba, Argentina).

Tu tarea es generar preguntas o propuestas concretas para que el abogado del demandado complete su estrategia. Para cada bloque (o los indicados), genera preguntas sobre:

1. **postura**: ¿Admitir, negar, admitir parcialmente o negar con matices? Incluye opciones sugeridas cuando sea útil.
2. **fundamentacion**: Qué argumentos o fundamentos legales plantear.
3. **prueba**: Qué prueba ofrecer para sostener la postura (documentos, testigos, informes, etc.).

Sé específico y práctico. Usa el bloque_id exacto proporcionado. Genera 1-3 preguntas por bloque según su relevancia.`

/**
 * Generates questions for the defendant's lawyer per block.
 * If bloque_ids is provided, only generates for those blocks.
 */
export async function generateQuestionsForBlocks(
  bloques: DemandBlock[],
  analisis: Record<string, BlockAnalysis>,
  bloqueIds?: string[]
): Promise<BlockQuestion[]> {
  const targetBloques = bloqueIds?.length
    ? bloques.filter((b) => bloqueIds.includes(b.id))
    : bloques

  if (!targetBloques.length) return []

  const bloquesContext = targetBloques
    .map((b) => {
      const a = analisis[b.id]
      return `--- Bloque ${b.id} (${b.titulo}) ---
Contenido: ${b.contenido.slice(0, 2000)}
${a ? `Análisis: argumentos=${a.argumentos_clave?.length ?? 0}, puntos débiles=${a.puntos_debiles?.length ?? 0}, sugerencias=${a.sugerencias_defensa?.length ?? 0}` : ''}`
    })
    .join('\n\n')

  try {
    const { object } = await generateObject({
      model: resolveModel(QUESTIONS_MODEL),
      schema: zodSchema(GenerateQuestionsSchema),
      prompt: `Genera preguntas/propuestas para el abogado demandado sobre los siguientes bloques de la demanda.

BLOQUES:
${bloquesContext}`,
      system: QUESTIONS_SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0.4,
    })

    return (object.preguntas ?? []) as BlockQuestion[]
  } catch (err) {
    console.error('[Contestacion] generateQuestionsForBlocks error:', err)
    return []
  }
}
