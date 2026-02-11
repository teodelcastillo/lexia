'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles } from 'lucide-react'

/**
 * Lexia Chat - No conversation selected
 * Shows placeholder and redirects to new conversation when user has case context,
 * or prompts to select a conversation from sidebar.
 */
export default function LexiaChatPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const createAndRedirect = async () => {
      const caseId = searchParams.get('caso') || null
      const res = await fetch('/api/lexia/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      if (res.ok) {
        const { id } = await res.json()
        const q = caseId ? `?caso=${caseId}` : ''
        router.replace(`/lexia/chat/${id}${q}`)
      }
    }

    createAndRedirect()
  }, [router, searchParams])

  return (
    <div className="flex flex-col items-center justify-center min-h-full text-center p-8">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 mb-6">
        <Sparkles className="h-12 w-12 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Cargando conversación...</h2>
      <p className="text-sm text-muted-foreground">
        Se está creando una nueva conversación.
      </p>
    </div>
  )
}
