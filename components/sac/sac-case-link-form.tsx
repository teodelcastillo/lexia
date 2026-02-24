'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Link2,
  Loader2,
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { SAC_FUERO_OPTIONS } from '@/lib/sac/types'

interface TeamMember {
  user_id: string
  case_role: string
  first_name: string
  last_name: string
  system_role: string
  has_sac_credentials: boolean
  sac_credentials_active: boolean
}

interface SacCaseLinkFormProps {
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
  onSyncComplete?: () => void
}

export function SacCaseLinkForm({
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
  onSyncComplete,
}: SacCaseLinkFormProps) {
  const isLinked = !!sacExpedienteNumber

  const [expediente, setExpediente] = useState(sacExpedienteNumber || '')
  const [anio, setAnio] = useState(sacAnio || '')
  const [fuero, setFuero] = useState(sacFuero || '')
  const [lawyerId, setLawyerId] = useState(sacResponsibleLawyerId || '')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [linking, setLinking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  useEffect(() => {
    if (canEdit) {
      fetchTeamCredentials()
    }
  }, [caseId, canEdit])

  async function fetchTeamCredentials() {
    setLoadingTeam(true)
    try {
      const res = await fetch(`/api/sac/cases/${caseId}/team-credentials`)
      if (res.ok) {
        const data = await res.json()
        setTeamMembers(data.members || [])
      }
    } catch {
      // Ignore
    } finally {
      setLoadingTeam(false)
    }
  }

  async function handleLink() {
    if (!expediente.trim() || !anio.trim() || !lawyerId) {
      toast.error('Complete todos los campos requeridos')
      return
    }

    setLinking(true)
    try {
      const res = await fetch(`/api/sac/cases/${caseId}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sac_expediente_number: expediente.trim(),
          sac_anio: anio.trim(),
          sac_fuero: fuero || null,
          sac_responsible_lawyer_id: lawyerId,
        }),
      })

      if (res.ok) {
        toast.success('Expediente SAC vinculado')
        window.location.reload()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Error al vincular')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setLinking(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch(`/api/sac/sync/${caseId}`, { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        if (data.status === 'success') {
          toast.success(
            `Sincronización exitosa: ${data.new_movements_inserted} nuevo(s) movimiento(s)`
          )
        } else if (data.status === 'no_changes') {
          toast.info('Sin cambios — no se encontraron movimientos nuevos')
        } else if (data.status === 'auth_failed') {
          toast.error('Error de autenticación SAC. El abogado responsable debe actualizar sus credenciales.')
        } else {
          toast.warning(data.error_message || 'Sincronización completada con advertencias')
        }
        onSyncComplete?.()
      } else {
        toast.error(data.error || 'Error de sincronización')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSyncing(false)
    }
  }

  async function handleUnlink() {
    if (!confirm('¿Desvincular el expediente SAC de este caso?')) return

    setUnlinking(true)
    try {
      const res = await fetch(`/api/sac/cases/${caseId}/link`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Expediente desvinculado')
        window.location.reload()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Error al desvincular')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setUnlinking(false)
    }
  }

  // --- Linked state: show info + sync button ---
  if (isLinked) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Expediente SAC Vinculado</span>
          </div>
          <Badge variant="default" className="text-xs bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Vinculado
          </Badge>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Expediente:</span>{' '}
              <span className="font-medium">{sacExpedienteNumber}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Año:</span>{' '}
              <span className="font-medium">{sacAnio}</span>
            </div>
            {sacFuero && (
              <div>
                <span className="text-muted-foreground">Fuero:</span>{' '}
                <span className="font-medium">
                  {SAC_FUERO_OPTIONS.find((f) => f.value === sacFuero)?.label || sacFuero}
                </span>
              </div>
            )}
            {sacEstadoActual && (
              <div>
                <span className="text-muted-foreground">Estado:</span>{' '}
                <span className="font-medium">{sacEstadoActual}</span>
              </div>
            )}
          </div>

          {sacCaratula && (
            <div>
              <span className="text-muted-foreground">Carátula:</span>{' '}
              <span className="font-medium">{sacCaratula}</span>
            </div>
          )}
          {sacJuzgado && (
            <div>
              <span className="text-muted-foreground">Juzgado:</span>{' '}
              <span className="font-medium">{sacJuzgado}</span>
            </div>
          )}
          {sacSecretaria && (
            <div>
              <span className="text-muted-foreground">Secretaría:</span>{' '}
              <span className="font-medium">{sacSecretaria}</span>
            </div>
          )}

          {sacLastSync && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
              <Clock className="h-3 w-3" />
              Última sincronización:{' '}
              {new Date(sacLastSync).toLocaleString('es-AR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="flex-1"
            variant="outline"
          >
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </Button>
          {canEdit && (
            <Button
              onClick={handleUnlink}
              disabled={unlinking}
              variant="outline"
              className="text-destructive hover:text-destructive"
            >
              <Unlink className="mr-2 h-4 w-4" />
              Desvincular
            </Button>
          )}
        </div>
      </div>
    )
  }

  // --- Unlinked state: show form ---
  if (!canEdit) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <Link2 className="mx-auto h-8 w-8 mb-2 opacity-40" />
        <p>No hay expediente SAC vinculado a este caso.</p>
        <p className="text-xs mt-1">
          Un líder de caso o administrador puede vincularlo.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">Vincular Expediente SAC</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="sac-exp-num">N° Expediente</Label>
          <Input
            id="sac-exp-num"
            placeholder="123456"
            value={expediente}
            onChange={(e) => setExpediente(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sac-anio">Año</Label>
          <Input
            id="sac-anio"
            placeholder="2025"
            maxLength={4}
            value={anio}
            onChange={(e) => setAnio(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Fuero</Label>
        <Select value={fuero} onValueChange={setFuero}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar fuero..." />
          </SelectTrigger>
          <SelectContent>
            {SAC_FUERO_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>Abogado en SAC</Label>
        {loadingTeam ? (
          <div className="text-muted-foreground text-sm flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando equipo...
          </div>
        ) : (
          <TooltipProvider>
            <Select value={lawyerId} onValueChange={setLawyerId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar abogado..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((m) => {
                  const canSelect = m.has_sac_credentials && m.sac_credentials_active
                  return (
                    <Tooltip key={m.user_id}>
                      <TooltipTrigger asChild>
                        <div>
                          <SelectItem
                            value={m.user_id}
                            disabled={!canSelect}
                            className={!canSelect ? 'opacity-50' : ''}
                          >
                            <span className="flex items-center gap-2">
                              {m.first_name} {m.last_name}
                              {!canSelect && (
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                              )}
                            </span>
                          </SelectItem>
                        </div>
                      </TooltipTrigger>
                      {!canSelect && (
                        <TooltipContent side="left">
                          Sin credenciales SAC configuradas
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )
                })}
                {teamMembers.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No hay miembros en el equipo
                  </div>
                )}
              </SelectContent>
            </Select>
          </TooltipProvider>
        )}
      </div>

      <Button
        onClick={handleLink}
        disabled={linking || !expediente.trim() || !anio.trim() || !lawyerId}
        className="w-full"
      >
        {linking ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Vinculando...
          </>
        ) : (
          <>
            <Link2 className="mr-2 h-4 w-4" />
            Vincular expediente
          </>
        )}
      </Button>
    </div>
  )
}
