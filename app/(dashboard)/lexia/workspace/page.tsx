import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listDocuments } from '@/lib/lexia/workspace/persistence'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FilePlus2, Sparkles, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

export default async function WorkspaceIndexPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const docs = await listDocuments(supabase, { userId: user.id, limit: 50 })

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Workspace
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl">
              Escribí documentos jurídicos con Lexia como copiloto. Seleccioná texto y usá{' '}
              <kbd className="px-1 rounded bg-muted text-[11px]">⌘K</kbd> para reformular, citar,
              endurecer o redactar. Cada cambio queda auditado.
            </p>
          </div>
          <Button asChild>
            <Link href="/lexia/workspace/nuevo">
              <FilePlus2 className="h-4 w-4 mr-1" /> Nuevo
            </Link>
          </Button>
        </header>

        <section>
          {docs.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">Aún no creaste documentos</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Arrancá con una demanda o una contestación.
              </p>
              <Button asChild>
                <Link href="/lexia/workspace/nuevo">
                  <FilePlus2 className="h-4 w-4 mr-1" /> Crear primer documento
                </Link>
              </Button>
            </Card>
          ) : (
            <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-card">
              {docs.map((doc) => {
                const updated = doc.updatedAt
                  ? formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true, locale: es })
                  : ''
                return (
                  <li key={doc.id} className="hover:bg-muted/40">
                    <Link
                      href={`/lexia/workspace/${doc.id}`}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{doc.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="uppercase tracking-wide text-[10px]">{doc.documentType}</span>
                          <span>·</span>
                          <span>v{doc.version}</span>
                          {doc.caseId && (
                            <>
                              <span>·</span>
                              <span>con caso</span>
                            </>
                          )}
                          {updated && (
                            <>
                              <span>·</span>
                              <span>{updated}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
