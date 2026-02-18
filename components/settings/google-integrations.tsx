'use client'

/**
 * Google Integrations - Connect/Disconnect Google services
 *
 * Handles Calendar (priority), Drive, Sheets, Docs.
 */
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar, Database, FileSpreadsheet, FileText, ExternalLink, Loader2, Check } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

interface ConnectionStatus {
  calendar: { connected: boolean; email: string | null }
  drive: { connected: boolean; email: string | null }
  sheets: { connected: boolean; email: string | null }
  docs: { connected: boolean; email: string | null }
}

const SERVICES = [
  {
    key: 'calendar' as const,
    label: 'Google Calendar',
    description: 'Sincronización de calendario y vencimientos',
    icon: Calendar,
    comingSoon: false,
  },
  {
    key: 'drive' as const,
    label: 'Google Drive',
    description: 'Almacenamiento de documentos',
    icon: Database,
    comingSoon: false,
  },
  {
    key: 'sheets' as const,
    label: 'Google Sheets',
    description: 'Hojas de cálculo',
    icon: FileSpreadsheet,
    comingSoon: true,
  },
  {
    key: 'docs' as const,
    label: 'Google Docs',
    description: 'Documentos colaborativos',
    icon: FileText,
    comingSoon: true,
  },
] as const

export function GoogleIntegrations() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  useEffect(() => {
    const google = searchParams.get('google')
    const error = searchParams.get('error')
    if (google === 'connected') {
      toast.success('Cuenta de Google conectada correctamente')
      fetchStatus()
      window.history.replaceState({}, '', '/configuracion')
    } else if (google === 'error' || error) {
      toast.error(error === 'access_denied' ? 'Canceló la conexión con Google' : 'Error al conectar con Google')
      window.history.replaceState({}, '', '/configuracion')
    }
  }, [searchParams])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/google/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data)
      }
    } catch {
      setStatus({
        calendar: { connected: false, email: null },
        drive: { connected: false, email: null },
        sheets: { connected: false, email: null },
        docs: { connected: false, email: null },
      })
    }
  }

  async function handleConnect(service: string) {
    setLoading(service)
    try {
      const res = await fetch('/api/google/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
        return
      }
      throw new Error(data.error ?? 'Error al iniciar conexión')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al conectar')
      setLoading(null)
    }
  }

  async function handleDisconnect(service: string) {
    setLoading(service)
    try {
      const res = await fetch('/api/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service }),
      })
      if (res.ok) {
        toast.success('Cuenta desconectada')
        fetchStatus()
      } else {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al desconectar')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al desconectar')
    } finally {
      setLoading(null)
    }
  }

  const defaultStatus: ConnectionStatus = {
    calendar: { connected: false, email: null },
    drive: { connected: false, email: null },
    sheets: { connected: false, email: null },
    docs: { connected: false, email: null },
  }
  const s = status ?? defaultStatus

  return (
    <div className="space-y-4">
      {SERVICES.map(({ key, label, description, icon: Icon, comingSoon }) => {
        const connected = s[key]?.connected ?? false
        const email = s[key]?.email
        const isDisabled = comingSoon && !connected
        const isConnecting = loading === key

        return (
          <div
            key={key}
            className="flex items-center justify-between p-4 rounded-lg border border-border"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">
                  {connected && email ? (
                    <span className="flex items-center gap-1">
                      <Check className="h-4 w-4 text-green-600" />
                      Conectado como {email}
                    </span>
                  ) : (
                    description
                  )}
                </p>
              </div>
            </div>
            {connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDisconnect(key)}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Desconectar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConnect(key)}
                disabled={isDisabled || isConnecting}
              >
                {isConnecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="mr-2 h-4 w-4" />
                )}
                {comingSoon ? 'Próximamente' : 'Conectar'}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
