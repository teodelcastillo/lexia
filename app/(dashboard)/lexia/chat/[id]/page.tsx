'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LexiaChat } from '@/components/lexia/lexia-chat'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CaseContext {
  id: string
  caseNumber: string
  title: string
  type?: string
}

export default function LexiaChatByIdPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const caseId = searchParams.get('caso')
  const convId = params.id as string

  const [conversation, setConversation] = useState<{
    messages: unknown[]
    caseContext: CaseContext | null
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/lexia/conversations/${convId}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('Conversación no encontrada')
          } else {
            setError('Error al cargar')
          }
          return
        }
        const data = await res.json()
        let caseContext: CaseContext | null = null
        if (data.case_id) {
          const { data: caseData } = await supabase
            .from('cases')
            .select('id, case_number, title, case_type')
            .eq('id', data.case_id)
            .single()
          if (caseData) {
            caseContext = {
              id: caseData.id,
              caseNumber: caseData.case_number,
              title: caseData.title,
              type: caseData.case_type,
            }
          }
        }
        if (!caseContext && caseId) {
          const { data: caseData } = await supabase
            .from('cases')
            .select('id, case_number, title, case_type')
            .eq('id', caseId)
            .single()
          if (caseData) {
            caseContext = {
              id: caseData.id,
              caseNumber: caseData.case_number,
              title: caseData.title,
              type: caseData.case_type,
            }
          }
        }
        setConversation({
          messages: data.messages || [],
          caseContext,
        })
      } catch (err) {
        setError('Error al cargar la conversación')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [convId, caseId, supabase])

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

  if (error || !conversation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full text-center p-8">
        <p className="text-muted-foreground mb-6">{error || 'Error desconocido'}</p>
        <Button onClick={handleNewConversation} disabled={isCreating}>
          {isCreating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Nueva conversación
        </Button>
      </div>
    )
  }

  return (
    <LexiaChat
      conversationId={convId}
      initialMessages={conversation.messages}
      caseContext={conversation.caseContext}
    />
  )
}
