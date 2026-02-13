/**
 * Client Portal - Documents Page
 * 
 * Simple document download page for clients.
 * Shows only documents shared with the client, organized by case.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getEffectivePortalUserId } from '@/lib/portal/view-as'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Download,
  ExternalLink,
  FolderOpen,
  Calendar,
  Search,
} from 'lucide-react'
import { Input } from '@/components/ui/input'

export const metadata = {
  title: 'Documentos - Portal de Clientes',
  description: 'Descargue los documentos compartidos de sus casos',
}

/** Get file type icon and color */
function getFileTypeDisplay(fileName: string): { color: string; label: string } {
  const extension = fileName.split('.').pop()?.toLowerCase() || ''
  
  const typeMap: Record<string, { color: string; label: string }> = {
    pdf: { color: 'bg-red-100 text-red-700', label: 'PDF' },
    doc: { color: 'bg-blue-100 text-blue-700', label: 'DOC' },
    docx: { color: 'bg-blue-100 text-blue-700', label: 'DOCX' },
    xls: { color: 'bg-green-100 text-green-700', label: 'XLS' },
    xlsx: { color: 'bg-green-100 text-green-700', label: 'XLSX' },
    jpg: { color: 'bg-purple-100 text-purple-700', label: 'IMG' },
    jpeg: { color: 'bg-purple-100 text-purple-700', label: 'IMG' },
    png: { color: 'bg-purple-100 text-purple-700', label: 'IMG' },
  }
  
  return typeMap[extension] || { color: 'bg-muted text-muted-foreground', label: 'ARCHIVO' }
}

export default async function PortalDocumentsPage() {
  const supabase = await createClient()
  const effectiveUserId = await getEffectivePortalUserId()
  if (!effectiveUserId) redirect('/auth/portal-login')

  // Get person (client) record linked to this user via portal_user_id
  const { data: person } = await supabase
    .from('people')
    .select('id, name, company_id')
    .eq('portal_user_id', effectiveUserId)
    .eq('person_type', 'client')
    .single()

  if (!person) {
    redirect('/auth/portal-login')
  }

  // Get case IDs via case_participants and/or company_id
  const { data: participantCases } = person.id
    ? await supabase
        .from('case_participants')
        .select('case_id')
        .eq('person_id', person.id)
        .eq('role', 'client_representative')
        .eq('is_active', true)
    : { data: [] }

  const participantCaseIds = participantCases?.map((cp) => cp.case_id) || []
  
  const { data: companyCases } = person.company_id
    ? await supabase
        .from('cases')
        .select('id')
        .eq('company_id', person.company_id)
    : { data: [] }

  const companyCaseIds = companyCases?.map((c) => c.id) || []
  const allCaseIds = [...new Set([...participantCaseIds, ...companyCaseIds])]

  // Fetch all client's cases
  const { data: cases } = allCaseIds.length > 0
    ? await supabase
        .from('cases')
        .select('id, case_number, title')
        .in('id', allCaseIds)
        .order('updated_at', { ascending: false })
    : { data: [] }

  // Fetch all documents visible to client
  const caseIds = cases?.map(c => c.id) || []
  const { data: documents } = caseIds.length > 0
    ? await supabase
        .from('documents')
        .select(`
          *,
          case:cases(case_number, title)
        `)
        .in('case_id', caseIds)
        .eq('is_visible_to_client', true)
        .order('created_at', { ascending: false })
    : { data: [] }

  // Group documents by case
  const documentsByCase = documents?.reduce((acc, doc) => {
    const caseNumber = doc.case?.case_number || 'Sin caso'
    if (!acc[caseNumber]) {
      acc[caseNumber] = {
        caseTitle: doc.case?.title || '',
        documents: [],
      }
    }
    acc[caseNumber].documents.push(doc)
    return acc
  }, {} as Record<string, { caseTitle: string; documents: typeof documents }>)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Mis Documentos
        </h1>
        <p className="text-muted-foreground mt-1">
          Descargue los documentos que su abogado ha compartido con usted
        </p>
      </div>

      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex items-start gap-4 pt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">
              Documentos Disponibles
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Aqui encontrara todos los documentos que su equipo legal ha compartido con usted. 
              Puede descargarlos o abrirlos directamente.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Documents by Case */}
      {documentsByCase && Object.keys(documentsByCase).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(documentsByCase).map(([caseNumber, { caseTitle, documents: docs }]) => (
            <Card key={caseNumber}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <span className="font-mono text-sm text-muted-foreground">{caseNumber}</span>
                  <span className="mx-1">-</span>
                  <span className="font-normal">{caseTitle}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {docs?.map((doc) => {
                    const fileType = getFileTypeDisplay(doc.name)
                    
                    return (
                      <div 
                        key={doc.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <Badge 
                            variant="secondary" 
                            className={`${fileType.color} font-mono text-xs px-2`}
                          >
                            {fileType.label}
                          </Badge>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {doc.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <Calendar className="h-3 w-3" />
                              <span>
                                Compartido el {new Date(doc.created_at).toLocaleDateString('es-AR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {doc.google_drive_id && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              asChild
                              className="gap-2 bg-transparent"
                            >
                              <a 
                                href={`https://drive.google.com/file/d/${doc.google_drive_id}/view`}
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                                <span className="hidden sm:inline">Abrir en Drive</span>
                              </a>
                            </Button>
                          )}
                          <Button 
                            variant="default" 
                            size="sm"
                            className="gap-2"
                            asChild
                          >
                            <a href={`/api/documents/${doc.id}/download`}>
                              <Download className="h-4 w-4" />
                              <span className="hidden sm:inline">Descargar</span>
                            </a>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No hay documentos disponibles</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Cuando su abogado comparta documentos con usted, aparecerán aquí para que pueda descargarlos.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Si necesita un documento que no aparece aqui, contacte a su abogado.
        </p>
      </div>
    </div>
  )
}
