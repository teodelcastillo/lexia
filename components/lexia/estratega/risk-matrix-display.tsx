'use client'

import { Shield, AlertTriangle, AlertCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { RiskMatrix, RiskLevel } from '@/lib/lexia/estratega/types'

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  low:      { label: 'Bajo',     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', icon: Shield },
  medium:   { label: 'Medio',    color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-950/30',     icon: AlertTriangle },
  high:     { label: 'Alto',     color: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-50 dark:bg-orange-950/30',   icon: AlertCircle },
  critical: { label: 'Crítico',  color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-950/30',         icon: XCircle },
}


interface Props {
  riskMatrix: RiskMatrix
}

export function RiskMatrixDisplay({ riskMatrix }: Props) {
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null)
  const config = RISK_CONFIG[riskMatrix.riskLevel]
  const Icon = config.icon

  return (
    <div className="space-y-4">
      {/* Overall risk card */}
      <div className={`rounded-lg border p-4 ${config.bg}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            <span className="font-semibold">Riesgo General</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${config.color}`}>
              {riskMatrix.overallScore.toFixed(1)}
            </span>
            <span className="text-muted-foreground text-sm">/10</span>
            <Badge variant="outline" className={`${config.color} border-current`}>
              {config.label}
            </Badge>
          </div>
        </div>
        <Progress
          value={riskMatrix.overallScore * 10}
          className="h-2 mb-3"
        />
        <p className="text-sm text-muted-foreground">{riskMatrix.summary}</p>
      </div>

      {/* Risk factors */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Factores de riesgo ({riskMatrix.factors.length})
        </h3>
        {riskMatrix.factors.map((factor) => {
          const fConfig = RISK_CONFIG[factor.level]
          const FIcon = fConfig.icon
          const isExpanded = expandedFactor === factor.id

          return (
            <Card key={factor.id} className="overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => setExpandedFactor(isExpanded ? null : factor.id)}
              >
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FIcon className={`h-4 w-4 flex-shrink-0 ${fConfig.color}`} />
                      <span className="font-medium text-sm truncate">{factor.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                        {factor.category}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-bold ${fConfig.color}`}>
                        {factor.score.toFixed(1)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <Progress
                    value={factor.score * 10}
                    className="h-1 mt-2"
                  />
                </CardHeader>
              </button>

              {isExpanded && (
                <CardContent className="pt-0 px-4 pb-4 space-y-3">
                  <p className="text-sm text-muted-foreground">{factor.description}</p>
                  <div className={`rounded-md p-3 ${fConfig.bg}`}>
                    <p className="text-xs font-medium mb-1">Estrategia de mitigación</p>
                    <p className="text-sm">{factor.mitigation}</p>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Recommendations */}
      {riskMatrix.recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recomendaciones generales</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {riskMatrix.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
