import { generateObject } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'
import type { AnalyzeParams, RiskMatrix } from './types'

const riskFactorSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  score: z.number().min(0).max(10),
  level: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.string(),
  mitigation: z.string(),
})

const riskMatrixSchema = z.object({
  factors: z.array(riskFactorSchema).min(3).max(8),
  overallScore: z.number().min(0).max(10),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  summary: z.string(),
  recommendations: z.array(z.string()).min(2).max(6),
})

export async function analyzeRisks(params: AnalyzeParams): Promise<{ matrix: RiskMatrix; tokensUsed: number }> {
  const prompt = `Eres un abogado estratega argentino experto en análisis de riesgo legal. Analiza este caso y devuelve una matriz de riesgos detallada.

CASO:
- Número: ${params.caseNumber}
- Título: ${params.caseTitle}
- Tipo: ${params.caseType}
- Descripción: ${params.description}
${params.filingDate ? `- Fecha de inicio: ${params.filingDate}` : ''}
${params.jurisdiction ? `- Jurisdicción: ${params.jurisdiction}` : ''}
${params.courtName ? `- Tribunal: ${params.courtName}` : ''}
${params.estimatedValue ? `- Valor estimado: $${params.estimatedValue}` : ''}

Identifica entre 5 y 8 factores de riesgo específicos del caso. Para cada factor:
- Asigna un score de 0 a 10 (0 = sin riesgo, 10 = riesgo crítico)
- Clasifica el nivel: low (0-3), medium (4-6), high (7-8), critical (9-10)
- Categorías posibles: probatorio, procesal, económico, temporal, normativo, estratégico, reputacional
- Proporciona una estrategia de mitigación concreta y accionable

El overallScore es el promedio ponderado de todos los factores.
El riskLevel del caso general se basa en el overallScore:
- low: 0-3, medium: 4-6, high: 7-8, critical: 9-10

Usa terminología jurídica argentina. Las recomendaciones deben ser accionables y específicas.`

  const { object, usage } = await generateObject({
    model: resolveModel('anthropic/claude-sonnet-4-20250514'),
    schema: riskMatrixSchema,
    prompt,
    temperature: 0.3,
  })

  return {
    matrix: object as RiskMatrix,
    tokensUsed: (usage?.totalTokens ?? 0),
  }
}
