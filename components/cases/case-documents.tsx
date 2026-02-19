/**
 * Case Documents Component
 * 
 * Displays and manages documents associated with a case.
 */
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  FileText, 
  Download, 
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
} from 'lucide-react'
interface CaseDocumentsProps {
  caseId: string
  canEdit: boolean
}

const visibilityConfig = {
  internal: { label: 'Interno', variant: 'secondary' as const },
  client_visible: { label: 'Visible Cliente', variant: 'default' as const },
}

/**
 * File type icons
 */
function getFileIcon(fileType: string) {
  if (fileType.includes('image')) return FileImage
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) return FileSpreadsheet
  if (fileType.includes('pdf')) return FileText
  return File
}

/**
 * Formats file size
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/**
 * Fetches documents for a case
 */
async function getCaseDocuments(caseId: string) {
  const supabase = await createClient()

  const { data: documents, error } = await supabase
    .from('documents')
    .select(`
      id,
      name,
      description,
      file_path,
      file_size,
      mime_type,
      is_visible_to_client,
      created_at,
      profiles:uploaded_by (
        id,
        first_name,
        last_name
      )
    `)
    .eq('case_id', caseId)
    .order('created_at', { ascending: false })
    .limit(100) // Limit to prevent performance issues with large document lists

  if (error) {
    console.error('Error fetching documents:', error)
    return []
  }

  return documents
}

export async function CaseDocuments({ caseId, canEdit }: CaseDocumentsProps) {
  const documents = await getCaseDocuments(caseId)

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">
          Documentos ({documents.length})
        </h3>
        {canEdit && (
          <Button asChild size="sm">
            <Link href={`/documentos/subir?caso=${caseId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Subir Documento
            </Link>
          </Button>
        )}
      </div>

      {documents.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay documentos en este caso
            </p>
            {canEdit && (
              <Button asChild className="mt-4 bg-transparent" variant="outline">
                <Link href={`/documentos/subir?caso=${caseId}`}>
                  Subir Primer Documento
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Archivos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {documents.map((doc) => {
                const p = doc.profiles
                const uploader = (Array.isArray(p) ? p[0] ?? null : p ?? null) as { id: string; first_name: string; last_name: string } | null
                const visibility = doc.is_visible_to_client ? visibilityConfig.client_visible : visibilityConfig.internal
                const FileIcon = getFileIcon(doc.mime_type ?? '')

                return (
                  <div
                    key={doc.id}
                    className="flex items-start gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    {/* File Icon */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <FileIcon className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* File Info */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {doc.name}
                        </p>
                        <Badge variant={visibility.variant} className="h-5 text-[10px] shrink-0">
                          {visibility.label}
                        </Badge>
                      </div>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {doc.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(doc.file_size ?? 0)} · Subido por {uploader?.first_name} {uploader?.last_name} · {' '}
                        {new Date(doc.created_at).toLocaleDateString('es-AR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={`/documentos/${doc.id}`}>
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">Ver documento</span>
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <a href={`/api/documents/${doc.id}/download`}>
                          <Download className="h-4 w-4" />
                          <span className="sr-only">Descargar</span>
                        </a>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
