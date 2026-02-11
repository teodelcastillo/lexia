'use client'

import { useState } from 'react'
import { ArrowLeft, Mail, Phone, MapPin, Building2, Shield } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { Profile } from '@/lib/types'
import type { User } from '@supabase/supabase-js'

interface ProfileViewProps {
  profile: Profile
  user: User
}

/**
 * Role color mapping for badges
 */
const roleColors: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  admin_general: { variant: 'destructive', label: 'Administrador' },
  lawyer: { variant: 'default', label: 'Abogado' },
  staff: { variant: 'secondary', label: 'Personal' },
  client: { variant: 'outline', label: 'Cliente' },
}

export function ProfileView({ profile, user }: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false)
  
  const role = roleColors[profile.system_role] || { variant: 'outline' as const, label: profile.system_role }
  const initials = `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mi Perfil</h1>
          <p className="text-muted-foreground">Gestiona tu información personal y preferencias</p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Atrás
          </Button>
        </Link>
      </div>

      {/* Main Profile Card */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-lg font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle className="text-2xl">
                  {profile.first_name} {profile.last_name}
                </CardTitle>
                <Badge variant={role.variant}>{role.label}</Badge>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancelar' : 'Editar Perfil'}
            </Button>
          </div>
        </CardHeader>

        <Separator className="my-0" />

        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email
              </label>
              <p className="text-foreground font-medium">{user.email}</p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Teléfono
              </label>
              <p className="text-foreground font-medium">{profile.phone || 'No especificado'}</p>
            </div>

            {/* System Role */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Rol del Sistema
              </label>
              <Badge variant={role.variant}>{role.label}</Badge>
            </div>

            {/* Address */}
            {profile.address && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Dirección
                </label>
                <p className="text-foreground font-medium">{profile.address}</p>
              </div>
            )}

            {/* Company Info (for clients) */}
            {profile.company_id && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Empresa
                </label>
                <p className="text-foreground font-medium">Cargando...</p>
              </div>
            )}

            {/* Account Created */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Cuenta Creada</label>
              <p className="text-foreground font-medium">
                {new Date(profile.created_at).toLocaleDateString('es-AR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Security Card */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Seguridad
            </CardTitle>
            <CardDescription>Gestiona tu contraseña y seguridad</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full bg-transparent">
              Cambiar Contraseña
            </Button>
            <Button variant="outline" className="w-full bg-transparent">
              Autenticación de Dos Factores
            </Button>
          </CardContent>
        </Card>

        {/* Preferences Card */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Preferencias</CardTitle>
            <CardDescription>Configura tus preferencias de notificaciones</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full bg-transparent">
              Configurar Notificaciones
            </Button>
            <Button variant="outline" className="w-full bg-transparent">
              Preferencias de Visualización
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de Peligro</CardTitle>
          <CardDescription>Acciones que no se pueden deshacer</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" className="w-full">
            Cerrar Sesión en Todos los Dispositivos
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
