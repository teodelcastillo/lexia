'use client'

import { cn } from '@/lib/utils'
import { Check, Circle } from 'lucide-react'

const STEPS = [
  { id: 'parsed', label: 'Parseado' },
  { id: 'analyzed', label: 'Analizado' },
  { id: 'questions', label: 'Preguntas' },
  { id: 'ready_for_redaction', label: 'Listo para redacción' },
] as const

interface ContestacionProgressProps {
  currentStep: string
  className?: string
}

export function ContestacionProgress({
  currentStep,
  className,
}: ContestacionProgressProps) {
  const displayStep = currentStep === 'need_more_info' ? 'questions' : currentStep
  const stepIndex = STEPS.findIndex((s) => s.id === displayStep)
  const effectiveIndex = stepIndex >= 0 ? stepIndex : 0

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {STEPS.map((step, i) => {
        const isComplete = i < effectiveIndex || (i === effectiveIndex && currentStep === step.id)
        const isCurrent = i === effectiveIndex
        return (
          <div key={step.id} className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium',
                isComplete
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isCurrent
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground'
              )}
            >
              {i < effectiveIndex ? (
                <Check className="h-4 w-4" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </div>
            <span
              className={cn(
                'text-sm',
                isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-px w-4',
                  i < effectiveIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
