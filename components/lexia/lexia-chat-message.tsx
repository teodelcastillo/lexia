'use client'

import { Copy, ThumbsUp, ThumbsDown, Sparkles, User, CheckCircle2, Loader2, FileEdit, ListChecks, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UIMessage } from 'ai'

interface LexiaChatMessageProps {
  message: UIMessage
  onCopy: (content: string) => void
}

/** Extract text content from UIMessage parts */
function getMessageText(message: UIMessage): string {
  if (!message.parts || !Array.isArray(message.parts)) return ''
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

/** Render tool invocation states */
function renderToolPart(part: UIMessage['parts'][number], index: number) {
  if (part.type === 'text') return null
  
  // Handle tool invocations
  if (part.type.startsWith('tool-')) {
    const toolState = (part as { state?: string }).state
    const toolOutput = (part as { output?: { message?: string } }).output
    
    if (toolState === 'input-available' || toolState === 'input-streaming') {
      return (
        <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 my-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Procesando...</span>
        </div>
      )
    }
    
    if (toolState === 'output-available' && toolOutput?.message) {
      let Icon = CheckCircle2
      if (part.type.includes('Draft')) Icon = FileEdit
      if (part.type.includes('Checklist')) Icon = ListChecks
      if (part.type.includes('Deadline')) Icon = Calendar
      
      return (
        <div key={index} className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg p-3 my-2">
          <Icon className="h-4 w-4" />
          <span>{toolOutput.message}</span>
        </div>
      )
    }
  }
  
  return null
}

export function LexiaChatMessage({ message, onCopy }: LexiaChatMessageProps) {
  const isUser = message.role === 'user'
  const textContent = getMessageText(message)

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
      )}

      <div
        className={`
          max-w-[85%] rounded-lg p-4
          ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}
        `}
      >
        {/* Render text content */}
        {textContent && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
            {textContent}
          </div>
        )}

        {/* Render tool invocations */}
        {message.parts?.map((part, index) => renderToolPart(part, index))}

        {/* Actions for assistant messages */}
        {!isUser && textContent && (
          <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => onCopy(textContent)}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ThumbsDown className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted flex-shrink-0">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
