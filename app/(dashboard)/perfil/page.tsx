import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileView } from '@/components/profile/user-profile-view'

export const metadata = {
  title: 'Mi Perfil | Legal Practice',
  description: 'Gestiona tu perfil y preferencias',
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/dashboard')
  }

  return <ProfileView profile={profile} user={user} />
}
