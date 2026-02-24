'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  RefreshCw,
  Loader2,
  Clock,
  FileText,
  AlertTriangle,
  Link2,
  CalendarPlus,
  Inbox,
} from 'lucide-react'
import { toast } from 'sonner'
import { SacCaseLinkForm } from './sac-case-link-form'
import type { SacMovement } from '@/lib/types/database'
import type { DeadlineSuggestion } from '@/lib/sac/types'

interface SacMovementsPanelProps {
  caseId: string
  sacExpedienteNumber?: string | null
  sacAnio?: string | null
  sacFuero?: string | null
  sacResponsibleLawyerId?: string | null
  sacEstadoActual?: string | null
  sacLastSync?: string | null
  sacCaratula?: string | null
  sacJuzgado?: string | null
  sacSecretaria?: string | null
  canEdit: boolean
}

export function SacMovementsPanel({
  caseId,
  sacExpedienteNumber,
  sacAnio,
  sacFuero,
  sacResponsibleLawyerId,
  sacEstadoActual,
  sacLastSync,
  sacCaratula,
  sacJuzgado,
  sacSecretaria,
  canEdit,
}: SacMovementsPanelProps) {
  const [movements, setMovements] = useState<SacMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const isLinked = !!sacExpedienteNumber

  const fetchMovements = useCallback(async () => {
    if (!isLinked) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/sac/cases/${caseId}/movements`)
      if (res.ok) {
        const data = await res.json()
        setMovements(data.movements || [])
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }, [caseId, isLinked])

  useEffect(() => {
    fetchMovements()
  }, [fetchMovements])

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch(`/api/sac/sync/${caseId}`, { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        if (data.status === 'success') {
          toast.success(
            `${data.new_movements_inserted} nuevo(s) movimiento(s) sincronizado(s)`
          )
        } else if (data.status === 'no_changes') {
          toast.info('Sin movimientos nuevos')
        } else if (data.status === 'auth_failed') {
          toast.error(
            'Error de autenticación SAC. El abogado responsable debe actualizar sus credenciales.'
          )
        } else {
          toast.warning(data.error_message || 'Completado con advertencias')
        }
        await fetchMovements()
      } else {
        toast.error(data.error || 'Error de sincronización')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSyncing(false)
    }
  }

  async function handleMarkAllRead() {
    try {
      await fetch(`/api/sac/cases/${caseId}/movements`, { method: 'PATCH' })
      setMovements((prev) => prev.map((m) => ({ ...m, is_new: false })))
    } catch {
      // Ignore
    }
  }

  const newCount = movements.filter((m) => m.is_new).length

  return (
    <div className="space-y-6">
      {/* Link form section */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <SacCaseLinkForm
            caseId={caseId}
            sacExpedienteNumber={sacExpedienteNumber}
            sacAnio={sacAnio}
            sacFuero={sacFuero}
            sacResponsibleLawyerId={sacResponsibleLawyerId}
            sacEstadoActual={sacEstadoActual}
            sacLastSync={sacLastSync}
            sacCaratula={sacCaratula}
            sacJuzgado={sacJuzgado}
            sacSecretaria={sacSecretaria}
            canEdit={canEdit}
            onSyncComplete={fetchMovements}
          />
        </CardContent>
      </Card>

      {/* Movements list */}
      {isLinked && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Movimientos Judiciales</CardTitle>
                {newCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {newCount} nuevo{newCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {newCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllRead}
                    className="text-xs"
                  >
                    Marcar leídos
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1 h-3 w-3" />
                  )}
                  {syncing ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
              </div>
            </div>
            {sacLastSync && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última sincronización:{' '}
                {new Date(sacLastSync).toLocaleString('es-AR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </CardHeader>

          <Separator />

          <CardContent className="pt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Cargando movimientos...
              </div>
            ) : movements.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Inbox className="mx-auto h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">No hay movimientos registrados aún.</p>
                <p className="text-xs mt-1">
                  Sincronice para obtener los movimientos del expediente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {movements.map((mov) => (
                  <MovementItem key={mov.id} movement={mov} caseId={caseId} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Movement item component
// ---------------------------------------------------------------------------

function MovementItem({
  movement,
  caseId,
}: {
  movement: SacMovement
  caseId: string
}) {
  const rawData = movement.raw_data as Record<string, unknown> | null
  const deadlineSuggestion = rawData?.deadline_suggestion as DeadlineSuggestion | undefined
  const hasDeadlineSuggestion = deadlineSuggestion?.detected

  return (
    <div
      className={`rounded-lg border p-3 space-y-1.5 transition-colors ${
        movement.is_new
          ? 'border-primary/40 bg-primary/5'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-mono">
            {formatDate(movement.fecha)}
          </span>
          <Badge variant="secondary" className="text-xs">
            {movement.tipo}
          </Badge>
          {movement.is_new && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              NUEVO
            </Badge>
          )}
        </div>
        {movement.folio && (
          <span className="text-xs text-muted-foreground shrink-0">
            Folio: {movement.folio}
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed">{movement.descripcion}</p>

      {movement.secretaria_mov && (
        <p className="text-xs text-muted-foreground">
          Secretaría: {movement.secretaria_mov}
        </p>
      )}

      {hasDeadlineSuggestion && (
        <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Se detectó un posible plazo
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {deadlineSuggestion.description}
                {deadlineSuggestion.suggested_date &&
                  ` — Fecha sugerida: ${formatDate(deadlineSuggestion.suggested_date)}`}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-1 h-7 text-xs border-amber-300 dark:border-amber-700"
                asChild
              >
                <a
                  href={`/calendario/nuevo?caso=${caseId}${
                    deadlineSuggestion.suggested_date
                      ? `&fecha=${deadlineSuggestion.suggested_date}`
                      : ''
                  }&titulo=${encodeURIComponent(
                    `Plazo: ${movement.tipo}`
                  )}&descripcion=${encodeURIComponent(movement.descripcion)}`}
                >
                  <CalendarPlus className="mr-1 h-3 w-3" />
                  Crear vencimiento sugerido
                </a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}
