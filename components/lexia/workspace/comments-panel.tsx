'use client'

/**
 * Comments panel — threaded comments for the current document.
 *
 * Layout: side sheet with a list of threads (unresolved first). Each thread
 * shows the root comment, the replies, and a compose area. Clicking a thread
 * asks the parent to scroll the editor to the corresponding commentThread
 * mark.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Check,
  Trash2,
  ChevronRight,
  X,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface CommentDTO {
  id: string
  documentId: string
  authorId: string
  authorName: string | null
  parentId: string | null
  threadId: string
  selectionFrom: number | null
  selectionTo: number | null
  selectionText: string | null
  content: string
  versionAtCreation: number | null
  resolvedAt: string | null
  resolvedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CommentThread {
  root: CommentDTO
  replies: CommentDTO[]
  resolved: boolean
}

interface CommentsPanelProps {
  open: boolean
  onClose: () => void
  documentId: string
  currentUserId: string
  /** Selection the user has right now in the editor, for the quick-comment box. */
  currentSelection: { from: number; to: number; text: string } | null
  /** Called when a new thread is created — parent should apply the mark. */
  onThreadCreated: (threadId: string, from: number, to: number) => void
  /** Called when a thread is resolved — parent may remove the mark. */
  onThreadResolved: (threadId: string) => void
  /** Scroll to the thread's anchor in the editor. */
  onFocusThread: (threadId: string) => void
  /** Increments to force a reload (e.g. after navigation). */
  reloadKey?: number
}

export function CommentsPanel(props: CommentsPanelProps) {
  const {
    open,
    onClose,
    documentId,
    currentUserId,
    currentSelection,
    onThreadCreated,
    onThreadResolved,
    onFocusThread,
    reloadKey,
  } = props

  const [threads, setThreads] = useState<CommentThread[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'mine'>('unresolved')

  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)

  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({})

  const loadThreads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/lexia/documents/${documentId}/comments`, {
        cache: 'no-store',
      })
      if (!res.ok) return
      const data = (await res.json()) as { threads: CommentThread[] }
      setThreads(data.threads ?? [])
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    if (open) void loadThreads()
  }, [open, reloadKey, loadThreads])

  const filtered = useMemo(() => {
    if (filter === 'all') return threads
    if (filter === 'unresolved') return threads.filter((t) => !t.resolved)
    return threads.filter(
      (t) => t.root.authorId === currentUserId || t.replies.some((r) => r.authorId === currentUserId)
    )
  }, [threads, filter, currentUserId])

  const createThread = useCallback(async () => {
    const content = newComment.trim()
    if (!content) return
    setPosting(true)
    try {
      const res = await fetch(`/api/lexia/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          selection: currentSelection
            ? {
                from: currentSelection.from,
                to: currentSelection.to,
                text: currentSelection.text,
              }
            : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? 'No se pudo crear el comentario')
        return
      }
      const data = (await res.json()) as { comment: CommentDTO }
      setNewComment('')
      await loadThreads()
      if (
        data.comment.selectionFrom != null &&
        data.comment.selectionTo != null
      ) {
        onThreadCreated(
          data.comment.threadId,
          data.comment.selectionFrom,
          data.comment.selectionTo
        )
      }
      toast.success('Comentario creado')
    } finally {
      setPosting(false)
    }
  }, [newComment, currentSelection, documentId, loadThreads, onThreadCreated])

  const sendReply = useCallback(
    async (thread: CommentThread) => {
      const draft = replyDraft[thread.root.id]?.trim()
      if (!draft) return
      const res = await fetch(`/api/lexia/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft, parentId: thread.root.id }),
      })
      if (!res.ok) {
        toast.error('No se pudo responder')
        return
      }
      setReplyDraft((prev) => ({ ...prev, [thread.root.id]: '' }))
      await loadThreads()
    },
    [replyDraft, documentId, loadThreads]
  )

  const toggleResolved = useCallback(
    async (thread: CommentThread) => {
      const res = await fetch(
        `/api/lexia/documents/${documentId}/comments/${thread.root.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resolved: !thread.resolved }),
        }
      )
      if (!res.ok) {
        toast.error('No se pudo actualizar')
        return
      }
      await loadThreads()
      if (!thread.resolved) {
        onThreadResolved(thread.root.threadId)
      }
    },
    [documentId, loadThreads, onThreadResolved]
  )

  const deleteComment = useCallback(
    async (comment: CommentDTO) => {
      const res = await fetch(
        `/api/lexia/documents/${documentId}/comments/${comment.id}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        toast.error('No se pudo eliminar')
        return
      }
      await loadThreads()
    },
    [documentId, loadThreads]
  )

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Comentarios
          </SheetTitle>
          <SheetDescription>
            Revisa o agrega comentarios anclados a una seleccion del documento.
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 py-3 border-b bg-muted/30 space-y-3">
          <div className="flex gap-1.5 items-center text-xs">
            {(['unresolved', 'all', 'mine'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-2 py-1 rounded-full border',
                  filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'
                )}
              >
                {f === 'unresolved' ? 'Sin resolver' : f === 'all' ? 'Todos' : 'Mios'}
              </button>
            ))}
          </div>
          {currentSelection && currentSelection.text.trim() && (
            <div className="text-[11px] text-muted-foreground">
              Comentar sobre: <span className="italic">&quot;{currentSelection.text.slice(0, 120)}{currentSelection.text.length > 120 ? '…' : ''}&quot;</span>
            </div>
          )}
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={currentSelection && currentSelection.text ? 'Comentario sobre la seleccion…' : 'Comentario de documento…'}
            className="min-h-[64px] text-sm"
          />
          <div className="flex items-center justify-end">
            <Button
              size="sm"
              onClick={createThread}
              disabled={posting || newComment.trim().length === 0}
            >
              {posting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <MessageSquarePlus className="h-3.5 w-3.5 mr-1" />
              )}
              Publicar
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin mb-2" /> Cargando…
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p>No hay comentarios en este filtro.</p>
            </div>
          ) : (
            filtered.map((thread) => (
              <article
                key={thread.root.id}
                className={cn(
                  'px-5 py-4 border-b',
                  thread.resolved && 'opacity-60'
                )}
              >
                {thread.root.selectionText && (
                  <button
                    onClick={() => onFocusThread(thread.root.threadId)}
                    className="w-full text-left text-[11px] px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-900 italic mb-2 flex items-center gap-1 hover:bg-amber-100 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200"
                  >
                    <ChevronRight className="h-3 w-3" />
                    &quot;{thread.root.selectionText.slice(0, 90)}
                    {thread.root.selectionText.length > 90 ? '…' : ''}&quot;
                  </button>
                )}
                <CommentRow
                  comment={thread.root}
                  isOwner={thread.root.authorId === currentUserId}
                  onDelete={() => deleteComment(thread.root)}
                />
                {thread.replies.map((reply) => (
                  <div key={reply.id} className="ml-5 mt-2 border-l pl-3">
                    <CommentRow
                      comment={reply}
                      isOwner={reply.authorId === currentUserId}
                      onDelete={() => deleteComment(reply)}
                    />
                  </div>
                ))}
                <div className="mt-3 flex items-start gap-2">
                  <Textarea
                    value={replyDraft[thread.root.id] ?? ''}
                    onChange={(e) =>
                      setReplyDraft((prev) => ({
                        ...prev,
                        [thread.root.id]: e.target.value,
                      }))
                    }
                    placeholder="Responder…"
                    className="min-h-[40px] text-xs"
                  />
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => sendReply(thread)}>
                      Responder
                    </Button>
                    <Button
                      size="sm"
                      variant={thread.resolved ? 'outline' : 'default'}
                      onClick={() => toggleResolved(thread)}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {thread.resolved ? 'Reabrir' : 'Resolver'}
                    </Button>
                  </div>
                </div>
                {thread.root.versionAtCreation != null && (
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    creado en v{thread.root.versionAtCreation}
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        <div className="border-t px-5 py-3 flex items-center justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-3.5 w-3.5 mr-1" /> Cerrar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CommentRow({
  comment,
  isOwner,
  onDelete,
}: {
  comment: CommentDTO
  isOwner: boolean
  onDelete: () => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{comment.authorName ?? 'Usuario'}</span>
        <span>{new Date(comment.createdAt).toLocaleString('es-AR')}</span>
        {isOwner && (
          <button
            onClick={onDelete}
            className="ml-auto text-muted-foreground hover:text-red-600"
            title="Eliminar"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
    </div>
  )
}
