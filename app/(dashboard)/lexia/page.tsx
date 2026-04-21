import { redirect } from 'next/navigation'

/**
 * /lexia → /lexia/workspace
 *
 * Phase 4: Workspace is the new default landing for the Lexia module.
 * The legacy Chat/Redactor/Contestación entries remain reachable
 * explicitly via the sidebar or direct URLs.
 */
export default async function LexiaPage({
  searchParams,
}: {
  searchParams: Promise<{ caso?: string }>
}) {
  const { caso } = await searchParams
  // If the user arrived with ?caso=X, the intent is usually "create a new
  // document for this case". Send them to the new-document picker.
  if (caso) {
    redirect(`/lexia/workspace/nuevo?caso=${caso}`)
  }
  redirect('/lexia/workspace')
}
