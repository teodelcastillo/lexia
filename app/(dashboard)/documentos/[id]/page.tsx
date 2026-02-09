/**
 * Document Detail Page
 * 
 * Displays document details, metadata, and access control information.
 * Allows editing metadata and managing visibility based on user role.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ChevronLeft,
  ExternalLink,
  Download,
  Eye,
  Edit,
  Trash2,
  FileText,
  File,
  FileImage,
  FileSpreadsheet,
  Shield,
  Users,
  Briefcase,
  Building2,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  History,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

/** Document type configuration */
const DOCUMENT_TYPES: Record<string, { label: string; color: string }> = {
  contract: { label: 'Contrato', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  filing: { label: 'Escrito Judicial', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  evidence: { label: 'Prueba', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  correspondence: { label: 'Correspondencia', color: 'bg-green-100 text-green-700 border-green-200' },
  power_of_attorney: { label: 'Poder', color: 'bg-red-100 text-red-700 border-red-200' },
  id_document: { label: 'Identificación', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  financial: { label: 'Financiero', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  internal: { label: 'Interno', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  other: { label: 'Otro', color: 'bg-gray-100 text-gray-700 border-gray-200' },
}

/** Get file icon based on type */
function getDocumentIcon(fileType: string) {
  if (fileType.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />
  if (fileType.includes('image')) return <FileImage className="h-8 w-8 text-purple-500" />
  if (fileType.includes('sheet') || fileType.includes('excel')) return <FileSpreadsheet className="h-8 w-8 text-green-600" />
  if (fileType.includes('word') || fileType.includes('document')) return <FileText className="h-8 w-8 text-blue-500" />
  return <File className="h-8 w-8 text-muted-foreground" />
}

/** Format file size */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return 'Desconocido'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

interface DocumentDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const supabase = await createClient()
  const { id } = await params
  
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

  const isAdmin = profile?.system_role === 'admin_general'

  // Fetch document with related data
  const { data: document, error } = await supabase
    .from('documents')
    .select(`
      *,
      case:cases(
        id,
        case_number,
        title,
        status
      ),
      uploader:profiles!documents_uploaded_by_fkey(id, first_name, last_name, email)
    `)
    .eq('id', id)
    .single()

  if (error || !document) {
    notFound()
  }

  // Check if user has access to this document's case
  let hasAccess = isAdmin
  if (!isAdmin && document.case_id) {
    const { data: assignment } = await supabase
      .from('case_assignments')
      .select('case_role')
      .eq('case_id', document.case_id)
      .eq('user_id', user.id)
      .single()
    
    hasAccess = !!assignment
  }

  if (!hasAccess && !isAdmin) {
    redirect('/dashboard')
  }

  // Determine edit permissions
  const canEdit = isAdmin || document.uploaded_by === user.id
  const canDelete = isAdmin

  const docType = DOCUMENT_TYPES[document.category] || DOCUMENT_TYPES.other
  const driveUrl = document.google_drive_id 
    ? `https://drive.google.com/file/d/${document.google_drive_id}/view`
    : null

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild className="mt-1">
            <Link href="/documentos">
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Volver</span>
            </Link>
          </Button>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted/50 border border-border/60">
              {getDocumentIcon(document.file_type)}
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {document.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={`${docType.color} border`}>
                  {docType.label}
                </Badge>
                <Badge variant={document.is_visible_to_client ? 'default' : 'secondary'}>
                  {document.is_visible_to_client ? (
                    <>
                      <Users className="mr-1 h-3 w-3" />
                      Visible al Cliente
                    </>
                  ) : (
                    <>
                      <Shield className="mr-1 h-3 w-3" />
                      Solo Interno
                    </>
                  )}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {driveUrl && (
            <Button variant="outline" asChild>
              <a href={driveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir en Drive
              </a>
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" asChild>
              <Link href={`/documentos/${id}/editar`}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive bg-transparent">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción eliminará el registro del documento del sistema.
                    El archivo en Google Drive no será afectado.
                    ¿Está seguro de continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {document.description && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Descripción</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {document.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Case Information */}
          {document.case && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Caso Asociado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/casos/${document.case.id}`}
                  className="block p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {document.case.case_number}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {document.case.title}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {document.case.status === 'active' ? 'Activo' : document.case.status}
                    </Badge>
                  </div>

                </Link>
              </CardContent>
            </Card>
          )}

          {/* Access Control Information */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Control de Acceso
              </CardTitle>
              <CardDescription>
                Quién puede ver este documento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Internal Team */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Equipo del Estudio
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Todos los abogados y asistentes asignados al caso pueden ver este documento
                  </p>
                </div>
              </div>

              {/* Client Access */}
              <div className={`flex items-start gap-3 p-3 rounded-lg ${
                document.is_visible_to_client 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-muted/30'
              }`}>
                {document.is_visible_to_client ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Acceso del Cliente
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {document.is_visible_to_client 
                      ? 'El cliente puede ver este documento en su portal'
                      : 'Este documento NO es visible para el cliente'
                    }
                  </p>
                </div>
              </div>

              {/* Change Visibility Button */}
              {canEdit && (
                <Button variant="outline" className="w-full bg-transparent">
                  {document.is_visible_to_client 
                    ? 'Hacer documento interno'
                    : 'Hacer visible al cliente'
                  }
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* File Details */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Detalles del Archivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Nombre original</span>
                  <span className="font-medium text-foreground truncate max-w-[150px]">
                    {document.file_name}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tamaño</span>
                  <span className="font-medium text-foreground">
                    {formatFileSize(document.file_size)}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-medium text-foreground">
                    {document.file_type || 'Documento'}
                  </span>
                </div>
                {document.google_drive_id && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Google Drive ID</span>
                      <span className="font-mono text-xs text-foreground truncate max-w-[120px]">
                        {document.google_drive_id}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Upload Information */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" />
                Información de Carga
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {document.uploader?.first_name} {document.uploader?.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Subido por
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(document.created_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fecha de carga
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {new Date(document.created_at).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Hora de carga
                  </p>
                </div>
              </div>

              {document.updated_at !== document.created_at && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Última modificación: {' '}
                    {new Date(document.updated_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {driveUrl && (
                <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                  <a href={driveUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="mr-2 h-4 w-4" />
                    Ver en Google Drive
                  </a>
                </Button>
              )}
              <Button variant="outline" className="w-full justify-start bg-transparent">
                <Download className="mr-2 h-4 w-4" />
                Descargar
              </Button>
              {document.case && (
                <Button variant="outline" className="w-full justify-start bg-transparent" asChild>
                  <Link href={`/casos/${document.case.id}?tab=documentos`}>
                    <Briefcase className="mr-2 h-4 w-4" />
                    Ver todos los documentos del caso
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
