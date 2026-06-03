'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Shield,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Stethoscope,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import type { SacCredentialsInfo } from '@/lib/sac/types'

interface DiagnosticStep {
  step: string
  ok: boolean
  detail?: string
  htmlSnippet?: string
  detectedFields?: Record<string, string | null>
}

interface DiagnosticResult {
  steps: DiagnosticStep[]
  error?: string
}

export function SacCredentialsForm() {
  const [info, setInfo] = useState<SacCredentialsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Diagnostic state
  const [diagOpen, setDiagOpen] = useState(false)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagResult, setDiagResult] = useState<DiagnosticResult | null>(null)
  const [diagMode, setDiagMode] = useState<'connection' | 'login'>('connection')
  const [expandedHtml, setExpandedHtml] = useState<number | null>(null)

  useEffect(() => {
    fetchCredentials()
  }, [])

  async function fetchCredentials() {
    try {
      const res = await fetch('/api/sac/credentials')
      if (res.ok) {
        const data: SacCredentialsInfo = await res.json()
        setInfo(data)
        if (data.extranet_username) {
          setUsername(data.extranet_username)
        }
      }
    } catch {
      // Ignore fetch errors on load
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAndVerify() {
    if (!username.trim() || !password.trim()) {
      toast.error('Ingrese usuario y contraseña')
      return
    }

    setSaving(true)
    try {
      const saveRes = await fetch('/api/sac/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extranet_username: username.trim(),
          password: password.trim(),
        }),
      })

      if (!saveRes.ok) {
        const err = await saveRes.json()
        toast.error(err.error || 'Error al guardar credenciales')
        return
      }

      toast.success('Credenciales guardadas')
      setPassword('')
      setSaving(false)

      // Now verify
      setVerifying(true)
      const verifyRes = await fetch('/api/sac/credentials/verify', {
        method: 'POST',
      })

      const verifyData = await verifyRes.json()
      if (verifyData.success) {
        toast.success('Verificación exitosa — credenciales válidas')
      } else {
        toast.warning(verifyData.error || 'No se pudo verificar el login')
      }

      await fetchCredentials()
    } catch {
      toast.error('Error al guardar o verificar')
    } finally {
      setSaving(false)
      setVerifying(false)
    }
  }

  async function handleDiagnose(mode: 'connection' | 'login') {
    setDiagMode(mode)
    setDiagResult(null)
    setExpandedHtml(null)
    setDiagOpen(true)
    setDiagLoading(true)

    try {
      const res = await fetch('/api/sac/debug', {
        method: mode === 'login' ? 'POST' : 'GET',
      })
      const data: DiagnosticResult = await res.json()
      setDiagResult(data)
    } catch (err) {
      setDiagResult({
        steps: [],
        error: err instanceof Error ? err.message : 'Error al llamar al endpoint de diagnóstico',
      })
    } finally {
      setDiagLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    )
  }

  const statusBadge = () => {
    if (!info?.hasCredentials) {
      return (
        <Badge variant="outline" className="text-xs">
          Sin configurar
        </Badge>
      )
    }
    if (verifying) {
      return (
        <Badge variant="secondary" className="text-xs">
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Verificando...
        </Badge>
      )
    }
    if (info.consecutive_failures && info.consecutive_failures >= 3) {
      return (
        <Badge variant="destructive" className="text-xs">
          <XCircle className="mr-1 h-3 w-3" />
          Error de credenciales
        </Badge>
      )
    }
    if (info.last_successful_login) {
      return (
        <Badge variant="default" className="text-xs bg-green-600">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Verificado
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="text-xs">
        <AlertTriangle className="mr-1 h-3 w-3" />
        Pendiente de verificación
      </Badge>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Credenciales Extranet SAC</span>
          </div>
          {statusBadge()}
        </div>

        {info?.last_successful_login && (
          <p className="text-xs text-muted-foreground">
            Última verificación exitosa:{' '}
            {new Date(info.last_successful_login).toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}

        {info?.consecutive_failures && info.consecutive_failures >= 3 && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
            <AlertTriangle className="inline mr-1 h-4 w-4" />
            {info.consecutive_failures} intentos fallidos consecutivos. Verifique usuario y contraseña.
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="sac-username">Usuario Extranet</Label>
            <Input
              id="sac-username"
              placeholder="Usuario de la extranet SAC"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="sac-password">
              {info?.hasCredentials ? 'Nueva Contraseña' : 'Contraseña'}
            </Label>
            <div className="relative">
              <Input
                id="sac-password"
                type={showPassword ? 'text' : 'password'}
                placeholder={
                  info?.hasCredentials
                    ? 'Ingrese nueva contraseña para actualizar'
                    : 'Contraseña de la extranet'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSaveAndVerify}
          disabled={saving || verifying || !username.trim() || !password.trim()}
          className="w-full"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando...
            </>
          ) : verifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verificando...
            </>
          ) : (
            'Guardar y verificar'
          )}
        </Button>

        {/* Diagnostic buttons */}
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Diagnóstico de conexión</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => handleDiagnose('connection')}
            >
              <Stethoscope className="mr-1.5 h-3.5 w-3.5" />
              Ver página SAC
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={() => handleDiagnose('login')}
              disabled={!info?.hasCredentials}
              title={!info?.hasCredentials ? 'Guardá credenciales primero' : undefined}
            >
              <Stethoscope className="mr-1.5 h-3.5 w-3.5" />
              Diagnosticar login
            </Button>
          </div>
        </div>
      </div>

      {/* Diagnostic dialog */}
      <Dialog open={diagOpen} onOpenChange={setDiagOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              {diagMode === 'connection' ? 'Diagnóstico de conexión SAC' : 'Diagnóstico de login SAC'}
            </DialogTitle>
          </DialogHeader>

          {diagLoading && (
            <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Conectando al SAC vía HTTP...</p>
              <p className="text-xs">Esto puede tardar hasta 15 segundos</p>
            </div>
          )}

          {!diagLoading && diagResult && (
            <div className="space-y-3">
              {diagResult.error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                  <XCircle className="inline mr-1 h-4 w-4" />
                  {diagResult.error}
                </div>
              )}

              {diagResult.steps.map((step, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 space-y-2 ${
                    step.ok ? 'border-green-200 bg-green-50/50' : 'border-destructive/30 bg-destructive/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {step.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive shrink-0" />
                    )}
                    <span className="text-sm font-medium">{step.step}</span>
                  </div>

                  {step.detail && (
                    <p className="text-xs text-muted-foreground ml-6">{step.detail}</p>
                  )}

                  {step.detectedFields && (
                    <div className="ml-6 space-y-1">
                      {Object.entries(step.detectedFields).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <span className="text-muted-foreground min-w-32">{k}:</span>
                          {v ? (
                            <span className="font-mono text-green-700 break-all">{v}</span>
                          ) : (
                            <span className="text-destructive">no detectado</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {step.htmlSnippet && (
                    <div className="ml-6">
                      <button
                        className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
                        onClick={() => setExpandedHtml(expandedHtml === i ? null : i)}
                      >
                        {expandedHtml === i ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {expandedHtml === i ? 'Ocultar HTML' : 'Ver HTML de la página'}
                      </button>
                      {expandedHtml === i && (
                        <pre className="mt-2 text-[10px] bg-muted rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                          {step.htmlSnippet}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {diagResult.steps.length === 0 && !diagResult.error && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No se obtuvieron resultados
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
