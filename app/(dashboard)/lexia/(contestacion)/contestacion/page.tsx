import { redirect } from 'next/navigation'

/**
 * /lexia/contestacion → /lexia/workspace/nuevo?type=contestacion
 *
 * Phase 4: the legacy block-based Contestación flow is replaced by the
 * Workspace. The new document starts with the `contestacion` template and
 * the lawyer drives the drafting via ⌘K + modo agente + stress-test.
 */
export default async function ContestacionPage({
  searchParams,
}: {
  searchParams: Promise<{ caso?: string }>
}) {
  const sp = await searchParams
  const params = new URLSearchParams({ type: 'contestacion' })
  if (sp.caso) params.set('caso', sp.caso)
  redirect(`/lexia/workspace/nuevo?${params.toString()}`)
}
