/**
 * Upcoming Deadlines Component
 * 
 * Displays a list of upcoming deadlines and court dates.
 * Highlights urgent items that are due soon.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, Calendar, Clock, AlertTriangle } from 'lucide-react'
import type { DeadlineType } from '@/lib/types'

/**
 * Deadline type configuration
 */
const deadlineTypeConfig: Record<DeadlineType, { label: string; icon: typeof Calendar }> = {
  court_date: { label: 'Audiencia', icon: Calendar },
  filing_deadline: { label: 'Presentación', icon: Clock },
  meeting: { label: 'Reunión', icon: Calendar },
  other: { label: 'Otro', icon: Clock },
}

/**
 * Fetches upcoming deadlines from the database
 */
async function getUpcomingDeadlines() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: deadlines, error } = await supabase
    .from('deadlines')
    .select(`
      id,
      title,
      deadline_type,
      due_date,
      is_completed,
      cases (
        id,
        case_number,
        title
      )
    `)
    .eq('is_completed', false)
    .gte('due_date', today)
    .lte('due_date', twoWeeksFromNow)
    .order('due_date', { ascending: true })
    .limit(5)

  if (error) {
    console.error('Error fetching deadlines:', error)
    return []
  }

  return deadlines
}

/**
 * Calculates days until a deadline
 */
function getDaysUntil(dateString: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(dateString)
  deadline.setHours(0, 0, 0, 0)
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Formats the days until text
 */
function formatDaysUntil(days: number): { text: string; isUrgent: boolean } {
  if (days === 0) return { text: 'Hoy', isUrgent: true }
  if (days === 1) return { text: 'Mañana', isUrgent: true }
  if (days <= 3) return { text: `En ${days} días`, isUrgent: true }
  return { text: `En ${days} días`, isUrgent: false }
}

export async function UpcomingDeadlines() {
  const deadlines = await getUpcomingDeadlines()

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Próximos Vencimientos</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/calendario" className="text-xs">
            Ver calendario
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {deadlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay vencimientos próximos
            </p>
          </div>
        ) : (
          deadlines.map((deadline) => {
            const caseData = deadline.cases as unknown as { id: string; case_number: string; title: string } | null
            const typeConfig = deadlineTypeConfig[deadline.deadline_type as DeadlineType]
            const daysUntil = getDaysUntil(deadline.due_date)
            const { text: daysText, isUrgent } = formatDaysUntil(daysUntil)
            const TypeIcon = typeConfig.icon

            return (
              <div
                key={deadline.id}
                className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
              >
                {/* Date Box */}
                <div className={`flex h-12 w-12 flex-col items-center justify-center rounded-md border ${
                  isUrgent ? 'border-destructive/50 bg-destructive/10' : 'border-border bg-muted/50'
                }`}>
                  <span className={`text-xs font-medium ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {new Date(deadline.due_date).toLocaleDateString('es-AR', { month: 'short' }).toUpperCase()}
                  </span>
                  <span className={`text-lg font-bold ${isUrgent ? 'text-destructive' : 'text-foreground'}`}>
                    {new Date(deadline.due_date).getDate()}
                  </span>
                </div>

                {/* Deadline Info */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5 gap-1 text-[10px]">
                      <TypeIcon className="h-3 w-3" />
                      {typeConfig.label}
                    </Badge>
                    {isUrgent && (
                      <Badge variant="destructive" className="h-5 gap-1 text-[10px]">
                        <AlertTriangle className="h-3 w-3" />
                        {daysText}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-1">
                    {deadline.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {caseData?.case_number} · {caseData?.title}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
