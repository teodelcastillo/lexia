import { generateObject } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'
import { analyzeRisks } from './risk-analyzer'
import { searchJurisprudence } from './jurisprudence-search'
import { generateScenarios } from './scenario-generator'
import { generateTimeline } from './timeline-generator'
import type { AnalyzeParams, StrategicAnalysis, ScenarioType } from './types'

const recommendationsSchema = z.object({
  primaryStrategy: z.enum(['conservative', 'moderate', 'aggressive']),
  reasoning: z.string(),
  nextSteps: z.array(z.string()).min(3).max(7),
})

async function buildRecommendations(
  params: AnalyzeParams,
  analysis: Omit<StrategicAnalysis, 'recommendations' | 'metadata'>
): Promise<{ primaryStrategy: ScenarioType; reasoning: string; nextSteps: string[]; tokensUsed: number }> {
  const prompt = `Eres un abogado estratega argentino senior. Basándote en el análisis completo del caso, proporciona la recomendación estratégica final.

CASO: ${params.caseTitle} (${params.caseType})
RIESGO GENERAL: ${analysis.riskMatrix.riskLevel} (${analysis.riskMatrix.overallScore}/10)

ESCENARIOS:
${analysis.scenarios.map(s => `- ${s.name}: ${s.successProbability}% éxito, ${s.estimatedDurationMonths} meses`).join('\n')}

JURISPRUDENCIA: ${analysis.jurisprudence.length} fallos relevantes encontrados

Determina:
1. primaryStrategy: qué escenario recomiendas (conservative/moderate/aggressive)
2. reasoning: razonamiento claro y específico para esta recomendación (2-3 párrafos)
3. nextSteps: los próximos pasos inmediatos y concretos (3-7 acciones)`

  const { object, usage } = await generateObject({
    model: resolveModel('anthropic/claude-sonnet-4-20250514'),
    schema: recommendationsSchema,
    prompt,
    temperature: 0.3,
  })

  return {
    primaryStrategy: object.primaryStrategy,
    reasoning: object.reasoning,
    nextSteps: object.nextSteps,
    tokensUsed: (usage?.totalTokens ?? 0),
  }
}

export async function analyzeCase(params: AnalyzeParams): Promise<StrategicAnalysis> {
  const startTime = Date.now()
  let totalTokens = 0

  // Run risk analysis and jurisprudence in parallel
  const [riskResult, jurisprudenceResult] = await Promise.all([
    analyzeRisks(params),
    searchJurisprudence(params),
  ])

  totalTokens += riskResult.tokensUsed + jurisprudenceResult.tokensUsed

  // Generate scenarios based on risk matrix
  const scenariosResult = await generateScenarios(params, riskResult.matrix)
  totalTokens += scenariosResult.tokensUsed

  // Pick the most likely recommended scenario for timeline (moderate by default)
  const recommendedForTimeline =
    scenariosResult.scenarios.find(s => s.type === 'moderate') ??
    scenariosResult.scenarios[0]

  // Generate timeline and final recommendations in parallel
  const [timelineResult, recommendationsResult] = await Promise.all([
    generateTimeline(params, recommendedForTimeline),
    buildRecommendations(params, {
      caseId: params.caseId,
      caseNumber: params.caseNumber,
      caseTitle: params.caseTitle,
      analyzedAt: new Date().toISOString(),
      riskMatrix: riskResult.matrix,
      scenarios: scenariosResult.scenarios,
      jurisprudence: jurisprudenceResult.results,
      timeline: { phases: [], criticalPath: [], totalEstimatedMonths: 0, alerts: [] },
    }),
  ])

  totalTokens += timelineResult.tokensUsed + recommendationsResult.tokensUsed

  const durationMs = Date.now() - startTime

  return {
    caseId: params.caseId,
    caseNumber: params.caseNumber,
    caseTitle: params.caseTitle,
    analyzedAt: new Date().toISOString(),
    riskMatrix: riskResult.matrix,
    scenarios: scenariosResult.scenarios,
    jurisprudence: jurisprudenceResult.results,
    timeline: timelineResult.timeline,
    recommendations: {
      primaryStrategy: recommendationsResult.primaryStrategy,
      reasoning: recommendationsResult.reasoning,
      nextSteps: recommendationsResult.nextSteps,
    },
    metadata: {
      analysisVersion: '1.0.0',
      tokensUsed: totalTokens,
      durationMs,
    },
  }
}
