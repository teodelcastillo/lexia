'use client'

/**
 * Simple word-level diff rendering for the ⌘K preview.
 *
 * We don't use a full diff library here on purpose — lawyers reading the
 * preview benefit more from seeing the two texts side by side than a
 * per-word diff for prose-heavy content. We show:
 *   - Original text (struck through, red-ish)
 *   - Proposed replacement (green-ish)
 *
 * For short edits (< 400 chars) we render inline. For longer edits, stacked.
 */

import { cn } from '@/lib/utils'

interface DiffViewProps {
  original: string
  replacement: string
  compact?: boolean
}

export function DiffView({ original, replacement, compact }: DiffViewProps) {
  const empty = !original && !replacement
  if (empty) return null

  const isShort =
    compact || (original.length + replacement.length < 240 && !original.includes('\n') && !replacement.includes('\n'))

  if (isShort) {
    return (
      <div className="space-y-1 text-sm leading-relaxed">
        {original && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-2.5 py-1.5">
            <span className="text-red-700 dark:text-red-400 line-through decoration-red-400/60">
              {original}
            </span>
          </div>
        )}
        {replacement && (
          <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-2.5 py-1.5">
            <span className="text-green-800 dark:text-green-300">{replacement}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 text-sm leading-relaxed">
      {original && (
        <section
          className={cn(
            'rounded-md border px-3 py-2',
            'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900'
          )}
        >
          <div className="mb-1 text-[10px] uppercase tracking-wide text-red-700/80 dark:text-red-400/80">
            Actual
          </div>
          <div className="whitespace-pre-wrap text-red-900/90 dark:text-red-300/90 line-through decoration-red-400/50">
            {original}
          </div>
        </section>
      )}
      {replacement && (
        <section
          className={cn(
            'rounded-md border px-3 py-2',
            'bg-green-50/70 dark:bg-green-950/30 border-green-200 dark:border-green-900'
          )}
        >
          <div className="mb-1 text-[10px] uppercase tracking-wide text-green-700/80 dark:text-green-400/80">
            Propuesta
          </div>
          <div className="whitespace-pre-wrap text-green-900 dark:text-green-200">
            {replacement}
          </div>
        </section>
      )}
    </div>
  )
}
