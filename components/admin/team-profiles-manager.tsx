'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import type { Profile } from '@/lib/types'

const roleColors: Record<string, string> = {
  admin_general: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  case_leader: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  lawyer_executive: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  staff: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

const roleLabels: Record<string, string> = {
  admin_general: 'Administrador General',
  case_leader: 'Líder de Casos',
  lawyer_executive: 'Abogado Ejecutivo',
  staff: 'Personal',
}

export default function TeamProfilesManager() {
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [filtered, setFiltered] = useState<Profile[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadTeamProfiles = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .neq('system_role', 'client')
          .order('first_name')

        setProfiles(data || [])
        setFiltered(data || [])
      } catch (err) {
        console.error('[v0] Error loading team profiles:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadTeamProfiles()
  }, [supabase])

  useEffect(() => {
    const result = profiles.filter(p =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
    )
    setFiltered(result)
  }, [search, profiles])

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando perfiles...</div>
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length > 0 ? (
          filtered.map(profile => (
            <Card key={profile.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile.avatar_url || ''} />
                    <AvatarFallback>
                      {profile.first_name?.[0]}{profile.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {profile.first_name} {profile.last_name}
                    </CardTitle>
                    <Badge className={`mt-2 ${roleColors[profile.system_role] || ''}`}>
                      {roleLabels[profile.system_role] || profile.system_role}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium break-all">{profile.email}</p>
                </div>
                {profile.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground">Teléfono</p>
                    <p className="text-sm">{profile.phone}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No hay perfiles de equipo disponibles
          </div>
        )}
      </div>
    </div>
  )
}
