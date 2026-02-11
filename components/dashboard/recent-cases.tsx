/**
 * Recent Cases Component
 * 
 * Displays a list of recently updated cases on the dashboard.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, Briefcase } from 'lucide-react'
import type { CaseStatus } from '@/lib/types'

/**
 * Status badge configuration
 */
const statusConfig: Record<CaseStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Activo', variant: 'default' },
  pending: { label: 'Pendiente', variant: 'secondary' },
  on_hold: { label: 'En Espera', variant: 'outline' },
  closed: { label: 'Cerrado', variant: 'secondary' },
  archived: { label: 'Archivado', variant: 'outline' },
}

/**
 * Fetches recent cases from the database
 */
async function getRecentCases() {
  const supabase = await createClient()

  const { data: cases, error } = await supabase
    .from('cases')
    .select(`
      id,
      case_number,
      title,
      status,
      updated_at,
      companies (
        id,
        company_name,
        name
      )
    `)
    .order('updated_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching recent cases:', error)
    return []
  }

  return cases
}

/**
 * Formats a date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} días`

  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  })
}

export async function RecentCases() {
  const cases = await getRecentCases()

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Casos Recientes</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/casos" className="text-xs">
            Ver todos
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Briefcase className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No hay casos recientes</p>
          </div>
        ) : (
          cases.map((caseItem) => {
            const company = caseItem.companies as unknown as { id: string; company_name: string | null; name: string | null } | null
            const status = statusConfig[caseItem.status as CaseStatus]
            
            return (
              <Link
                key={caseItem.id}
                href={`/casos/${caseItem.id}`}
                className="flex items-start gap-3 rounded-md p-2 transition-colors hover:bg-muted/50"
              >
                {/* Case Info */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {caseItem.case_number}
                    </span>
                    <Badge variant={status.variant} className="h-5 text-[10px]">
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-1">
                    {caseItem.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {company?.company_name || company?.name || 'Sin empresa'} · {formatDate(caseItem.updated_at)}
                  </p>
                </div>
              </Link>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
