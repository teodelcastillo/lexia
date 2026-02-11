/**
 * Client Cases List
 * 
 * Displays all cases linked to a client with quick access buttons.
 * Shows case status, priority, type, and assigned team members.
 */
'use client'

import React from "react"

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Briefcase, 
  Plus, 
  ArrowRight,
  Calendar,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Pause,
  Archive,
  XCircle,
} from 'lucide-react'
import type { CaseStatus } from '@/lib/types'

interface CaseAssignment {
  user_id: string
  case_role: string
  profiles: {
    first_name: string
    last_name: string
  } | null
}

interface CaseItem {
  id: string
  case_number: string
  title: string
  status: CaseStatus
  case_type: string
  opened_at: string
  case_assignments: CaseAssignment[]
}

interface ClientCasesListProps {
  cases: CaseItem[]
  clientId: string
}

/**
 * Status badge configuration
 */
const statusConfig: Record<CaseStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: React.ComponentType<{ className?: string }> }> = {
  active: { label: 'Activo', variant: 'default', icon: CheckCircle2 },
  pending: { label: 'Pendiente', variant: 'secondary', icon: Clock },
  on_hold: { label: 'En Espera', variant: 'outline', icon: Pause },
  closed: { label: 'Cerrado', variant: 'outline', icon: Archive },
  archived: { label: 'Archivado', variant: 'outline', icon: XCircle },
}


export function ClientCasesList({ cases, clientId }: ClientCasesListProps) {
  if (cases.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Briefcase className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-medium text-foreground">
            Sin casos asociados
          </h3>
          <p className="mt-1 text-sm text-muted-foreground text-center">
            Este cliente no tiene casos registrados todavía.
          </p>
          <Button asChild className="mt-4">
            <Link href={`/casos/nuevo?client_id=${clientId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Crear Nuevo Caso
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with action */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cases.length} {cases.length === 1 ? 'caso encontrado' : 'casos encontrados'}
        </p>
        <Button asChild size="sm">
          <Link href={`/casos/nuevo?client_id=${clientId}`}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Caso
          </Link>
        </Button>
      </div>

      {/* Cases list */}
      <div className="space-y-3">
        {cases.map((caseItem) => {
          const status = statusConfig[caseItem.status]
          const StatusIcon = status.icon
          
          // Get leader name
          const leader = caseItem.case_assignments.find(a => a.case_role === 'leader')
          const leaderName = leader?.profiles 
            ? `${leader.profiles.first_name} ${leader.profiles.last_name}`
            : null

          const openedDate = new Date(caseItem.opened_at).toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })

          return (
            <Link key={caseItem.id} href={`/casos/${caseItem.id}`}>
              <Card className="border-border/60 transition-all hover:border-primary/50 hover:shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Case info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          {caseItem.case_number}
                        </span>
                        <Badge variant={status.variant} className="h-5 text-[10px]">
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                      </div>
                      
                      <h3 className="mt-2 text-sm font-medium text-foreground line-clamp-1">
                        {caseItem.title}
                      </h3>
                      
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {caseItem.case_type}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {openedDate}
                        </span>
                        {leaderName && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {leaderName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow indicator */}
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 shrink-0">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
