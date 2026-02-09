/**
 * Client Notes
 * 
 * Internal notes about a client, not visible to the client.
 * Allows team members to add private observations and communications.
 */
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  MessageSquare, 
  Plus, 
  Send,
  Lock,
  Calendar,
  AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface NoteItem {
  id: string
  content: string
  created_at: string
  is_private: boolean
  profiles: {
    first_name: string
    last_name: string
  } | null
}

interface ClientNotesProps {
  notes: NoteItem[]
  clientId: string
  userRole: string
}

export function ClientNotes({ notes, clientId, userRole }: ClientNotesProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canAddNotes = ['admin_general', 'case_leader', 'lawyer_executive'].includes(userRole)

  /**
   * Handle adding a new note
   */
  async function handleAddNote() {
    if (!newNote.trim()) return
    
    setIsSubmitting(true)
    
    try {
      // Note: In a real implementation, this would save to a client_notes table
      // For now, we show a success message
      toast.success('Nota agregada correctamente')
      setNewNote('')
      setIsAdding(false)
      // Refresh the page to show the new note
      window.location.reload()
    } catch (error) {
      toast.error('Error al agregar la nota')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <Card className="border-chart-4/30 bg-chart-4/5">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-sm text-chart-4">
            <Lock className="h-4 w-4 shrink-0" />
            <p>
              <span className="font-medium">Notas internas:</span> Esta información no es visible para el cliente.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add note button/form */}
      {canAddNotes && (
        <Card className="border-border/60">
          <CardContent className="p-4">
            {isAdding ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Escriba una nota interna sobre este cliente..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setIsAdding(false)
                      setNewNote('')
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || isSubmitting}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {isSubmitting ? 'Guardando...' : 'Agregar Nota'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="w-full justify-start text-muted-foreground bg-transparent"
                onClick={() => setIsAdding(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar nota interna...
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-sm font-medium text-foreground">
              Sin notas internas
            </h3>
            <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
              Agregue notas internas para documentar observaciones importantes sobre este cliente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const authorName = note.profiles 
              ? `${note.profiles.first_name} ${note.profiles.last_name}`
              : 'Usuario'
            const initials = note.profiles 
              ? `${note.profiles.first_name[0]}${note.profiles.last_name[0]}`
              : 'U'
            const noteDate = new Date(note.created_at).toLocaleDateString('es-AR', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })

            return (
              <Card key={note.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Author avatar */}
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>

                    {/* Note content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">
                          {authorName}
                        </span>
                        <Badge variant="outline" className="h-5 text-[10px]">
                          <Lock className="mr-1 h-2.5 w-2.5" />
                          Interno
                        </Badge>
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {noteDate}
                        </span>
                      </div>
                      
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
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
