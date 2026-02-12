'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  PenTool,
  FolderOpen,
  FileText,
  FileEdit,
} from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'

interface LexiaRedactorSidebarProps {
  caseContext: { id: string; caseNumber: string; title: string } | null
}

export function LexiaRedactorSidebar({ caseContext }: LexiaRedactorSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [availableCases, setAvailableCases] = useState<
    { id: string; caseNumber: string; title: string }[]
  >([])
  const [hasOrg, setHasOrg] = useState<boolean | null>(null)

  const isRedactor = pathname.startsWith('/lexia/redactor')
  const isBorradores = pathname.startsWith('/lexia/borradores')
  const caseIdFromUrl = searchParams.get('caso')
  const effectiveCaseId = caseContext?.id ?? caseIdFromUrl

  const loadCases = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('cases')
      .select('id, case_number, title')
      .order('updated_at', { ascending: false })
      .limit(20)
    if (!error && data) {
      setAvailableCases(
        data.map((c) => ({
          id: c.id,
          caseNumber: c.case_number,
          title: c.title,
        }))
      )
    }
  }, [])

  useEffect(() => {
    loadCases()
  }, [loadCases])

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

  const getBasePath = () => {
    if (isRedactor) return '/lexia/redactor'
    if (isBorradores) return '/lexia/borradores'
    if (pathname.startsWith('/lexia/plantillas')) return '/lexia/plantillas'
    return '/lexia/redactor'
  }

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

        <Select
          value={caseContext?.id ?? 'none'}
          onValueChange={(v) => {
            const params = new URLSearchParams(searchParams)
            if (v === 'none') {
              params.delete('caso')
            } else {
              params.set('caso', v)
            }
            const base = getBasePath()
            const q = params.toString()
            router.push(q ? `${base}?${q}` : base)
          }}
        >
          <SelectTrigger className="w-full">
            <FolderOpen className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Sin contexto de caso" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin contexto de caso</SelectItem>
            <Separator className="my-1" />
            {availableCases.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.caseNumber} - {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
