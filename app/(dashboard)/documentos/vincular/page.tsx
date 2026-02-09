/**
 * Link Google Drive Document Page
 * 
 * Allows users to link existing Google Drive documents to cases.
 * No file upload needed - just paste the Drive link.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { DocumentLinkForm } from '@/components/documents/document-link-form'

export const metadata = {
  title: 'Vincular Documento | LegalFlow',
  description: 'Vincular documento existente de Google Drive a un caso',
}

interface LinkPageProps {
  searchParams: Promise<{
    caso?: string
  }>
}

export default async function DocumentLinkPage({ searchParams }: LinkPageProps) {
  const supabase = await createClient()
  const params = await searchParams
  
  // Validate user access
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role === 'client') {
    redirect('/portal')
  }

  // Fetch cases for dropdown
  const { data: cases } = await supabase
    .from('cases')
    .select(`
      id, 
      case_number, 
      title
    `)
    .eq('status', 'active')
    .order('case_number', { ascending: false })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/documentos">
            <ChevronLeft className="h-5 w-5" />
            <span className="sr-only">Volver</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Vincular desde Google Drive
          </h1>
          <p className="text-sm text-muted-foreground">
            Vincula un documento existente de Google Drive a un caso
          </p>
        </div>
      </div>

      {/* Link Form */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Vincular Documento Existente</CardTitle>
          <CardDescription>
            Pega el enlace de Google Drive del documento que deseas vincular.
            El archivo permanecerá en Drive, solo se guardará la referencia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentLinkForm 
            cases={cases || []}
            preselectedCaseId={params.caso}
            userId={user.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
