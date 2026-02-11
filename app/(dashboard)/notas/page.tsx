/**
 * Internal Notes Page
 * 
 * Internal communication hub for case notes and team discussions.
 * Notes can be linked to cases or be general internal memos.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MessageSquare,
  Plus,
  Search,
  Briefcase,
  Pin,
  MoreHorizontal,
  Filter,
} from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

export const metadata = {
  title: 'Notas Internas',
  description: 'Comunicación interna y notas de casos',
}

interface NotesPageProps {
  searchParams:{
    case_id?: string
    search?: string
    pinned?: string
  }
}

/** Gets user initials for avatar */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

/** Formats date relative to now */
function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`
  
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  })
}

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const supabase = await createClient()
  const params = searchParams
  
  // Validate user access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  // Build query with filters
  let query = supabase
    .from('case_notes')
    .select(`
      *,
      case:cases(id, case_number, title),
      created_by_user:profiles!case_notes_created_by_fkey(id, first_name, last_name, avatar_url)
    `)
    .order('created_at', { ascending: false })

  if (params.case_id && params.case_id !== 'all') {
    query = query.eq('case_id', params.case_id)
  }

  if (params.search) {
    query = query.or(`note_text.ilike.%${params.search}%`)
  }

  if (params.pinned === 'true') {
    query = query.eq('is_pinned', true)
  }

  const { data: notes } = await query.limit(50)

  // Fetch cases for filter dropdown
  const { data: cases } = await supabase
    .from('cases')
    .select('id, case_number, title')
    .order('case_number', { ascending: false })

  // Get pinned notes count
  const { count: pinnedCount } = await supabase
    .from('case_notes')
    .select('*', { count: 'exact', head: true })
    .eq('is_pinned', true)

  return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Notas Internas
            </h1>
            <p className="text-sm text-muted-foreground">
              Comunicación interna y notas de casos
            </p>
          </div>
          
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Nota
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar en notas..."
                  className="pl-9"
                  defaultValue={params.search}
                />
              </div>
              
              <Select defaultValue={params.case_id || 'all'}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filtrar por caso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los casos</SelectItem>
                  {cases?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_number} - {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                variant={params.pinned === 'true' ? 'secondary' : 'outline'}
                size="sm"
                className="gap-2"
              >
                <Pin className="h-4 w-4" />
                Fijadas ({pinnedCount || 0})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notes List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes && notes.length > 0 ? (
            notes.map((note) => (
              <Card 
                key={note.id} 
                className={`
                  hover:shadow-md transition-shadow
                  ${note.is_pinned ? 'border-primary/50 bg-primary/5' : ''}
                `}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage 
                          src={note.created_by_user?.avatar_url || undefined} 
                          alt={note.created_by_user?.first_name || 'Usuario'} 
                        />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {note.created_by_user 
                            ? getInitials(note.created_by_user.first_name, note.created_by_user.last_name)
                            : 'U'
                          }
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {note.created_by_user 
                            ? `${note.created_by_user.first_name} ${note.created_by_user.last_name}`
                            : 'Usuario'
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeDate(note.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {note.is_pinned && (
                        <Pin className="h-4 w-4 text-primary" />
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Más opciones</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Note content */}
                  <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">
                    {note.note_text}
                  </p>

                  {/* Case link */}
                  {note.case && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <Link 
                        href={`/casos/${note.case.id}`}
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Briefcase className="h-3.5 w-3.5" />
                        <span className="font-medium">{note.case.case_number}</span>
                        <span className="truncate">{note.case.title}</span>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No hay notas</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Las notas internas aparecerán aquí
                </p>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear primera nota
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
  )
}
