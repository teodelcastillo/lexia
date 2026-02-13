import { LexiaRedactorLayoutClient } from '@/components/lexia/lexia-redactor-layout-client'

export default function LexiaContestacionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <LexiaRedactorLayoutClient>{children}</LexiaRedactorLayoutClient>
}
