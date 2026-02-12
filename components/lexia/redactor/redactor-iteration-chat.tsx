'use client'

import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface RedactorIterationChatProps {
  onSend: (instruction: string) => void
  isGenerating?: boolean
  placeholder?: string
}

export function RedactorIterationChat({
  onSend,
  isGenerating = false,
  placeholder = 'Ej: "hacelo más formal", "agregá este argumento", "cambiá la estrategia a..."',
}: RedactorIterationChatProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isGenerating) return
    onSend(trimmed)
    setInput('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        disabled={isGenerating}
        className="min-h-[44px] resize-none flex-1"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
          }
        }}
      />
      <Button type="submit" size="icon" disabled={!input.trim() || isGenerating} className="h-11 w-11 shrink-0">
        {isGenerating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </form>
  )
}
