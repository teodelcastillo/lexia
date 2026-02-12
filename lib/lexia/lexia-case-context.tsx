'use client'

import { createContext, useContext } from 'react'

export interface CaseContextValue {
  id: string
  caseNumber: string
  title: string
}

const LexiaCaseContext = createContext<CaseContextValue | null>(null)

export function LexiaCaseProvider({
  value,
  children,
}: {
  value: CaseContextValue | null
  children: React.ReactNode
}) {
  return (
    <LexiaCaseContext.Provider value={value}>
      {children}
    </LexiaCaseContext.Provider>
  )
}

export function useLexiaCaseContext() {
  return useContext(LexiaCaseContext)
}
