'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LexiaSidebar } from './lexia-sidebar'

interface CaseContext {
  id: string
  caseNumber: string
  title: string
}

export function LexiaLayoutClient({ children }: { children: React.ReactNode }) {
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
      .finally(() => setIsLoadingContext(false))
  }, [caseId, supabase])

  return (
    <div className="flex h-full min-h-[calc(100vh-7rem)] overflow-hidden">
      <LexiaSidebar caseContext={caseContext} />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
