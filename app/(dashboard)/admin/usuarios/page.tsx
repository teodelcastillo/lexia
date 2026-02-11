// app/dashboard/admin/users/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminUsersTable from './users-table'

export default async function AdminUsersPage() {
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

  return <AdminUsersTable users={users ?? []} />
}
