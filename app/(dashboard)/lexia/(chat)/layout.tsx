import { LexiaChatLayoutClient } from '@/components/lexia/lexia-chat-layout-client'

export default function LexiaChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <LexiaChatLayoutClient>{children}</LexiaChatLayoutClient>
}
