'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  PenTool,
  FileText,
  FileEdit,
  Scale,
  Target,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/client'

interface LexiaRedactorSidebarProps {
  caseContext: { id: string; caseNumber: string; title: string } | null
}

export function LexiaRedactorSidebar({ caseContext }: LexiaRedactorSidebarProps) {
  const pathname = usePathname()
  const [hasOrg, setHasOrg] = useState<boolean | null>(null)

  const isRedactor = pathname.startsWith('/lexia/redactor')
  const isBorradores = pathname.startsWith('/lexia/borradores')
  const isContestacion = pathname.startsWith('/lexia/contestacion')
  const isEstrategaPage = pathname.startsWith('/lexia/estratega')
  const effectiveCaseId = caseContext?.id ?? null

  useEffect(() => {
    async function checkOrg() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setHasOrg(false)
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()
      setHasOrg(!!profile?.organization_id)
    }
    checkOrg()
  }, [])

  return (
    <div className="flex w-[280px] flex-shrink-0 flex-col min-h-0 border-r border-border bg-muted/30">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <PenTool className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Lexia Redactor</h2>
            <p className="text-xs text-muted-foreground">Borradores jurídicos</p>
          </div>
        </div>

        <Link
          href={effectiveCaseId ? `/lexia/redactor?caso=${effectiveCaseId}` : '/lexia/redactor'}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            isRedactor
              ? 'bg-background text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <PenTool className="h-4 w-4" />
          Nuevo borrador
        </Link>

        <Link
          href={effectiveCaseId ? `/lexia/contestacion?caso=${effectiveCaseId}` : '/lexia/contestacion'}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            isContestacion
              ? 'bg-background text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Scale className="h-4 w-4" />
          Contestación guiada
        </Link>

        <Link
          href={effectiveCaseId ? `/lexia/estratega?caso=${effectiveCaseId}` : '/lexia/estratega'}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            isEstrategaPage
              ? 'bg-background text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Target className="h-4 w-4" />
          Estratega
        </Link>

        {hasOrg && (
          <Link
            href="/lexia/plantillas"
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              pathname.startsWith('/lexia/plantillas')
                ? 'bg-background text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <FileText className="h-4 w-4" />
            Plantillas
          </Link>
        )}

        <Link
          href={effectiveCaseId ? `/lexia/borradores?caso=${effectiveCaseId}` : '/lexia/borradores'}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            isBorradores
              ? 'bg-background text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <FileEdit className="h-4 w-4" />
          Borradores
        </Link>
      </div>
    </div>
  )
}
