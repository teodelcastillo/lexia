/**
 * Root Page - Entry Point
 *
 * - Unauthenticated: Landing page (descripción de la app, enlace a privacidad).
 * - Authenticated: Redirect by role (dashboard or client portal).
 */
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingPage } from '@/components/landing/landing-page'

export const metadata: Metadata = {
  title: 'Lexia – Asistente legal | Gestión integral para estudios jurídicos',
  description:
    'Plataforma de gestión legal: casos, clientes, documentos, tareas, plazos y asistente de IA especializado en derecho argentino. Portal para clientes.',
}

export default async function RootPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <LandingPage />
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }
  redirect('/dashboard')
}
