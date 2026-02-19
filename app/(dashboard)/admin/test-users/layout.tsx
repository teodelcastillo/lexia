/**
 * Test Users Layout - Security containment
 *
 * Redirects away from this route when seed users feature is disabled (production).
 */
import { redirect } from 'next/navigation'
import { isSeedUsersEnabled } from '@/lib/utils/feature-flags'

export default async function TestUsersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!isSeedUsersEnabled()) {
    redirect('/admin/usuarios?seed_disabled=1')
  }
  return <>{children}</>
}
