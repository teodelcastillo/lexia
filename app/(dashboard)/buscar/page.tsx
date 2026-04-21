/**
 * Global Search Page
 *
 * Basic cross-entity search used by the dashboard header search bar.
 * Queries a handful of the most relevant entities (cases, clients/companies,
 * persons, tasks) by ilike on their main text fields and lists matches.
 * RLS policies ensure users only see rows they are authorized to see.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Briefcase, Building2, CheckSquare, SearchX, UserRound } from 'lucide-react'

export const metadata = {
  title: 'Buscar',
  description: 'Buscar en casos, clientes, personas y tareas',
}

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

async function validateAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()
  if (profile?.system_role === 'client') redirect('/portal')
}

const MAX_PER_SECTION = 10

export default async function SearchPage({ searchParams }: SearchPageProps) {
  await validateAccess()
  const params = await searchParams
  const raw = (params.q ?? '').trim()
  // Sanitize for PostgREST ilike pattern: escape % and , which have special meaning in .or()
  const q = raw.replace(/[,%]/g, '')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Búsqueda global
        </h1>
        <p className="text-sm text-muted-foreground">
          {raw
            ? <>Resultados para <span className="font-medium text-foreground">“{raw}”</span></>
            : 'Escribí una consulta en la barra superior para buscar.'}
        </p>
      </div>

      {q.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <SearchX className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            Ingresá al menos una letra en la búsqueda.
          </CardContent>
        </Card>
      ) : (
        <Suspense fallback={<ResultsSkeleton />}>
          <Results query={q} />
        </Suspense>
      )}
    </div>
  )
}

async function Results({ query }: { query: string }) {
  const supabase = await createClient()

  const casesQ = supabase
    .from('cases')
    .select('id, case_number, title, status, companies(name)')
    .or(`case_number.ilike.%${query}%,title.ilike.%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(MAX_PER_SECTION)

  const companiesQ = supabase
    .from('companies')
    .select('id, name, industry')
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(MAX_PER_SECTION)

  const personsQ = supabase
    .from('persons')
    .select('id, first_name, last_name, email')
    .or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`,
    )
    .order('last_name', { ascending: true })
    .limit(MAX_PER_SECTION)

  const tasksQ = supabase
    .from('tasks')
    .select('id, title, status, case_id, cases(case_number, title)')
    .ilike('title', `%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(MAX_PER_SECTION)

  const [cases, companies, persons, tasks] = await Promise.all([
    casesQ,
    companiesQ,
    personsQ,
    tasksQ,
  ])

  const totalFound =
    (cases.data?.length ?? 0) +
    (companies.data?.length ?? 0) +
    (persons.data?.length ?? 0) +
    (tasks.data?.length ?? 0)

  if (totalFound === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <SearchX className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          Sin resultados para “{query}”.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ResultCard
        title="Casos"
        description={`${cases.data?.length ?? 0} resultado(s)`}
        icon={<Briefcase className="h-4 w-4" />}
      >
        {cases.data?.map((c: any) => (
          <li key={c.id}>
            <Link
              href={`/casos/${c.id}`}
              className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="font-mono text-xs text-muted-foreground">
                  {c.case_number}
                </span>
                <span className="truncate">{c.title}</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {c.companies?.name && <span>{c.companies.name}</span>}
                {c.status && (
                  <Badge variant="outline" className="text-[10px]">
                    {c.status}
                  </Badge>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ResultCard>

      <ResultCard
        title="Clientes / Empresas"
        description={`${companies.data?.length ?? 0} resultado(s)`}
        icon={<Building2 className="h-4 w-4" />}
      >
        {companies.data?.map((c: any) => (
          <li key={c.id}>
            <Link
              href={`/clientes/${c.id}`}
              className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <span className="text-sm font-medium truncate">{c.name}</span>
              {c.industry && (
                <span className="text-xs text-muted-foreground truncate">
                  {c.industry}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ResultCard>

      <ResultCard
        title="Personas"
        description={`${persons.data?.length ?? 0} resultado(s)`}
        icon={<UserRound className="h-4 w-4" />}
      >
        {persons.data?.map((p: any) => (
          <li key={p.id}>
            <Link
              href={`/personas/${p.id}`}
              className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <span className="text-sm font-medium truncate">
                {[p.first_name, p.last_name].filter(Boolean).join(' ')}
              </span>
              {p.email && (
                <span className="text-xs text-muted-foreground truncate">
                  {p.email}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ResultCard>

      <ResultCard
        title="Tareas"
        description={`${tasks.data?.length ?? 0} resultado(s)`}
        icon={<CheckSquare className="h-4 w-4" />}
      >
        {tasks.data?.map((t: any) => (
          <li key={t.id}>
            <Link
              href={`/tareas/${t.id}`}
              className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-muted"
            >
              <span className="text-sm font-medium truncate">{t.title}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {t.cases?.case_number && (
                  <span className="font-mono">{t.cases.case_number}</span>
                )}
                {t.status && (
                  <Badge variant="outline" className="text-[10px]">
                    {t.status}
                  </Badge>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ResultCard>
    </div>
  )
}

function ResultCard({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-0.5">
          {Array.isArray(children) && children.length === 0 ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">
              Sin coincidencias.
            </li>
          ) : (
            children
          )}
        </ul>
      </CardContent>
    </Card>
  )
}

function ResultsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
