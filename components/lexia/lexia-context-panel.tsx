'use client'

import { Briefcase, FileText, StickyNote, X, Loader2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

interface CaseContext {
  id: string
  caseNumber: string
  title: string
  type: string
  status: string
  company?: string
  documentsCount: number
  notesCount: number
}

interface LexiaContextPanelProps {
  context: CaseContext
  isLoading: boolean
  onClear: () => void
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Activo', variant: 'default' },
  pending: { label: 'Pendiente', variant: 'secondary' },
  on_hold: { label: 'En Espera', variant: 'outline' },
  closed: { label: 'Cerrado', variant: 'secondary' },
  archived: { label: 'Archivado', variant: 'outline' },
}

const typeLabels: Record<string, string> = {
  civil: 'Civil',
  laboral: 'Laboral',
  penal: 'Penal',
  familia: 'Familia',
  comercial: 'Comercial',
  administrativo: 'Administrativo',
  general: 'General',
}

export function LexiaContextPanel({ context, isLoading, onClear }: LexiaContextPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const statusConfig = statusLabels[context.status] || { label: context.status, variant: 'outline' as const }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Contexto Activo
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium">{context.caseNumber}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{context.title}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant={statusConfig.variant} className="text-xs">
            {statusConfig.label}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {typeLabels[context.type] || context.type}
          </Badge>
        </div>

        {context.company && (
          <p className="text-xs text-muted-foreground">
            Cliente: {context.company}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {context.documentsCount} docs
          </span>
          <span className="flex items-center gap-1">
            <StickyNote className="h-3 w-3" />
            {context.notesCount} notas
          </span>
        </div>

        <Button variant="outline" size="sm" className="w-full text-xs bg-transparent" asChild>
          <Link href={`/casos/${context.id}`}>
            <ExternalLink className="mr-2 h-3 w-3" />
            Ver Caso
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
