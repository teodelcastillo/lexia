// app/dashboard/admin/users/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminUsersTable from './users-table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ seed_disabled?: string }>
}) {
  const supabase = await createClient()

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

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .neq('system_role', 'client')
    .order('created_at', { ascending: false })

  const params = await searchParams
  const seedDisabled = params?.seed_disabled === '1'

  return (
    <div className="space-y-4">
      {seedDisabled && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            La herramienta de usuarios de prueba no está disponible en este entorno.
          </AlertDescription>
        </Alert>
      )}
      <AdminUsersTable users={users ?? []} />
    </div>
  )
}
