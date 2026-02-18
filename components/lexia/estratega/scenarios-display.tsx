'use client'

import { TrendingDown, TrendingUp, BarChart3, CheckCircle2, XCircle, Clock, DollarSign, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { StrategicScenario, ScenarioType } from '@/lib/lexia/estratega/types'

const SCENARIO_CONFIG: Record<ScenarioType, {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
}> = {
  conservative: { icon: TrendingDown, color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-950/30',   border: 'border-blue-200 dark:border-blue-800' },
  moderate:     { icon: BarChart3,    color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800' },
  aggressive:   { icon: TrendingUp,   color: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-50 dark:bg-rose-950/30',   border: 'border-rose-200 dark:border-rose-800' },
}

const PRIORITY_COLORS = {
  high:   'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  low:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${amount}`
}

interface Props {
  scenarios: StrategicScenario[]
  recommendedType?: ScenarioType
}

export function ScenariosDisplay({ scenarios, recommendedType }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {scenarios.map((scenario) => {
        const cfg = SCENARIO_CONFIG[scenario.type]
        const Icon = cfg.icon
        const isRecommended = scenario.type === recommendedType

        return (
          <Card
            key={scenario.type}
            className={`relative overflow-hidden ${isRecommended ? `ring-2 ring-primary ${cfg.border}` : ''}`}
          >
            {isRecommended && (
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-bl-md">
                RECOMENDADO
              </div>
            )}

            <CardHeader className={`pb-3 ${cfg.bg}`}>
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${cfg.color}`} />
                <CardTitle className="text-base">{scenario.name}</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">{scenario.description}</p>

              {/* Key metrics */}
              <div className="mt-3 space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Probabilidad de éxito</span>
                    <span className={`font-bold ${cfg.color}`}>{scenario.successProbability}%</span>
                  </div>
                  <Progress value={scenario.successProbability} className="h-1.5 [&_[data-slot=progress-indicator]]:bg-current" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{scenario.estimatedDurationMonths} meses</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span>
                      {formatCurrency(scenario.estimatedCostRange.min)}–{formatCurrency(scenario.estimatedCostRange.max)}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Pros */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Ventajas</p>
                <ul className="space-y-1">
                  {scenario.pros.map((pro, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cons */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Desventajas</p>
                <ul className="space-y-1">
                  {scenario.cons.map((con, i) => (
                    <li key={i} className="flex gap-2 text-xs">
                      <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Acciones</p>
                <ul className="space-y-1.5">
                  {scenario.recommendedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <ArrowRight className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span>{action.action}</span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-muted-foreground">{action.timeframe}</span>
                          <Badge className={`text-[9px] px-1 py-0 ${PRIORITY_COLORS[action.priority]}`}>
                            {action.priority === 'high' ? 'Alta' : action.priority === 'medium' ? 'Media' : 'Baja'}
                          </Badge>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
