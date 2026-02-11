'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, ThumbsUp, ThumbsDown, Sparkles, User, CheckCircle2, Loader2, FileEdit, ListChecks, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { UIMessage } from 'ai'

interface LexiaChatMessageProps {
  message: UIMessage
  onCopy: (content: string) => void
  /** When true and message has no text yet, show animated dots instead of empty */
  isStreaming?: boolean
}

/** Three dots jumping sequentially - used as loading placeholder */
function StreamingDots() {
  return (
    <div className="flex gap-1 py-0.5" aria-hidden="true">
      <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.33s]" />
      <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce [animation-delay:-0.16s]" />
      <span className="h-2 w-2 rounded-full bg-primary/50 animate-bounce" />
    </div>
  )
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

export function LexiaChatMessage({ message, onCopy, isStreaming }: LexiaChatMessageProps) {
  const isUser = message.role === 'user'
  const textContent = getMessageText(message)
  const hasToolParts = message.parts?.some((p) => p.type?.startsWith?.('tool-'))
  const showStreamingDots = !isUser && isStreaming && !textContent && !hasToolParts

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
        {/* Streaming placeholder: dots when no text yet */}
        {showStreamingDots && <StreamingDots />}

        {/* Render text content: markdown+prose for assistant, plain text for user (white for contrast) */}
        {textContent &&
          (isUser ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-white">
              {textContent}
            </div>
          ) : (
            <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:font-semibold prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {textContent}
              </ReactMarkdown>
            </div>
          ))}

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
