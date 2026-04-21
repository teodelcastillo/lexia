/**
 * Portal — Mi Perfil (cliente)
 *
 * Reutiliza ProfileView, que ya se usa en /perfil del dashboard. El layout
 * del portal (app/(portal)/layout.tsx) ya valida que solo clientes / admins
 * en preview accedan, así que no repetimos esa lógica.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileView } from '@/components/profile/user-profile-view'

export const metadata = {
  title: 'Mi Perfil | Portal',
  description: 'Datos personales y cambio de contraseña',
}

export default async function PortalProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/portal-login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/portal')

  return <ProfileView profile={profile} user={user} />
}
