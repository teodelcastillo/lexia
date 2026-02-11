/**
 * Document Upload Page
 * 
 * Allows users to upload documents to Google Drive and link them to cases.
 * Handles metadata input, visibility settings, and case association.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'
import { DocumentUploadForm } from '@/components/documents/document-upload-form'

export const metadata = {
  title: 'Subir Documento | LegalFlow',
  description: 'Subir documento a Google Drive y vincularlo a un caso',
}

interface UploadPageProps {
  searchParams: Promise<{
    caso?: string
    cliente?: string
  }>
}

export default async function DocumentUploadPage({ searchParams }: UploadPageProps) {
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

  // Get preselected case if provided
  const preselectedCase = params.caso 
    ? cases?.find(c => c.id === params.caso) 
    : null

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
            Subir Documento
          </h1>
          <p className="text-sm text-muted-foreground">
            El archivo se guardará en Google Drive y se vinculará al caso
          </p>
        </div>
      </div>

      {/* Upload Form */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>Información del Documento</CardTitle>
          <CardDescription>
            Complete los datos del documento. El archivo será almacenado en Google Drive
            y los metadatos se guardarán en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentUploadForm 
            cases={cases || []}
            preselectedCaseId={preselectedCase?.id}
            userId={user.id}
          />
        </CardContent>
      </Card>
    </div>
  )
}
