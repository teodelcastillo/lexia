/**
 * New Task Page
 * 
 * Form for creating new tasks with:
 * - Title and description
 * - Due date and priority selection
 * - User assignment
 * - Case connection
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { TaskForm } from '@/components/tasks/task-form'

export const metadata = {
  title: 'Nueva Tarea',
  description: 'Crear una nueva tarea',
}

interface NewTaskPageProps {
  searchParams: Promise<{
    caso?: string
  }>
}

export default async function NewTaskPage({ searchParams }: NewTaskPageProps) {
  const supabase = await createClient()
  const params = await searchParams
  
  // Validate user access
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

  // Fetch available cases for assignment
  const { data: cases } = await supabase
    .from('cases')
    .select('id, case_number, title')
    .in('status', ['active', 'pending'])
    .order('case_number', { ascending: false })

  // Fetch team members for assignment
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, system_role')
    .in('system_role', ['admin_general', 'case_leader', 'lawyer_executive'])
    .eq('is_active', true)
    .order('first_name')

  // If caso param provided, get that case's details
  let preselectedCase = null
  if (params.caso) {
    const { data: caseData } = await supabase
      .from('cases')
      .select('id, case_number, title')
      .eq('id', params.caso)
      .single()
    preselectedCase = caseData
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="bg-transparent">
          <Link href="/tareas">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Nueva Tarea
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete los datos para crear una nueva tarea
          </p>
        </div>
      </div>

      {/* Task Form */}
      <TaskForm 
        cases={cases || []}
        teamMembers={teamMembers || []}
        preselectedCase={preselectedCase}
        currentUserId={user.id}
      />
    </div>
  )
}
