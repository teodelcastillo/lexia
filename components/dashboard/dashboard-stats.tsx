import React from "react"
/**
 * Dashboard Statistics Component
 * 
 * Displays key metrics in card format at the top of the dashboard.
 * Shows counts for cases, tasks, deadlines, and documents.
 */
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Briefcase, CheckSquare, Clock, FileText } from 'lucide-react'

/**
 * Stat card configuration type
 */
interface StatCardData {
  title: string
  value: number
  description: string
  icon: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    isPositive: boolean
  }
}

/**
 * Fetches dashboard statistics from the database
 */
async function getStats(): Promise<StatCardData[]> {
  const supabase = await createClient()

  // Fetch counts in parallel for better performance
  const [
    { count: activeCases },
    { count: pendingTasks },
    { count: upcomingDeadlines },
    { count: recentDocuments },
  ] = await Promise.all([
    // Active cases count
    supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'pending']),
    
    // Pending tasks count
    supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'in_progress']),
    
    // Upcoming deadlines (next 7 days)
    supabase
      .from('deadlines')
      .select('*', { count: 'exact', head: true })
      .eq('is_completed', false)
      .gte('due_date', new Date().toISOString().split('T')[0])
      .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    
    // Documents uploaded this month
    supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ])

  return [
    {
      title: 'Casos Activos',
      value: activeCases || 0,
      description: 'Casos en curso',
      icon: Briefcase,
    },
    {
      title: 'Tareas Pendientes',
      value: pendingTasks || 0,
      description: 'Requieren atención',
      icon: CheckSquare,
    },
    {
      title: 'Vencimientos Próximos',
      value: upcomingDeadlines || 0,
      description: 'En los próximos 7 días',
      icon: Clock,
    },
    {
      title: 'Documentos del Mes',
      value: recentDocuments || 0,
      description: 'Subidos este mes',
      icon: FileText,
    },
  ]
}

export async function DashboardStats() {
  const stats = await getStats()

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
