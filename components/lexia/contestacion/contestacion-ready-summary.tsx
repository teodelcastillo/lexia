'use client'

import type { FormDataConsolidado } from '@/lib/lexia/contestacion/types'

interface ContestacionReadySummaryProps {
  formData: FormDataConsolidado
  className?: string
}

export function ContestacionReadySummary({
  formData,
  className,
}: ContestacionReadySummaryProps) {
  return (
    <div className={className}>
      <h3 className="font-semibold text-sm mb-3">Resumen consolidado</h3>
      <div className="space-y-4 text-sm">
        {formData.hechos_admitidos && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Hechos admitidos</p>
            <p className="whitespace-pre-wrap">{formData.hechos_admitidos}</p>
          </div>
        )}
        {formData.hechos_negados && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Hechos negados</p>
            <p className="whitespace-pre-wrap">{formData.hechos_negados}</p>
          </div>
        )}
        {formData.defensas && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Defensas de fondo</p>
            <p className="whitespace-pre-wrap">{formData.defensas}</p>
          </div>
        )}
        {formData.excepciones && (
          <div>
            <p className="font-medium text-muted-foreground mb-1">Excepciones</p>
            <p className="whitespace-pre-wrap">{formData.excepciones}</p>
          </div>
        )}
      </div>
    </div>
  )
}
