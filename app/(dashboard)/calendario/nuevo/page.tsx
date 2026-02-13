/**
 * New Calendar Event Page
 *
 * Redirects to the new deadline form at /vencimientos/nuevo.
 * Preserves the caso query param when coming from a case context.
 */
import { redirect } from 'next/navigation'

interface CalendarioNuevoPageProps {
  searchParams: Promise<{
    caso?: string
  }>
}

export const metadata = {
  title: 'Nuevo Evento',
  description: 'Crear un nuevo vencimiento o evento en el calendario',
}

export default async function CalendarioNuevoPage({ searchParams }: CalendarioNuevoPageProps) {
  const params = await searchParams
  const query = params.caso ? `?caso=${params.caso}` : ''
  redirect(`/vencimientos/nuevo${query}`)
}
