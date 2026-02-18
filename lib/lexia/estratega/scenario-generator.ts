import { generateObject } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'
import type { AnalyzeParams, RiskMatrix, StrategicScenario } from './types'

const scenarioActionSchema = z.object({
  action: z.string(),
  timeframe: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
})

const scenarioSchema = z.object({
  type: z.enum(['conservative', 'moderate', 'aggressive']),
  name: z.string(),
  successProbability: z.number().min(0).max(100),
  estimatedDurationMonths: z.number().min(1),
  estimatedCostRange: z.object({
    min: z.number().min(0),
    max: z.number().min(0),
  }),
  pros: z.array(z.string()).min(2).max(5),
  cons: z.array(z.string()).min(2).max(5),
  recommendedActions: z.array(scenarioActionSchema).min(2).max(6),
  description: z.string(),
})

const scenariosSchema = z.object({
  scenarios: z.array(scenarioSchema).length(3),
})

export async function generateScenarios(
  params: AnalyzeParams,
  riskMatrix: RiskMatrix
): Promise<{ scenarios: StrategicScenario[]; tokensUsed: number }> {
  const prompt = `Eres un abogado estratega argentino experto en planificación litigation. Genera exactamente 3 escenarios estratégicos para este caso.

CASO:
- Número: ${params.caseNumber}
- Título: ${params.caseTitle}
- Tipo: ${params.caseType}
- Descripción: ${params.description}
${params.estimatedValue ? `- Valor estimado: $${params.estimatedValue}` : ''}
${params.jurisdiction ? `- Jurisdicción: ${params.jurisdiction}` : ''}

ANÁLISIS DE RIESGOS:
- Score general: ${riskMatrix.overallScore}/10
- Nivel: ${riskMatrix.riskLevel}
- Principales riesgos: ${riskMatrix.factors.slice(0, 3).map(f => f.name).join(', ')}

ESCENARIOS A GENERAR (exactamente estos 3, en este orden):
1. CONSERVADOR (conservative): Estrategia de menor riesgo, evitar litigio prolongado, buscar acuerdo temprano
2. MODERADO (moderate): Balance entre negociación y litigio, estrategia equilibrada
3. AGRESIVO (aggressive): Máxima presión legal, litigio completo, buscar sentencia favorable

Para cada escenario:
- successProbability: probabilidad real de éxito (0-100) considerando los riesgos
- estimatedDurationMonths: duración realista en meses
- estimatedCostRange: costos en ARS (honorarios + gastos procesales estimados)
- pros/cons: ventajas y desventajas específicas para este caso
- recommendedActions: acciones concretas y ordenadas por prioridad

Usa terminología y práctica jurídica argentina. Los costos deben ser realistas para el mercado argentino.`

  const { object, usage } = await generateObject({
    model: resolveModel('anthropic/claude-sonnet-4-20250514'),
    schema: scenariosSchema,
    prompt,
    temperature: 0.4,
  })

  return {
    scenarios: object.scenarios as StrategicScenario[],
    tokensUsed: (usage?.totalTokens ?? 0),
  }
}
