/**
 * Case Overview Component
 *
 * Displays general information and description of a case.
 * Shows court info, opponent details, and case summary.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Scale,
  User,
  Building2,
  FileText,
  Clock,
  Gavel,
} from 'lucide-react'
import { CaseDescriptionCard } from '@/components/cases/case-description-card'

interface CaseOverviewProps {
  caseData: {
    id?: string
    description?: string | null
    opponent?: string | null
    opponent_lawyer?: string | null
    court?: string | null
    judge?: string | null
    file_number?: string | null
    created_at: string
    updated_at: string
  }
  /** When provided, shows the interactive description card with update button */
  canEdit?: boolean
}

/**
 * Individual info field component for consistent display
 */
function InfoField({ 
  label, 
  value, 
  icon: Icon 
}: { 
  label: string
  value: string | null
  icon?: typeof Scale 
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="text-sm text-foreground pl-6">
        {value || <span className="text-muted-foreground italic">No especificado</span>}
      </p>
    </div>
  )
}

export function CaseOverview({ caseData, canEdit }: CaseOverviewProps) {
  const useInteractiveDescription = caseData.id && canEdit

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Description Card - Full Width */}
      {useInteractiveDescription ? (
        <CaseDescriptionCard
          caseId={caseData.id ?? ''}
          description={caseData.description ?? null}
          canEdit={canEdit}
        />
      ) : (
        <Card className="border-border/60 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Descripción del Caso
            </CardTitle>
          </CardHeader>
          <CardContent>
            {caseData.description ? (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {caseData.description}
              </p>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  No se ha agregado una descripción para este caso
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Agregue una descripción para documentar los detalles del caso
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Court Information */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-muted-foreground" />
            Informacion del Juzgado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoField 
            label="Juzgado / Tribunal" 
            value={caseData.court ?? null}
            icon={Building2}
          />
          <InfoField 
            label="Juez" 
            value={caseData.judge ?? null}
            icon={Gavel}
          />
          <InfoField 
            label="Numero de Expediente" 
            value={caseData.file_number ?? null}
            icon={FileText}
          />
        </CardContent>
      </Card>

      {/* Opponent Information */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" />
            Contraparte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoField 
            label="Nombre / Razon Social" 
            value={caseData.opponent ?? null}
            icon={User}
          />
          <InfoField 
            label="Abogado de Contraparte" 
            value={caseData.opponent_lawyer ?? null}
            icon={Scale}
          />
        </CardContent>
      </Card>

      {/* Timestamps Card */}
      <Card className="border-border/60 lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Registro del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Creado en Sistema
              </p>
              <p className="text-sm font-medium text-foreground">
                {new Date(caseData.created_at).toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(caseData.created_at).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })} hs
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Ultima Modificacion
              </p>
              <p className="text-sm font-medium text-foreground">
                {new Date(caseData.updated_at).toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(caseData.updated_at).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })} hs
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
