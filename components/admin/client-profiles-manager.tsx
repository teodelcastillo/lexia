'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Search, Building2, Mail, Phone } from 'lucide-react'
import type { Person, Company } from '@/lib/types'

const personTypeColors: Record<string, string> = {
  client: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  contact: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  judge: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  opposing_counsel: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

const personTypeLabels: Record<string, string> = {
  client: 'Cliente',
  contact: 'Contacto',
  judge: 'Juez',
  opposing_counsel: 'Abogado Contrario',
}

interface ClientWithCompany extends Person {
  companies?: Company
}

export default function ClientProfilesManager() {
  const supabase = createClient()
  const [clients, setClients] = useState<ClientWithCompany[]>([])
  const [filtered, setFiltered] = useState<ClientWithCompany[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadClientProfiles = async () => {
      try {
        const { data } = await supabase
          .from('people')
          .select('*, companies(id, company_name, name)')
          .eq('person_type', 'client')
          .order('name')

        setClients(data || [])
        setFiltered(data || [])
      } catch (err) {
        console.error('[v0] Error loading client profiles:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadClientProfiles()
  }, [supabase])

  useEffect(() => {
    const result = clients.filter(p =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
    )
    setFiltered(result)
  }, [search, clients])

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Cargando clientes...</div>
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
          filtered.map(client => {
            const company = client.companies as Company | null
            return (
              <Card key={client.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {client.name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">
                        {client.name}
                      </CardTitle>
                      <Badge className={`mt-2 ${personTypeColors[client.person_type ?? 'other'] || ''}`}>
                        {(personTypeLabels[client.person_type ?? 'other'] || client.person_type) ?? 'other'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {client.email && (
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-sm break-all">{client.email}</p>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{client.phone}</p>
                    </div>
                  )}
                  {company && (
                    <div className="flex items-start gap-2 pt-2 border-t border-border">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-sm font-medium">{company.company_name || company.name}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        ) : (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No hay clientes registrados
          </div>
        )}
      </div>
    </div>
  )
}
