'use client'

import { MessageSquare, Briefcase, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ConversationListItem } from '@/lib/lexia'

interface LexiaConversationListProps {
  conversations: ConversationListItem[]
  activeId: string | null
  caseFilter: string | null
  isLoading: boolean
  onSelect: (id: string) => void
  onCaseFilterChange: (caseId: string | null) => void
}

export function LexiaConversationList({
  conversations,
  activeId,
  caseFilter,
  isLoading,
  onSelect,
  onCaseFilterChange,
}: LexiaConversationListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MessageSquare className="h-10 w-10 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">Sin conversaciones</p>
        <p className="text-xs text-muted-foreground mt-1">
          Haz clic en &quot;Nueva conversación&quot; para comenzar
        </p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="space-y-1 pr-2">
        {conversations.map((conv) => (
          <button
            key={conv.id}
            type="button"
            onClick={() => onSelect(conv.id)}
            className={cn(
              'w-full flex flex-col items-start gap-0.5 rounded-lg p-2.5 text-left transition-colors',
              'hover:bg-muted/80',
              activeId === conv.id
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="text-sm font-medium truncate w-full">{conv.title}</span>
            <div className="flex items-center gap-2 text-xs">
              {conv.case_number && (
                <span className="flex items-center gap-1 truncate">
                  <Briefcase className="h-3 w-3 flex-shrink-0" />
                  {conv.case_number}
                </span>
              )}
              {conv.last_message_at && (
                <span>
                  {formatDistanceToNow(new Date(conv.last_message_at), {
                    addSuffix: true,
                    locale: es,
                  })}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}
