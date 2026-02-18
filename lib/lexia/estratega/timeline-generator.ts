import { generateObject } from 'ai'
import { z } from 'zod'
import { resolveModel } from '@/lib/ai/resolver'
import type { AnalyzeParams, StrategicScenario, StrategicTimeline } from './types'
import { format } from 'date-fns'

const milestoneSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  phase: z.enum(['preparation', 'negotiation', 'litigation', 'resolution']),
  offsetDays: z.number().min(0),
  isCritical: z.boolean(),
  dependencies: z.array(z.string()),
  alerts: z.array(z.string()),
})

const timelineSchema = z.object({
  milestones: z.array(milestoneSchema).min(4).max(16),
  criticalPath: z.array(z.string()),
  totalEstimatedMonths: z.number().min(1),
  alerts: z.array(z.string()),
})

export async function generateTimeline(
  params: AnalyzeParams,
  recommendedScenario: StrategicScenario
): Promise<{ timeline: StrategicTimeline; tokensUsed: number }> {
  const startDate = params.filingDate ? new Date(params.filingDate) : new Date()

  const prompt = `Eres un abogado estratega argentino. Genera un timeline detallado para el siguiente caso legal.

CASO:
- Tipo: ${params.caseType}
- Descripción: ${params.description}
- Estrategia elegida: ${recommendedScenario.name} (${recommendedScenario.type})
- Duración estimada: ${recommendedScenario.estimatedDurationMonths} meses
${params.jurisdiction ? `- Jurisdicción: ${params.jurisdiction}` : ''}

FASES DEL PROCESO:
1. preparation: Preparación del caso (recopilación de pruebas, análisis, estrategia)
2. negotiation: Negociación / mediación previa
3. litigation: Litigio principal (presentación de escritos, audiencias, producción de prueba)
4. resolution: Resolución (sentencia, recursos, cobro/cumplimiento)

Para cada hito (milestone) proporciona:
- id: identificador único corto (ej: "m1", "prep-inicio")
- title: nombre claro del hito
- description: descripción de la acción/evento
- phase: fase correspondiente
- offsetDays: días desde el inicio del caso (0 = día inicial)
- isCritical: si es un hito crítico para el proceso
- dependencies: ids de hitos que deben completarse antes
- alerts: advertencias importantes (plazos legales, riesgos, etc.)

IMPORTANTE: Los offsetDays deben ser progresivos y realistas según los plazos del proceso civil argentino.
Incluir hitos reales: audiencia preliminar, presentación de prueba, plazo de prueba, alegatos, sentencia, etc.`

  const { object, usage } = await generateObject({
    model: resolveModel('openai/gpt-4-turbo'),
    schema: timelineSchema,
    prompt,
    temperature: 0.3,
  })

  // Convert offsetDays to real dates and group by phase
  const phaseOrder: StrategicTimeline['phases'][0]['phase'][] = [
    'preparation', 'negotiation', 'litigation', 'resolution'
  ]
  const phaseNames: Record<string, string> = {
    preparation: 'Preparación',
    negotiation: 'Negociación',
    litigation: 'Litigio',
    resolution: 'Resolución',
  }

  const milestonesWithDates = object.milestones.map(m => ({
    id: m.id,
    title: m.title,
    description: m.description,
    phase: m.phase,
    estimatedDate: format(
      new Date(startDate.getTime() + m.offsetDays * 24 * 60 * 60 * 1000),
      'yyyy-MM-dd'
    ),
    isCritical: m.isCritical,
    dependencies: m.dependencies,
    alerts: m.alerts,
  }))

  const phases = phaseOrder.map(phase => {
    const phaseMilestones = milestonesWithDates.filter(m => m.phase === phase)
    const dates = phaseMilestones.map(m => m.estimatedDate).sort()
    const startMs = phaseMilestones.length > 0
      ? new Date(dates[0]).getTime()
      : startDate.getTime()
    const endMs = phaseMilestones.length > 0
      ? new Date(dates[dates.length - 1]).getTime()
      : startMs

    return {
      phase,
      name: phaseNames[phase],
      startDate: format(new Date(startMs), 'yyyy-MM-dd'),
      endDate: format(new Date(endMs), 'yyyy-MM-dd'),
      milestones: phaseMilestones,
    }
  }).filter(p => p.milestones.length > 0)

  const timeline: StrategicTimeline = {
    phases,
    criticalPath: object.criticalPath,
    totalEstimatedMonths: object.totalEstimatedMonths,
    alerts: object.alerts,
  }

  return {
    timeline,
    tokensUsed: (usage?.totalTokens ?? 0),
  }
}
