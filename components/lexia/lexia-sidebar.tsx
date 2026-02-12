'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles,
  Plus,
  FolderOpen,
  Loader2,
  MessageSquare,
  PenTool,
  FileText,
  FileEdit,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { LexiaConversationList } from './lexia-conversation-list'
import { createClient } from '@/lib/supabase/client'
import type { ConversationListItem } from '@/lib/lexia'

interface LexiaSidebarProps {
  caseContext: { id: string; caseNumber: string; title: string } | null
}

export function LexiaSidebar({ caseContext }: LexiaSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [isLoadingConversations, setIsLoadingConversations] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [availableCases, setAvailableCases] = useState<
    { id: string; caseNumber: string; title: string }[]
  >([])
  const [hasOrg, setHasOrg] = useState<boolean | null>(null)

  const convIdMatch = pathname.match(/\/lexia\/chat\/([^/]+)/)
  const activeConversationId = convIdMatch?.[1] ?? null
  const isRedactor = pathname.startsWith('/lexia/redactor')
  const isBorradores = pathname.startsWith('/lexia/borradores')
  const caseIdFromUrl = searchParams.get('caso')
  const effectiveCaseId = caseContext?.id ?? caseIdFromUrl

  const loadConversations = useCallback(async (caseId?: string | null) => {
    setIsLoadingConversations(true)
    try {
      const params = new URLSearchParams()
      if (caseId) params.set('caseId', caseId)
      const res = await fetch(`/api/lexia/conversations?${params}`)
      if (res.ok) {
        const data = await res.json()
        setConversations(data)
      }
    } catch (err) {
      console.error('[Lexia] Error loading conversations:', err)
    } finally {
      setIsLoadingConversations(false)
    }
  }, [])

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
    loadConversations(caseContext?.id ?? null)
  }, [loadConversations, caseContext?.id])

  useEffect(() => {
    const handleRefresh = () => loadConversations(caseContext?.id ?? null)
    window.addEventListener('lexia-conversations-refresh', handleRefresh)
    return () => window.removeEventListener('lexia-conversations-refresh', handleRefresh)
  }, [loadConversations, caseContext?.id])

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

  const handleNewConversation = async () => {
    setIsCreating(true)
    try {
      const res = await fetch('/api/lexia/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: caseContext?.id ?? null }),
      })
      if (!res.ok) throw new Error('Failed to create')
      const { id } = await res.json()
      router.push(`/lexia/chat/${id}`)
    } catch (err) {
      console.error('[Lexia] Error creating conversation:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleSelectConversation = (id: string) => {
    router.push(`/lexia/chat/${id}`)
  }

  return (
    <div className="flex w-[280px] flex-shrink-0 flex-col min-h-0 border-r border-border bg-muted/30">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Lexia</h2>
            <p className="text-xs text-muted-foreground">IA Legal</p>
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-lg bg-muted/50">
          <Link
            href={effectiveCaseId ? `/lexia/chat?caso=${effectiveCaseId}` : '/lexia/chat'}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              !isRedactor && !pathname.startsWith('/lexia/plantillas') && !isBorradores
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </Link>
          <Link
            href={effectiveCaseId ? `/lexia/redactor?caso=${effectiveCaseId}` : '/lexia/redactor'}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              isRedactor
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PenTool className="h-4 w-4" />
            Redactor
          </Link>
        </div>

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
            const base = isRedactor ? '/lexia/redactor' : pathname.replace(/\/lexia\/chat\/[^/]+/, '/lexia/chat')
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

        {!isRedactor && (
          <Button
            className="w-full"
            onClick={handleNewConversation}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Nueva conversación
          </Button>
        )}
      </div>

      {!isRedactor && (
        <>
          <Separator />

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col p-2">
        <div className="flex items-center gap-2 px-2 py-1.5 flex-shrink-0">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Historial</span>
        </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <LexiaConversationList
                conversations={conversations}
                activeId={activeConversationId}
                caseFilter={caseContext?.id ?? null}
                isLoading={isLoadingConversations}
                onSelect={handleSelectConversation}
                onCaseFilterChange={() => {}}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
