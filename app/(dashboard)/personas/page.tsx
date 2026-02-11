/**
 * People Module - Main View
 * 
 * Shows all people in the system with filtering by person type.
 * Includes clients, judges, opposing lawyers, experts, witnesses, etc.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Plus, 
  Search, 
  User,
  Mail,
  Phone,
  MapPin,
  Users,
  Building2,
  Scale,
  Gavel,
  UserX,
  FileSearch,
  PenTool,
} from 'lucide-react'

export const metadata = {
  title: 'Personas',
  description: 'Gestión de personas del estudio',
}

interface PeoplePageProps {
  searchParams: {
    search?: string
    type?: string
  }
}

/**
 * Validates user access
 */
async function validateAccess() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  return { user, profile }
}

/**
 * Fetches people with filters
 */
async function getPeople(search?: string, type?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('people')
    .select(`
      id,
      name,
      person_type,
      email,
      phone,
      city,
      province,
      is_active,
      company_id,
      company_role,
      created_at,
      companies (
        id,
        name
      )
    `)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,dni.ilike.%${search}%`)
  }

  if (type && type !== 'all') {
    query = query.eq('person_type', type)
  }

  const { data: people, error } = await query

  if (error) {
    console.error('Error fetching people:', error)
    return []
  }

  return people || []
}

/**
 * Person type configuration
 */
const personTypes = [
  { value: 'all', label: 'Todos', icon: Users },
  { value: 'client', label: 'Clientes', icon: User },
  { value: 'judge', label: 'Jueces', icon: Gavel },
  { value: 'opposing_lawyer', label: 'Abogados Contraparte', icon: UserX },
  { value: 'prosecutor', label: 'Fiscales', icon: Scale },
  { value: 'expert', label: 'Peritos', icon: FileSearch },
  { value: 'witness', label: 'Testigos', icon: User },
  { value: 'notary', label: 'Escribanos', icon: PenTool },
]

/**
 * Person type labels in Spanish
 */
const personTypeLabels: Record<string, string> = {
  client: 'Cliente',
  judge: 'Juez',
  opposing_lawyer: 'Abogado Contraparte',
  prosecutor: 'Fiscal',
  witness: 'Testigo',
  expert: 'Perito',
  notary: 'Escribano',
  court_clerk: 'Secretario Judicial',
  other: 'Otro',
}

/**
 * Person type colors for badges
 */
const personTypeColors: Record<string, string> = {
  client: 'bg-primary/10 text-primary border-primary/20',
  judge: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  opposing_lawyer: 'bg-red-500/10 text-red-700 border-red-500/20',
  prosecutor: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
  witness: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  expert: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
  notary: 'bg-teal-500/10 text-teal-700 border-teal-500/20',
  court_clerk: 'bg-slate-500/10 text-slate-700 border-slate-500/20',
  other: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
}

/**
 * Person type icon backgrounds
 */
const personTypeIconBg: Record<string, string> = {
  client: 'bg-primary/10',
  judge: 'bg-amber-500/10',
  opposing_lawyer: 'bg-red-500/10',
  prosecutor: 'bg-orange-500/10',
  witness: 'bg-blue-500/10',
  expert: 'bg-purple-500/10',
  notary: 'bg-teal-500/10',
  court_clerk: 'bg-slate-500/10',
  other: 'bg-gray-500/10',
}

const personTypeIconColor: Record<string, string> = {
  client: 'text-primary',
  judge: 'text-amber-600',
  opposing_lawyer: 'text-red-600',
  prosecutor: 'text-orange-600',
  witness: 'text-blue-600',
  expert: 'text-purple-600',
  notary: 'text-teal-600',
  court_clerk: 'text-slate-600',
  other: 'text-gray-600',
}

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  const { profile } = await validateAccess()
  const params = searchParams
  const activeType = params.type || 'all'
  
  const canCreate = ['admin_general', 'case_leader', 'lawyer_executive'].includes(profile?.system_role || '')
  const people = await getPeople(params.search, params.type)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Personas
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestione todas las personas relacionadas a sus casos
          </p>
        </div>
        
        {canCreate && (
          <Button asChild>
            <Link href="/personas/nueva">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Persona
            </Link>
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <form className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="search"
              placeholder="Buscar por nombre, email o DNI..."
              className="pl-9"
              defaultValue={params.search}
            />
          </div>
          <input type="hidden" name="type" value={activeType} />
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </div>

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2">
        {personTypes.map((type) => (
          <Link 
            key={type.value} 
            href={`/personas${type.value !== 'all' ? `?type=${type.value}` : ''}${params.search ? `${type.value !== 'all' ? '&' : '?'}search=${params.search}` : ''}`}
          >
            <Badge 
              variant={activeType === type.value ? 'default' : 'outline'}
              className="cursor-pointer"
            >
              <type.icon className="mr-1 h-3 w-3" />
              {type.label}
            </Badge>
          </Link>
        ))}
      </div>

      {/* People Grid */}
        {people.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-medium text-foreground">No se encontraron personas</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {params.search ? 'Intente con otros términos de búsqueda' : 'Comience agregando una nueva persona'}
            </p>
            {canCreate && !params.search && (
              <Button asChild className="mt-4">
                <Link href="/personas/nueva">Agregar Persona</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((person) => {
              const companyData = person.companies as unknown as { id: string; name: string } | null
              const personType = person.person_type || 'other'
              const iconBg = personTypeIconBg[personType] || personTypeIconBg.other
              const iconColor = personTypeIconColor[personType] || personTypeIconColor.other

              return (
                <Link key={person.id} href={`/personas/${person.id}`}>
                  <Card className="h-full border-border/60 transition-colors hover:border-primary/50 hover:bg-muted/30">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
                          <User className={`h-5 w-5 ${iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-foreground truncate">
                              {person.name}
                            </h3>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge 
                              variant="outline" 
                              className={`h-5 text-[10px] ${personTypeColors[personType] || personTypeColors.other}`}
                            >
                              {personTypeLabels[personType] || 'Otro'}
                            </Badge>
                            {companyData && (
                              <Badge variant="outline" className="h-5 text-[10px]">
                                <Building2 className="mr-1 h-2.5 w-2.5" />
                                {companyData.name}
                              </Badge>
                            )}
                          </div>

                          <div className="mt-2 space-y-1">
                            {person.email && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                <span className="truncate">{person.email}</span>
                              </div>
                            )}
                            {person.phone && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                <span>{person.phone}</span>
                              </div>
                            )}
                            {(person.city || person.province) && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span>{[person.city, person.province].filter(Boolean).join(', ')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
    </div>
  )
}
