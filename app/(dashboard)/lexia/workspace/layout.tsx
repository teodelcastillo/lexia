/**
 * Workspace layout - full-height flex container.
 * The parent Lexia layout already provides the viewport cap.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="flex flex-col min-h-0 h-full w-full">{children}</div>
}
