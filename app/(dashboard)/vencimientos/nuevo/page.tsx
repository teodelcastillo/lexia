/**
 * Redirect: Vencimientos/nuevo -> Eventos/nuevo
 * Keeps old links working. Preserves caso query param.
 */
import { redirect } from 'next/navigation'

interface VencimientosNuevoPageProps {
  searchParams: Promise<{
    caso?: string
  }>
}

export default async function VencimientosNuevoPage({ searchParams }: VencimientosNuevoPageProps) {
  const params = await searchParams
  const query = params.caso ? `?caso=${params.caso}` : ''
  redirect(`/eventos/nuevo${query}`)
}
