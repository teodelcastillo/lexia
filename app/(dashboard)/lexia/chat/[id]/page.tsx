'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LexiaChat } from '@/components/lexia/lexia-chat'
import { Loader2 } from 'lucide-react'

interface CaseContext {
  id: string
  caseNumber: string
  title: string
  type?: string
}

export default function LexiaChatByIdPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const caseId = searchParams.get('caso')
  const convId = params.id as string

  const [conversation, setConversation] = useState<{
    messages: unknown[]
    caseContext: CaseContext | null
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
        <p className="text-destructive">{error || 'Error desconocido'}</p>
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
