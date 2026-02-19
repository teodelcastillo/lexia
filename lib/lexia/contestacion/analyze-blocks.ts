/**
 * Contestación de Demanda - Analyze Demand Blocks
 *
 * Deep analysis of each block: key arguments, weak points, implicit proof,
 * defense suggestions for the defendant.
 */

import { generateObject } from 'ai'
import { zodSchema } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'
import type { DemandBlock, BlockAnalysis } from './types'

const ANALYZE_MODEL = 'anthropic/claude-sonnet-4-20250514'

const BlockAnalysisItemSchema = z.object({
  bloque_id: z.string(),
  argumentos_clave: z.array(z.string()),
  puntos_debiles: z.array(z.string()),
  prueba_implicita: z.array(z.string()),
  sugerencias_defensa: z.array(z.string()),
})

const AnalyzeBlocksSchema = z.object({
  analisis: z.array(BlockAnalysisItemSchema),
})

const ANALYZE_SYSTEM_PROMPT = `Eres un abogado experto en derecho procesal argentino (Córdoba, Argentina) que asesora al demandado.

Tu tarea es analizar cada bloque de una demanda judicial desde la perspectiva del demandado. Para cada bloque extrae:

1. **argumentos_clave**: Los argumentos principales que el actor (demandante) sostiene en ese bloque.
2. **puntos_debiles**: Aspectos discutibles, imprecisos o vulnerables que el demandado podría cuestionar.
3. **prueba_implicita**: Qué prueba invoca o sugiere implícitamente el actor (documentos, testigos, etc.).
4. **sugerencias_defensa**: Líneas defensivas o contraargumentos que el demandado podría plantear.

Sé conciso pero preciso. Usa el bloque_id exacto que se te proporciona para cada bloque.`

/**
 * Analyzes each block of the demand from the defendant's perspective.
 */
export async function analyzeDemandBlocks(
  bloques: DemandBlock[],
  demandaRaw: string
): Promise<BlockAnalysis[]> {
  if (!bloques?.length) return []

  const bloquesContext = bloques
    .map(
      (b) =>
        `--- Bloque ${b.id} (${b.titulo}) ---\n${b.contenido.slice(0, 3000)}`
    )
    .join('\n\n')

  try {
    const { object: raw } = await generateObject({
      model: resolveModel(ANALYZE_MODEL),
      schema: zodSchema(AnalyzeBlocksSchema),
      prompt: `Analiza los siguientes bloques de la demanda. La demanda completa (resumida) está debajo para contexto.

BLOQUES A ANALIZAR:
${bloquesContext}

---
CONTEXTO DEMANDA (inicio):
${demandaRaw.slice(0, 5000)}
---`,
      system: ANALYZE_SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0.3,
    } as Parameters<typeof generateObject>[0] & { maxTokens?: number })
    const object = raw as z.infer<typeof AnalyzeBlocksSchema>

    return (object.analisis ?? []) as BlockAnalysis[]
  } catch (err) {
    console.error('[Contestacion] analyzeDemandBlocks error:', err)
    return []
  }
}
