'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LexiaChatSidebar } from './lexia-chat-sidebar'
import { LexiaCaseProvider } from '@/lib/lexia/lexia-case-context'

interface CaseContext {
  id: string
  caseNumber: string
  title: string
}

export function LexiaChatLayoutClient({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('caso')
  const [caseContext, setCaseContext] = useState<CaseContext | null>(null)
  const [isLoadingContext, setIsLoadingContext] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!caseId) {
      setCaseContext(null)
      return
    }
    setIsLoadingContext(true)
    supabase
      .from('cases')
      .select('id, case_number, title')
      .eq('id', caseId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setCaseContext({
            id: data.id,
            caseNumber: data.case_number,
            title: data.title,
          })
        } else {
          setCaseContext(null)
        }
      })
      .then(() => setIsLoadingContext(false), () => setIsLoadingContext(false))
  }, [caseId, supabase])

  return (
    <LexiaCaseProvider value={caseContext}>
      <div className="flex h-full min-h-0 overflow-hidden">
        <LexiaChatSidebar caseContext={caseContext} />
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col min-w-0">
          {children}
        </main>
      </div>
    </LexiaCaseProvider>
  )
}
