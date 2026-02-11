/**
 * Client Documents
 * 
 * Displays documents shared with this client from their cases.
 * Only shows documents marked as client_visible.
 */
'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Download,
  ExternalLink,
  File,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  Briefcase,
  Calendar,
} from 'lucide-react'

interface DocumentItem {
  id: string
  name: string
  file_type: string
  file_size: number
  visibility: string
  created_at: string
  case_id: string
  cases: {
    case_number: string
    title: string
  } | null
}

interface ClientDocumentsProps {
  documents: DocumentItem[]
  clientId: string
}

/**
 * Get icon based on file type
 */
function getFileIcon(fileType: string) {
  if (fileType.includes('pdf')) return FileText
  if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv')) return FileSpreadsheet
  if (fileType.includes('image') || fileType.includes('jpg') || fileType.includes('png')) return FileImage
  if (fileType.includes('zip') || fileType.includes('rar')) return FileArchive
  return File
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function ClientDocuments({ documents, clientId }: ClientDocumentsProps) {
  if (documents.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-medium text-foreground">
            Sin documentos compartidos
          </h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
            Los documentos marcados como visibles para el cliente aparecerán aquí.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {documents.length} {documents.length === 1 ? 'documento compartido' : 'documentos compartidos'}
        </p>
        <Badge variant="outline" className="text-xs">
          Visibles para el cliente
        </Badge>
      </div>

      {/* Documents list */}
      <div className="grid gap-3 sm:grid-cols-2">
        {documents.map((doc) => {
          const FileIcon = getFileIcon(doc.file_type)
          const uploadDate = new Date(doc.created_at).toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })

          return (
            <Card key={doc.id} className="border-border/60 transition-colors hover:border-primary/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* File icon */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <FileIcon className="h-5 w-5 text-primary" />
                  </div>

                  {/* File info */}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-foreground truncate">
                      {doc.name}
                    </h4>
                    
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {uploadDate}
                      </span>
                    </div>

                    {/* Case reference */}
                    {doc.cases && (
                      <Link 
                        href={`/casos/${doc.case_id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Briefcase className="h-3 w-3" />
                        {doc.cases.case_number}
                      </Link>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                      <span className="sr-only">Descargar</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink className="h-4 w-4" />
                      <span className="sr-only">Abrir</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Link to all documents */}
      <div className="text-center pt-2">
        <Button variant="outline" asChild>
          <Link href={`/documentos?client_id=${clientId}`}>
            Ver todos los documentos
            <ExternalLink className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
