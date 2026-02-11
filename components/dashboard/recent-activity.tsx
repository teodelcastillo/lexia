/**
 * Recent Activity Component
 * 
 * Displays a timeline of recent actions in the system.
 */
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Activity, 
  Briefcase, 
  Users, 
  CheckSquare, 
  FileText, 
  Calendar,
  MessageSquare 
} from 'lucide-react'
import type { ActivityEntityType } from '@/lib/types'

/**
 * Entity type icons
 */
const entityIcons: Record<ActivityEntityType, typeof Activity> = {
  case: Briefcase,
  client: Users,
  task: CheckSquare,
  document: FileText,
  deadline: Calendar,
  note: MessageSquare,
}

/**
 * Entity type labels in Spanish
 */
const entityLabels: Record<ActivityEntityType, string> = {
  case: 'caso',
  client: 'cliente',
  task: 'tarea',
  document: 'documento',
  deadline: 'vencimiento',
  note: 'nota',
}

/**
 * Fetches recent activity from the database
 */
async function getRecentActivity() {
  const supabase = await createClient()

  const { data: activities, error } = await supabase
    .from('activity_log')
    .select(`
      id,
      entity_type,
      entity_id,
      action_type,
      description,
      created_at,
      profiles (
        id,
        first_name,
        last_name
      )
    `)
    .order('created_at', { ascending: false })
    .limit(8)

  if (error) {
    console.error('Error fetching activity:', error)
    return []
  }

  return activities
}

/**
 * Formats activity text based on action
 */
function formatAction(action: string): string {
  const actionLabels: Record<string, string> = {
    created: 'creó',
    updated: 'actualizó',
    deleted: 'eliminó',
    completed: 'completó',
    assigned: 'asignó',
    uploaded: 'subió',
    commented: 'comentó en',
  }
  return actionLabels[action] || action
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

  if (diffMins < 1) return 'Ahora mismo'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} días`

  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

/**
 * Gets user initials for avatar
 */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export async function RecentActivity() {
  const activities = await getRecentActivity()

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Actividad Reciente</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay actividad reciente
            </p>
          </div>
        ) : (
          <div className="relative space-y-4">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 h-[calc(100%-16px)] w-px bg-border" />

            {activities.map((activity) => {
              const profile = activity.profiles as unknown as { id: string; first_name: string; last_name: string } | null
              const EntityIcon = entityIcons[activity.entity_type as ActivityEntityType] || Activity
              const entityLabel = entityLabels[activity.entity_type as ActivityEntityType] || activity.entity_type

              return (
                <div key={activity.id} className="relative flex gap-3 pl-2">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-border">
                    <EntityIcon className="h-3 w-3 text-muted-foreground" />
                  </div>

                  {/* Activity content */}
                  <div className="flex-1 space-y-1 pb-4">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                          {profile ? getInitials(profile.first_name, profile.last_name) : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">
                        {profile ? `${profile.first_name} ${profile.last_name}` : 'Usuario'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(activity.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {activity.description 
                        ? activity.description
                        : `${formatAction(activity.action_type)} un ${entityLabel}`
                      }
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
