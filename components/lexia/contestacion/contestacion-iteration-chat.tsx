'use client'

import { RedactorIterationChat } from '@/components/lexia/redactor/redactor-iteration-chat'

interface ContestacionIterationChatProps {
  onSend: (instruction: string) => void
  isGenerating?: boolean
}

/**
 * Chat for iteration instructions on contestación draft.
 */
export function ContestacionIterationChat({
  onSend,
  isGenerating = false,
}: ContestacionIterationChatProps) {
  return (
    <RedactorIterationChat
      onSend={onSend}
      isGenerating={isGenerating}
      placeholder="Ej: hacelo más formal, agregá este argumento, cambiá la estrategia..."
    />
  )
}
