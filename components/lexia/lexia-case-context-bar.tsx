'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Briefcase, ChevronDown, Link2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

export interface CaseInfo {
  id: string
  caseNumber: string
  title: string
}

interface LexiaCaseContextBarProps {
  /** Current case context (from conversation, URL, etc.) */
  caseContext: CaseInfo | null
  /** Base path for navigation when changing case (e.g. /lexia/chat, /lexia/redactor) */
  basePath: string
  /** Allow changing the case (e.g. true for redactor, false for existing chat) */
  editable?: boolean
  /** Label when no case: "Conversación general" or "Documento genérico" */
  emptyLabel?: string
  /** Label prefix when has case: "Conversación sobre" or "Documento para" */
  withCaseLabel?: string
  /** Compact style for tight spaces */
  compact?: boolean
}

export function LexiaCaseContextBar({
  caseContext,
  basePath,
  editable = true,
  emptyLabel = 'Sin caso asociado',
  withCaseLabel = 'Caso',
  compact = false,
}: LexiaCaseContextBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [cases, setCases] = useState<CaseInfo[]>([])
  const [isLoadingCases, setIsLoadingCases] = useState(false)

  const loadCases = useCallback(async () => {
    setIsLoadingCases(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('cases')
        .select('id, case_number, title')
        .order('updated_at', { ascending: false })
        .limit(30)
      if (!error && data) {
        setCases(
          data.map((c) => ({
            id: c.id,
            caseNumber: c.case_number,
            title: c.title,
          }))
        )
      }
    } catch (err) {
      console.error('[LexiaCaseContextBar] Error loading cases:', err)
    } finally {
      setIsLoadingCases(false)
    }
  }, [])

  useEffect(() => {
    if (editable && open) loadCases()
  }, [editable, open, loadCases])

  const changeCase = (caseId: string | null) => {
    const params = new URLSearchParams(searchParams)
    if (!caseId) {
      params.delete('caso')
    } else {
      params.set('caso', caseId)
    }
    const q = params.toString()
    router.push(q ? `${basePath}?${q}` : basePath)
    setOpen(false)
  }

  const displayText = caseContext
    ? `${caseContext.caseNumber} — ${caseContext.title}`
    : emptyLabel

  if (!editable && !caseContext) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 text-muted-foreground',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
        <span>{emptyLabel}</span>
      </div>
    )
  }

  if (!editable && caseContext) {
    return (
      <div
        className={cn(
          'flex items-center gap-2',
          compact ? 'text-xs' : 'text-sm'
        )}
      >
        <Briefcase className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span className="text-muted-foreground">{withCaseLabel}:</span>
        <Link
          href={`/casos/${caseContext.id}`}
          className="font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          {caseContext.caseNumber}
          <Link2 className="h-3 w-3" />
        </Link>
        <span className="text-muted-foreground truncate max-w-[180px]">
          {caseContext.title}
        </span>
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-auto font-normal justify-start gap-2 min-w-0',
            compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
          )}
        >
          <Briefcase
            className={cn(
              'flex-shrink-0',
              caseContext ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <span className="truncate text-left flex-1 min-w-0">
            {caseContext ? (
              <>
                <span className="text-muted-foreground">{withCaseLabel}: </span>
                {displayText}
              </>
            ) : (
              <span className="text-muted-foreground">{displayText}</span>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-2">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">
            {withCaseLabel}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start font-normal"
            onClick={() => changeCase(null)}
          >
            Sin caso
          </Button>
        </div>
        <Separator />
        <ScrollArea className="h-[240px]">
          {isLoadingCases ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              {cases.map((c) => (
                <Button
                  key={c.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start font-normal h-auto py-2"
                  onClick={() => changeCase(c.id)}
                >
                  <div className="text-left truncate min-w-0">
                    <span className="font-medium">{c.caseNumber}</span>
                    <span className="text-muted-foreground"> — {c.title}</span>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
