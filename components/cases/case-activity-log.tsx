/**
 * Case Activity Log Component
 * 
 * Displays a chronological log of all activities on a case.
 * Shows document uploads, task updates, status changes, and more.
 */
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  FileText,
  CheckSquare,
  UserPlus,
  Edit,
  MessageSquare,
  Calendar,
  AlertTriangle,
  Activity,
  Clock,
} from 'lucide-react'
import type { ActivityAction } from '@/lib/types'

interface CaseActivityLogProps {
  /** The case ID to fetch activity for */
  caseId: string
}

/**
 * Activity action configuration with icons and labels
 */
const actionConfig: Record<ActivityAction, { 
  label: string
  icon: typeof Activity
  color: string 
}> = {
  created: { 
    label: 'creo', 
    icon: Activity,
    color: 'text-success'
  },
  updated: { 
    label: 'actualizo', 
    icon: Edit,
    color: 'text-primary'
  },
  deleted: { 
    label: 'elimino', 
    icon: AlertTriangle,
    color: 'text-destructive'
  },
  status_changed: { 
    label: 'cambio el estado de', 
    icon: Activity,
    color: 'text-chart-2'
  },
  assigned: { 
    label: 'asigno', 
    icon: UserPlus,
    color: 'text-chart-3'
  },
  commented: { 
    label: 'comento en', 
    icon: MessageSquare,
    color: 'text-muted-foreground'
  },
}

/**
 * Entity type labels for display
 */
const entityLabels: Record<string, { singular: string; icon: typeof Activity }> = {
  case: { singular: 'el caso', icon: Activity },
  task: { singular: 'la tarea', icon: CheckSquare },
  document: { singular: 'el documento', icon: FileText },
  deadline: { singular: 'el vencimiento', icon: Calendar },
  note: { singular: 'la nota', icon: MessageSquare },
  assignment: { singular: 'la asignacion', icon: UserPlus },
}

/**
 * Activity log entry interface
 */
interface ActivityEntry {
  id: string
  action_type: ActivityAction
  entity_type: string
  entity_id: string
  description: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
  profiles: {
    id: string
    first_name: string
    last_name: string
  } | null
}

/**
 * Fetches activity log for a case
 */
async function getCaseActivityLog(caseId: string): Promise<ActivityEntry[]> {
  const supabase = await createClient()

  const { data: activities, error } = await supabase
    .from('activity_log')
    .select(`
      id,
      action_type,
      entity_type,
      entity_id,
      description,
      old_values,
      new_values,
      created_at,
      profiles:user_id (
        id,
        first_name,
        last_name
      )
    `)
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Error fetching activity log:', error)
    return []
  }

  const raw = activities ?? []
  const normalized = raw.map((row: (typeof raw)[number]) => {
    const p = row.profiles
    const profile = Array.isArray(p) ? p[0] ?? null : p ?? null
    return { ...row, profiles: profile }
  })
  return normalized as unknown as ActivityEntry[]
}

/**
 * Gets initials from a name
 */
function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

/**
 * Formats the activity description based on action and entity
 */
function formatActivityDescription(entry: ActivityEntry): string {
  // If there's a custom description, use it
  if (entry.description) return entry.description

  const action = actionConfig[entry.action_type]
  const entity = entityLabels[entry.entity_type]
  const newValues = entry.new_values as Record<string, string> | null

  let desc = `${action?.label || entry.action_type} ${entity?.singular || entry.entity_type}`

  if (newValues?.name || newValues?.title) {
    desc += ` "${newValues.name || newValues.title}"`
  }

  if (entry.action_type === 'status_changed' && entry.old_values && newValues) {
    const from = (entry.old_values as Record<string, string>).status
    const to = newValues.status
    if (from && to) desc += ` de "${from}" a "${to}"`
  }

  return desc
}

/**
 * Groups activities by date for display
 */
function groupActivitiesByDate(activities: ActivityEntry[]): Map<string, ActivityEntry[]> {
  const grouped = new Map<string, ActivityEntry[]>()

  for (const activity of activities) {
    const date = new Date(activity.created_at)
    const key = date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key)?.push(activity)
  }

  return grouped
}

/**
 * Checks if date is today
 */
function isToday(dateString: string): boolean {
  const today = new Date()
  const date = new Date(dateString)
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

/**
 * Checks if date is yesterday
 */
function isYesterday(dateString: string): boolean {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const date = new Date(dateString)
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  )
}

export async function CaseActivityLog({ caseId }: CaseActivityLogProps) {
  const activities = await getCaseActivityLog(caseId)
  const groupedActivities = groupActivitiesByDate(activities)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">
          Actividad Reciente
        </h3>
        <Badge variant="outline" className="text-xs">
          Ultimos 50 eventos
        </Badge>
      </div>

      {activities.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay actividad registrada para este caso
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedActivities.entries()).map(([dateKey, dateActivities]) => {
            // Check if this is today or yesterday for special labels
            const firstActivity = dateActivities[0]
            let dateLabel = dateKey
            if (isToday(firstActivity.created_at)) {
              dateLabel = 'Hoy'
            } else if (isYesterday(firstActivity.created_at)) {
              dateLabel = 'Ayer'
            }

            return (
              <Card key={dateKey} className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {dateLabel}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dateActivities.map((activity) => {
                    const profile = activity.profiles
                    const action = actionConfig[activity.action_type]
                    const entity = entityLabels[activity.entity_type]
                    const ActionIcon = action?.icon || Activity
                    const EntityIcon = entity?.icon || Activity

                    return (
                      <div 
                        key={activity.id} 
                        className="flex items-start gap-3"
                      >
                        {/* User Avatar */}
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {profile ? getInitials(profile.first_name, profile.last_name) : '??'}
                          </AvatarFallback>
                        </Avatar>

                        {/* Activity Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1 text-sm">
                            <span className="font-medium text-foreground">
                              {profile ? `${profile.first_name} ${profile.last_name}` : 'Usuario'}
                            </span>
                            <span className="text-muted-foreground">
                              {formatActivityDescription(activity)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(activity.created_at).toLocaleTimeString('es-AR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            <Badge variant="outline" className="h-5 gap-1 text-[10px]">
                              <EntityIcon className="h-3 w-3" />
                              {entity?.singular.replace('el ', '').replace('la ', '') || activity.entity_type}
                            </Badge>
                          </div>
                        </div>

                        {/* Action Icon */}
                        <div className={`shrink-0 ${action?.color || 'text-muted-foreground'}`}>
                          <ActionIcon className="h-4 w-4" />
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
