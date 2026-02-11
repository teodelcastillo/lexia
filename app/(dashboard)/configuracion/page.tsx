/**
 * Settings Page (Admin Only)
 * 
 * System configuration and settings management.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Settings,
  Building2,
  Bell,
  Shield,
  Cloud,
  Mail,
  Calendar,
  Database,
  ExternalLink,
} from 'lucide-react'

export const metadata = {
  title: 'Configuración',
  description: 'Configuración del sistema',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  
  // Validate admin access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role !== 'admin_general') {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Configuración
        </h1>
        <p className="text-sm text-muted-foreground">
          Administre la configuración del sistema
        </p>
      </div>

      <div className="grid gap-6">
        {/* Firm Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5" />
              Información del Estudio
            </CardTitle>
            <CardDescription>
              Datos generales del estudio jurídico
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firm-name">Nombre del Estudio</Label>
                <Input id="firm-name" placeholder="Estudio Jurídico..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firm-cuit">CUIT</Label>
                <Input id="firm-cuit" placeholder="XX-XXXXXXXX-X" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firm-address">Dirección</Label>
                <Input id="firm-address" placeholder="Dirección del estudio" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firm-phone">Teléfono</Label>
                <Input id="firm-phone" placeholder="+54 351 XXXXXXX" />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button>Guardar Cambios</Button>
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Cloud className="h-5 w-5" />
              Integraciones
            </CardTitle>
            <CardDescription>
              Conecte servicios externos para mejorar la productividad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google Drive */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Google Drive</p>
                  <p className="text-sm text-muted-foreground">
                    Almacenamiento de documentos
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" />
                Conectar
              </Button>
            </div>

            {/* Google Calendar */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Google Calendar</p>
                  <p className="text-sm text-muted-foreground">
                    Sincronización de calendario
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" />
                Conectar
              </Button>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Correo Electrónico</p>
                  <p className="text-sm text-muted-foreground">
                    Configuración SMTP para notificaciones
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Configurar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
            <CardDescription>
              Configure las notificaciones del sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notificaciones por correo</p>
                <p className="text-sm text-muted-foreground">
                  Enviar recordatorios de vencimientos por email
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Alertas de vencimiento</p>
                <p className="text-sm text-muted-foreground">
                  Notificar 3 días antes del vencimiento
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notificaciones a clientes</p>
                <p className="text-sm text-muted-foreground">
                  Permitir envío de notificaciones al portal de clientes
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              Seguridad
            </CardTitle>
            <CardDescription>
              Configuración de seguridad y acceso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Autenticación de dos factores</p>
                <p className="text-sm text-muted-foreground">
                  Requerir 2FA para todos los usuarios
                </p>
              </div>
              <Switch />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sesiones concurrentes</p>
                <p className="text-sm text-muted-foreground">
                  Permitir múltiples sesiones por usuario
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Registro de actividad</p>
                <p className="text-sm text-muted-foreground">
                  Mantener logs de todas las acciones
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
