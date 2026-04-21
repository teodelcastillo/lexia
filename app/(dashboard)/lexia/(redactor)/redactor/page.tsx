import { redirect } from 'next/navigation'

/**
 * /lexia/redactor → /lexia/workspace/nuevo?type=demanda
 *
 * Phase 4: the legacy form-based Redactor is deprecated in favor of the
 * Workspace (Tiptap editor + ⌘K + modo agente + stress-test). Existing
 * drafts remain accessible at /lexia/borradores; new work starts in the
 * Workspace.
 *
 * Query parameters are forwarded so deep links like
 * `/lexia/redactor?caso=<uuid>` keep leading to a usable entry point.
 */
export default async function RedactorPage({
  searchParams,
}: {
  searchParams: Promise<{ caso?: string; borrador?: string }>
}) {
  const sp = await searchParams
  // Legacy draft links: the Workspace does not replace per-field drafts yet,
  // so we keep them reachable through the drafts list.
  if (sp.borrador) {
    redirect(`/lexia/borradores?open=${sp.borrador}`)
  }
  const params = new URLSearchParams({ type: 'demanda' })
  if (sp.caso) params.set('caso', sp.caso)
  redirect(`/lexia/workspace/nuevo?${params.toString()}`)
}
