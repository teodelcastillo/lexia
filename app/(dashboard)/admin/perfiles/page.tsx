import React from "react"
/**
 * Admin Profiles Management Page
 * Unified interface for managing all team and client profiles
 */
import { Suspense } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { validateAdminAccess } from '@/lib/utils/access-control'
import TeamProfilesManager from '@/components/admin/team-profiles-manager'
import ClientProfilesManager from '@/components/admin/client-profiles-manager'
import { Users, UserCheck } from 'lucide-react'

export const metadata = {
  title: 'Gestión de Perfiles',
  description: 'Administrar perfiles del equipo y clientes',
}

export default async function ProfilesPage() {
  await validateAdminAccess()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Gestión de Perfiles
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Administra los perfiles de tu equipo y los clientes de la plataforma
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team" className="w-full">
        <TabsList>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Equipo
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Clientes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <TeamProfilesManager />
          </Suspense>
        </TabsContent>

        <TabsContent value="clients" className="mt-6">
          <Suspense fallback={<div>Cargando...</div>}>
            <ClientProfilesManager />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
