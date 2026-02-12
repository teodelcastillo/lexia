'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LexiaCaseContextBar } from '@/components/lexia/lexia-case-context-bar'
import { useLexiaCaseContext } from '@/lib/lexia/lexia-case-context'

/**
 * Lexia Chat - No conversation selected
 * When no conversations: show empty state + case selector + button to create.
 * When has conversations: redirect to most recent.
 */
export default function LexiaChatPage() {
  const caseContext = useLexiaCaseContext()
  const router = useRouter()
  const searchParams = useSearchParams()
  const caseId = searchParams.get('caso')
  const [conversations, setConversations] = useState<{ id: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)

  const loadConversations = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (caseId) params.set('caseId', caseId)
      const res = await fetch(`/api/lexia/conversations?${params}`)
      if (res.ok) {
        const data = await res.json()
        setConversations(data)
        return data
      }
      return []
    } catch {
      return []
    } finally {
      setIsLoading(false)
    }
  }, [caseId])

  useEffect(() => {
    loadConversations().then((list) => {
      if (Array.isArray(list) && list.length > 0) {
        const q = caseId ? `?caso=${caseId}` : ''
        router.replace(`/lexia/chat/${list[0].id}${q}`)
      }
    })
  }, [loadConversations, router, caseId])

  const handleNewConversation = async () => {
    setIsCreating(true)
    try {
      const res = await fetch('/api/lexia/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: caseId || null }),
      })
      if (res.ok) {
        const { id } = await res.json()
        const q = caseId ? `?caso=${caseId}` : ''
        router.replace(`/lexia/chat/${id}${q}`)
      }
    } catch (err) {
      console.error('[Lexia] Error creating conversation:', err)
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (conversations.length > 0) {
    return (
      <div className="flex items-center justify-center min-h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const caseInfo = caseContext
    ? { id: caseContext.id, caseNumber: caseContext.caseNumber, title: caseContext.title }
    : null

  return (
    <div className="flex flex-1 flex-col w-full max-w-2xl mx-auto">
      <div className="border-b border-border px-4 py-3 flex-shrink-0 bg-muted/30">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Nueva conversación
        </p>
        <LexiaCaseContextBar
          caseContext={caseInfo}
          basePath="/lexia/chat"
          editable={true}
          emptyLabel="Conversación general"
          withCaseLabel="Sobre el caso"
        />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mb-6">
          <Sparkles className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No hay conversaciones</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {caseInfo
            ? `Iniciá una conversación sobre ${caseInfo.caseNumber} para que Lexia tenga contexto del caso.`
            : 'Iniciá una conversación general o elegí un caso para que Lexia tenga contexto.'}
        </p>
        <Button onClick={handleNewConversation} disabled={isCreating} size="lg">
        {isCreating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Plus className="mr-2 h-4 w-4" />
        )}
        Nueva conversación
        </Button>
      </div>
    </div>
  )
}
