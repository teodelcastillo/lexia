'use client'

import { RedactorDraftView } from '@/components/lexia/redactor/redactor-draft-view'

interface ContestacionDraftViewProps {
  content: string
  isStreaming?: boolean
  isSaving?: boolean
  onSaveClick?: () => void
}

/**
 * Wrapper around RedactorDraftView for contestación drafts.
 */
export function ContestacionDraftView({
  content,
  isStreaming = false,
  isSaving = false,
  onSaveClick,
}: ContestacionDraftViewProps) {
  return (
    <RedactorDraftView
      documentType="contestacion"
      content={content}
      isStreaming={isStreaming || isSaving}
      onSaveClick={onSaveClick}
    />
  )
}
