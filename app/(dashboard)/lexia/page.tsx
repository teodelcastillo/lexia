import { redirect } from 'next/navigation'

/**
 * Lexia - AI Legal Assistant
 * Redirects to chat page which auto-creates a new conversation.
 */
export default async function LexiaPage({
  searchParams,
}: {
  searchParams: Promise<{ caso?: string }>
}) {
  const { caso } = await searchParams
  const query = caso ? `?caso=${caso}` : ''
  redirect(`/lexia/chat${query}`)
}
