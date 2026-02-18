import { generateObject } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'
import type { AnalyzeParams, Jurisprudence } from './types'

const jurisprudenceSchema = z.object({
  results: z.array(
    z.object({
      title: z.string(),
      court: z.string(),
      date: z.string(),
      summary: z.string(),
      relevance: z.string(),
      keyArguments: z.array(z.string()).min(1).max(5),
      url: z.string().optional(),
      indemnizationAmount: z.string().optional(),
    })
  ).min(2).max(5),
})

export async function searchJurisprudence(
  params: AnalyzeParams
): Promise<{ results: Jurisprudence[]; tokensUsed: number }> {
  const prompt = `Eres un especialista en jurisprudencia argentina. Para el siguiente caso legal, genera ejemplos realistas y representativos de jurisprudencia relevante que un abogado debería conocer.

CASO:
- Tipo: ${params.caseType}
- Descripción: ${params.description}
${params.jurisdiction ? `- Jurisdicción: ${params.jurisdiction}` : ''}

Proporciona entre 3 y 5 fallos jurisprudenciales relevantes. Deben ser:
1. Representativos de la jurisprudencia argentina actual sobre el tema
2. De distintos tribunales cuando sea posible (CSJN, Cámaras, Juzgados de primera instancia)
3. Con argumentos clave que aplican al caso analizado
4. Con indicación de tendencias jurisprudenciales actuales
5. Si aplica, con montos indemnizatorios de referencia

IMPORTANTE: Genera fallos plausibles y representativos basados en tu conocimiento del derecho argentino. Indica claramente el tribunal, fecha aproximada y los argumentos principales.`

  const { object, usage } = await generateObject({
    model: resolveModel('openai/gpt-4-turbo'),
    schema: jurisprudenceSchema,
    prompt,
    temperature: 0.4,
  })

  return {
    results: object.results as Jurisprudence[],
    tokensUsed: (usage?.totalTokens ?? 0),
  }
}
