'use client'

/**
 * Non-intrusive banner shown on legacy Lexia pages (Redactor, Contestación)
 * inviting the lawyer to use the new Workspace. We prefer guiding over
 * force-redirecting so deep links keep working while we finish the migration.
 */

import Link from 'next/link'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

interface MigrationBannerProps {
  /** Pre-fill the new document type when the user clicks the CTA. */
  preferType?: 'demanda' | 'contestacion'
  /** Storage key so each legacy surface can be dismissed independently. */
  dismissKey: string
}

export function WorkspaceMigrationBanner({ preferType, dismissKey }: MigrationBannerProps) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      const v = localStorage.getItem(`lexia_workspace_banner_${dismissKey}`)
      setDismissed(v === '1')
    } catch {
      setDismissed(false)
    }
  }, [dismissKey])

  if (dismissed) return null

  const href = preferType
    ? `/lexia/workspace/nuevo?type=${preferType}`
    : '/lexia/workspace'

  return (
    <div className="relative mb-4 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
      <div className="flex items-start gap-3 pr-8">
        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 text-sm">
          <p className="font-medium">Probá la nueva experiencia Workspace</p>
          <p className="text-muted-foreground">
            Editor con ⌘K sobre selección, diff en vivo, control sobre cada cambio y verificación
            automática de citas. Reemplaza al Redactor tradicional para demanda y contestación.
          </p>
        </div>
        <Button asChild size="sm" className="flex-shrink-0">
          <Link href={href}>
            Ir al Workspace
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
      <button
        type="button"
        aria-label="Descartar"
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
        onClick={() => {
          try {
            localStorage.setItem(`lexia_workspace_banner_${dismissKey}`, '1')
          } catch {
            // ignore
          }
          setDismissed(true)
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
