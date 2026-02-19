'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  MessageSquare,
  Send,
  Loader2,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface TaskComment {
  id: string
  task_id: string
  content: string
  created_at: string
  updated_at: string
  profiles: {
    id: string
    first_name: string
    last_name: string
  } | null
}

interface TaskCommentsProps {
  taskId: string
  currentUserId: string
  canComment: boolean
  initialComments: TaskComment[]
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`

  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

export function TaskComments({
  taskId,
  currentUserId,
  canComment,
  initialComments,
}: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>(initialComments)
  const [newComment, setNewComment] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleAddComment() {
    if (!newComment.trim()) return
    setIsAdding(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          created_by: currentUserId,
          content: newComment.trim(),
        })
        .select(`
          id,
          task_id,
          content,
          created_at,
          updated_at,
          profiles:created_by (
            id,
            first_name,
            last_name
          )
        `)
        .single()

      if (error) throw error

      setComments((prev) => [data as unknown as TaskComment, ...prev])
      setNewComment('')
      toast.success('Comentario agregado')
    } catch (error) {
      console.error('Error adding task comment:', error)
      toast.error('No se pudo agregar el comentario')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleDeleteComment(commentId: string) {
    startTransition(async () => {
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from('task_comments')
          .delete()
          .eq('id', commentId)

        if (error) throw error

        setComments((prev) => prev.filter((c) => c.id !== commentId))
        toast.success('Comentario eliminado')
      } catch (error) {
        console.error('Error deleting task comment:', error)
        toast.error('No se pudo eliminar el comentario')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Comentarios</h3>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {comments.length}
        </Badge>
      </div>

      {canComment && (
        <Card className="border-border/60">
          <CardContent className="p-3 space-y-3">
            <Textarea
              placeholder="Escriba un comentario sobre esta tarea..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[84px] resize-none"
              disabled={isAdding}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={!newComment.trim() || isAdding}
              >
                {isAdding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Comentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {comments.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Sin comentarios todavía.
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const profile = comment.profiles
            const isAuthor = profile?.id === currentUserId
            return (
              <Card key={comment.id} className="border-border/60">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                        {profile ? getInitials(profile.first_name, profile.last_name) : '??'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">
                            {profile ? `${profile.first_name} ${profile.last_name}` : 'Usuario'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(comment.created_at)}
                          </span>
                        </div>

                        {isAuthor && canComment && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={isPending}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Opciones</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      <p className="mt-1.5 text-sm whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
