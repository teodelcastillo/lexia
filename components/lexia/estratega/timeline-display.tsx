'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, Circle, Flag } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { StrategicTimeline, TimelinePhase } from '@/lib/lexia/estratega/types'

const PHASE_CONFIG: Record<TimelinePhase, { name: string; color: string; bg: string }> = {
  preparation: { name: 'Preparación',  color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-950/30' },
  negotiation: { name: 'Negociación',  color: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-950/30' },
  litigation:  { name: 'Litigio',      color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-950/30' },
  resolution:  { name: 'Resolución',   color: 'text-emerald-600',bg: 'bg-emerald-100 dark:bg-emerald-950/30' },
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM yyyy", { locale: es })
  } catch {
    return dateStr
  }
}

interface Props {
  timeline: StrategicTimeline
  criticalPath?: string[]
}

export function TimelineDisplay({ timeline, criticalPath = [] }: Props) {
  const allCritical = new Set([...timeline.criticalPath, ...criticalPath])

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Flag className="h-4 w-4" />
          <span>Duración total estimada:</span>
          <span className="font-semibold text-foreground">
            {timeline.totalEstimatedMonths} meses
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {timeline.phases.map(p => (
            <Badge key={p.phase} variant="outline" className={`${PHASE_CONFIG[p.phase].color} border-current text-xs`}>
              {PHASE_CONFIG[p.phase].name}: {formatDate(p.startDate)} → {formatDate(p.endDate)}
            </Badge>
          ))}
        </div>
      </div>

      {/* Global alerts */}
      {timeline.alerts.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Alertas del timeline
          </div>
          {timeline.alerts.map((alert, i) => (
            <p key={i} className="text-xs text-amber-600 dark:text-amber-500 ml-6">{alert}</p>
          ))}
        </div>
      )}

      {/* Phases & milestones */}
      {timeline.phases.map((phase) => {
        const cfg = PHASE_CONFIG[phase.phase]
        return (
          <Card key={phase.phase} className="overflow-hidden">
            <CardHeader className={`py-3 px-4 ${cfg.bg}`}>
              <CardTitle className={`text-sm flex items-center justify-between ${cfg.color}`}>
                <span>{phase.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {formatDate(phase.startDate)} → {formatDate(phase.endDate)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[11px] top-0 bottom-0 w-0.5 bg-border" />

                <div className="space-y-4">
                  {phase.milestones.map((milestone, idx) => {
                    const isCritical = allCritical.has(milestone.id)
                    return (
                      <div key={milestone.id} className="relative pl-8">
                        {/* Dot */}
                        <div className={`absolute left-0 top-1 h-5 w-5 rounded-full border-2 flex items-center justify-center bg-background ${isCritical ? 'border-primary' : 'border-border'}`}>
                          {isCritical
                            ? <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
                            : <Circle className="h-2.5 w-2.5 fill-muted text-muted" />
                          }
                        </div>

                        <div>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{milestone.title}</p>
                              {isCritical && (
                                <Badge variant="destructive" className="text-[9px] px-1 py-0">Crítico</Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatDate(milestone.estimatedDate)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{milestone.description}</p>

                          {milestone.alerts.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {milestone.alerts.map((alert, ai) => (
                                <span key={ai} className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  {alert}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
