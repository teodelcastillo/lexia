'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Sparkles,
  Plus,
  FolderOpen,
  Loader2,
  MessageSquare,
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

  const convIdMatch = pathname.match(/\/lexia\/chat\/([^/]+)/)
  const activeConversationId = convIdMatch?.[1] ?? null

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
    loadCases()
  }, [loadCases])

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
    <div className="flex w-[280px] flex-shrink-0 flex-col border-r border-border bg-muted/30">
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

        <Select
          value={caseContext?.id ?? 'none'}
          onValueChange={(v) => {
            const params = new URLSearchParams(searchParams)
            if (v === 'none') {
              params.delete('caso')
            } else {
              params.set('caso', v)
            }
            const q = params.toString()
            router.push(q ? `${pathname}?${q}` : pathname)
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
      </div>

      <Separator />

      <div className="flex-1 overflow-hidden flex flex-col p-2">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Historial</span>
        </div>
        <div className="flex-1 min-h-0">
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
    </div>
  )
}
