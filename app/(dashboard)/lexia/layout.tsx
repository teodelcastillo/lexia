import { LexiaLayoutClient } from '@/components/lexia/lexia-layout-client'

export default function LexiaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="-m-4 md:-m-6 flex flex-col min-h-0 h-[calc(100vh-4rem)] overflow-hidden">
      <LexiaLayoutClient>{children}</LexiaLayoutClient>
    </div>
  )
}
