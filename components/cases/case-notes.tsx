/**
 * Case Notes Component
 * 
 * Displays and manages internal notes for a case.
 * These notes are only visible to internal users, not clients.
 */
'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  MessageSquare, 
  Lock,
  Send,
  Loader2,
  MoreHorizontal,
  Trash2,
  Edit,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface CaseNotesProps {
  /** The case ID to fetch and add notes for */
  caseId: string
  /** Initial notes data */
  initialNotes: CaseNote[]
  /** Current user ID */
  currentUserId: string
  /** Whether the user can add/edit notes */
  canEdit: boolean
}

/**
 * Case note interface
 */
interface CaseNote {
  id: string
  content: string
  is_visible_to_client: boolean
  created_at: string
  updated_at: string
  profiles: {
    id: string
    first_name: string
    last_name: string
  } | null
}

/**
 * Gets initials from a name
 */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

/**
 * Formats relative time
 */
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

export function CaseNotes({ 
  caseId, 
  initialNotes, 
  currentUserId, 
  canEdit 
}: CaseNotesProps) {
  const [notes, setNotes] = useState<CaseNote[]>(initialNotes)
  const [newNote, setNewNote] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isPending, startTransition] = useTransition()

  /**
   * Handles adding a new note
   */
  async function handleAddNote() {
    if (!newNote.trim()) return

    setIsAdding(true)

    try {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('case_notes')
        .insert({
          case_id: caseId,
          content: newNote.trim(),
          created_by: currentUserId,
          is_visible_to_client: false, // Internal notes not visible to clients
        })
        .select(`
          id,
          content,
          is_visible_to_client,
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

      // Add to local state
      setNotes(prev => [data as CaseNote, ...prev])
      setNewNote('')
      toast.success('Nota agregada')
    } catch (error) {
      console.error('Error adding note:', error)
      toast.error('Error al agregar la nota')
    } finally {
      setIsAdding(false)
    }
  }

  /**
   * Handles deleting a note
   */
  async function handleDeleteNote(noteId: string) {
    startTransition(async () => {
      try {
        const supabase = createClient()

        const { error } = await supabase
          .from('case_notes')
          .delete()
          .eq('id', noteId)

        if (error) throw error

        // Remove from local state
        setNotes(prev => prev.filter(n => n.id !== noteId))
        toast.success('Nota eliminada')
      } catch (error) {
        console.error('Error deleting note:', error)
        toast.error('Error al eliminar la nota')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium text-foreground">
            Notas Internas
          </h3>
          <Badge variant="outline" className="gap-1 text-xs">
            <Lock className="h-3 w-3" />
            Solo equipo
          </Badge>
        </div>
        <span className="text-sm text-muted-foreground">
          {notes.length} {notes.length === 1 ? 'nota' : 'notas'}
        </span>
      </div>

      {/* Add Note Form */}
      {canEdit && (
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="space-y-3">
              <Textarea
                placeholder="Escribe una nota interna sobre este caso..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[100px] resize-none"
                disabled={isAdding}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Las notas internas no son visibles para el cliente
                </p>
                <Button 
                  size="sm" 
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || isAdding}
                >
                  {isAdding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Agregar Nota
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay notas para este caso
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Las notas internas ayudan a documentar el progreso del caso
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => {
            const profile = note.profiles
            const isAuthor = profile?.id === currentUserId

            return (
              <Card key={note.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Author Avatar */}
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {profile ? getInitials(profile.first_name, profile.last_name) : '??'}
                      </AvatarFallback>
                    </Avatar>

                    {/* Note Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {profile ? `${profile.first_name} ${profile.last_name}` : 'Usuario'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(note.created_at)}
                          </span>
                          {note.created_at !== note.updated_at && (
                            <Badge variant="outline" className="h-5 text-[10px]">
                              editado
                            </Badge>
                          )}
                        </div>

                        {/* Actions */}
                        {isAuthor && canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 shrink-0"
                                disabled={isPending}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Opciones</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleDeleteNote(note.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {/* Note Text */}
                      <p className="mt-2 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {note.content}
                      </p>
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
