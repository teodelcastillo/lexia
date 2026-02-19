/**
 * Redirect: Vencimientos -> Eventos
 * Keeps old links working.
 */
import { redirect } from 'next/navigation'

interface VencimientosPageProps {
  searchParams: Promise<{
    status?: string
    type?: string
    search?: string
  }>
}

export default async function VencimientosPage({ searchParams }: VencimientosPageProps) {
  const params = await searchParams
  const q = new URLSearchParams()
  if (params.status) q.set('status', params.status)
  if (params.type) q.set('type', params.type)
  if (params.search) q.set('search', params.search)
  const query = q.toString()
  redirect(`/eventos${query ? `?${query}` : ''}`)
}
