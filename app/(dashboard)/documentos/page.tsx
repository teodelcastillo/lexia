/**
 * Documents Management Page
 * 
 * Central hub for managing all legal documents with Google Drive integration.
 * Documents are organized by Client > Case > Document Type hierarchy.
 * Metadata and permissions are handled in the app, files stored in Google Drive.
 */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentUserOrganizationId } from '@/lib/utils/organization'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Upload, 
  Search, 
  FileText, 
  FileSpreadsheet, 
  FileImage,
  File,
  Download,
  Eye,
  MoreHorizontal,
  FolderOpen,
  Link as LinkIcon,
  Users,
  Briefcase,
  Filter,
  Grid3X3,
  List,
  ExternalLink,
  Shield,
  Clock,
  ChevronRight,
  Building2,
  User,
  FolderTree,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export const metadata = {
  title: 'Documentos | LegalFlow',
  description: 'Gestión centralizada de documentos legales con Google Drive',
}

interface DocumentsPageProps {
  searchParams: Promise<{
    case_id?: string
    client_id?: string
    type?: string
    visibility?: string
    search?: string
    view?: 'list' | 'grid' | 'tree'
    page?: string
  }>
}

const ITEMS_PER_PAGE = 50

/** Document type configuration with labels and colors */
const DOCUMENT_TYPES = {
  contract: { label: 'Contrato', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  filing: { label: 'Escrito Judicial', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  evidence: { label: 'Prueba', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  correspondence: { label: 'Correspondencia', color: 'bg-green-100 text-green-700 border-green-200' },
  power_of_attorney: { label: 'Poder', color: 'bg-red-100 text-red-700 border-red-200' },
  id_document: { label: 'Identificación', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  financial: { label: 'Financiero', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  internal: { label: 'Interno', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  other: { label: 'Otro', color: 'bg-gray-100 text-gray-700 border-gray-200' },
} as const

/** Maps file extensions to icons */
function getDocumentIcon(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-red-500" />
    case 'doc':
    case 'docx':
      return <FileText className="h-5 w-5 text-blue-500" />
    case 'xls':
    case 'xlsx':
      return <FileSpreadsheet className="h-5 w-5 text-green-600" />
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
      return <FileImage className="h-5 w-5 text-purple-500" />
    default:
      return <File className="h-5 w-5 text-muted-foreground" />
  }
}

/** Formats file size for display */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/** Format relative time */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7) return `Hace ${diffDays} días`
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const supabase = await createClient()
  const params = await searchParams
  const viewMode = params.view || 'list'
  
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
  const organizationId = await getCurrentUserOrganizationId()
  const page = params.page ? parseInt(params.page) : 1
  const offset = (page - 1) * ITEMS_PER_PAGE

  // Fetch documents with filters, pagination, and organization filter
  let query = supabase
    .from('documents')
    .select(`
      *,
      case:cases(
        id, 
        case_number, 
        title,
        companies(id, company_name)
      ),
      uploaded_by_user:profiles!documents_uploaded_by_fkey(id, first_name, last_name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + ITEMS_PER_PAGE - 1)

  // Add organization filter for defense in depth
  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  }

  if (params.case_id) {
    query = query.eq('case_id', params.case_id)
  }
  if (params.type && params.type !== 'all') {
    query = query.eq('category', params.type)
  }
  if (params.visibility && params.visibility !== 'all') {
    query = query.eq('is_visible_to_client', params.visibility === 'client_visible')
  }
  if (params.search) {
    query = query.ilike('name', `%${params.search}%`)
  }

  const { data: documents, count } = await query
  const total = count || 0
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE)

  // Fetch cases and companies for filter dropdowns (filtered by organization)
  const casesQuery = supabase
    .from('cases')
    .select('id, case_number, title, companies(id, company_name, name)')
    .order('case_number', { ascending: false })

  if (organizationId) {
    casesQuery.eq('organization_id', organizationId)
  }

  const { data: cases } = await casesQuery

  const companiesQuery = supabase
    .from('companies')
    .select('id, company_name, name')
    .order('company_name')

  if (organizationId) {
    companiesQuery.eq('organization_id', organizationId)
  }

  const { data: companies } = await companiesQuery

  // Calculate statistics
  const stats = {
    total: documents?.length || 0,
    internal: documents?.filter(d => !d.is_visible_to_client).length || 0,
    clientVisible: documents?.filter(d => d.is_visible_to_client).length || 0,
    recentUploads: documents?.filter(d => {
      const uploadDate = new Date(d.created_at)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return uploadDate > weekAgo
    }).length || 0,
  }

  // Group documents by company > case for tree view
  const groupedByCompany = documents?.reduce((acc, doc) => {
    const company = doc.case?.companies as { id: string; company_name?: string; name?: string } | null
    const companyId = company?.id || 'sin-empresa'
    const companyName = company?.company_name || company?.name || 'Sin Empresa'
    const caseId = doc.case?.id || 'sin-caso'
    const caseName = doc.case ? `${doc.case.case_number} - ${doc.case.title}` : 'Sin Caso'

    if (!acc[companyId]) {
      acc[companyId] = { name: companyName, type: 'company', cases: {} }
    }
    if (!acc[companyId].cases[caseId]) {
      acc[companyId].cases[caseId] = { name: caseName, documents: [] }
    }
    acc[companyId].cases[caseId].documents.push(doc)
    return acc
  }, {} as Record<string, { name: string; type?: string; cases: Record<string, { name: string; documents: typeof documents }> }>)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Documentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestión centralizada con integración a Google Drive
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/documentos/vincular">
              <LinkIcon className="mr-2 h-4 w-4" />
              Vincular desde Drive
            </Link>
          </Button>
          <Button asChild>
            <Link href="/documentos/subir">
              <Upload className="mr-2 h-4 w-4" />
              Subir Documento
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Documentos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
                <Shield className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.internal}</p>
                <p className="text-sm text-muted-foreground">Solo Internos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.clientVisible}</p>
                <p className="text-sm text-muted-foreground">Visible a Clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.recentUploads}</p>
                <p className="text-sm text-muted-foreground">Esta Semana</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Toggle */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre de documento..."
                className="pl-9"
                defaultValue={params.search}
              />
            </div>
            
            {/* Company Filter */}
            <Select defaultValue={params.client_id || 'all'}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las empresas</SelectItem>
                {companies?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.company_name || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Case Filter */}
            <Select defaultValue={params.case_id || 'all'}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Caso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los casos</SelectItem>
                {cases?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.case_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Document Type Filter */}
            <Select defaultValue={params.type || 'all'}>
              <SelectTrigger className="w-full lg:w-[160px]">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.entries(DOCUMENT_TYPES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Visibility Filter */}
            <Select defaultValue={params.visibility || 'all'}>
              <SelectTrigger className="w-full lg:w-[160px]">
                <Shield className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Visibilidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toda visibilidad</SelectItem>
                <SelectItem value="internal">Solo Interno</SelectItem>
                <SelectItem value="client_visible">Visible Cliente</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="flex items-center gap-1 rounded-lg border border-border p-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <Link href="?view=list">
                        <List className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vista de lista</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <Link href="?view=grid">
                        <Grid3X3 className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vista de grilla</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <Link href="?view=tree">
                        <FolderTree className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Vista jerárquica</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents Content */}
      {viewMode === 'tree' ? (
        /* Tree View - Company > Case > Documents */
        <div className="space-y-4">
          {groupedByCompany && Object.entries(groupedByCompany).map(([companyId, company]) => (
            <Card key={companyId} className="border-border/60">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{company.name}</CardTitle>
                    <CardDescription>
                      {Object.keys(company.cases).length} casos · {' '}
                      {Object.values(company.cases).reduce((sum, c) => sum + c.documents.length, 0)} documentos
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 pl-4 border-l-2 border-border/60 ml-5">
                  {Object.entries(company.cases).map(([caseId, caseData]) => (
                    <div key={caseId} className="space-y-2">
                      <div className="flex items-center gap-2 -ml-[17px]">
                        <div className="h-3 w-3 rounded-full border-2 border-border bg-background" />
                        <Link 
                          href={`/casos/${caseId}`}
                          className="font-medium text-sm text-foreground hover:text-primary hover:underline"
                        >
                          {caseData.name}
                        </Link>
                        <Badge variant="outline" className="text-xs">
                          {caseData.documents.length} docs
                        </Badge>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pl-4">
                        {caseData.documents.slice(0, 6).map((doc) => (
                          <DocumentGridCard key={doc.id} doc={doc} isAdmin={isAdmin} />
                        ))}
                        {caseData.documents.length > 6 && (
                          <Link
                            href={`/documentos?case_id=${caseId}`}
                            className="flex items-center justify-center p-4 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors"
                          >
                            <span className="text-sm text-muted-foreground">
                              +{caseData.documents.length - 6} más
                            </span>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documents && documents.length > 0 ? (
            documents.map((doc) => (
              <DocumentGridCard key={doc.id} doc={doc} isAdmin={isAdmin} />
            ))
          ) : (
            <Card className="col-span-full border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No se encontraron documentos</p>
                <Button variant="outline" size="sm" className="mt-4 bg-transparent" asChild>
                  <Link href="/documentos/subir">
                    <Upload className="mr-2 h-4 w-4" />
                    Subir primer documento
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* List View (Default) */
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="h-5 w-5" />
                Documentos
                <Badge variant="secondary" className="ml-2">
                  {documents?.length || 0}
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[300px]">Documento</TableHead>
                  <TableHead>Cliente / Caso</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Visibilidad</TableHead>
                  <TableHead>Tamaño</TableHead>
                  <TableHead>Subido</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents && documents.length > 0 ? (
                  documents.map((doc) => {
                    const docType = DOCUMENT_TYPES[doc.category as keyof typeof DOCUMENT_TYPES] || DOCUMENT_TYPES.other

                    return (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                              {getDocumentIcon(doc.name || doc.file_name)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate max-w-[200px]">
                                {doc.name || doc.file_name}
                              </p>
                              {doc.google_drive_id && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" />
                                  Google Drive
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.case ? (
                            <div className="space-y-0.5">
                              <p className="text-xs text-muted-foreground">
                                {doc.case.client?.name || 'Sin cliente'}
                              </p>
                              <Link 
                                href={`/casos/${doc.case.id}`}
                                className="text-sm text-primary hover:underline font-medium"
                              >
                                {doc.case.case_number}
                              </Link>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={`${docType.color} border`}
                          >
                            {docType.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={doc.is_visible_to_client ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {doc.is_visible_to_client ? (
                              <>
                                <Users className="mr-1 h-3 w-3" />
                                Cliente
                              </>
                            ) : (
                              <>
                                <Shield className="mr-1 h-3 w-3" />
                                Interno
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatFileSize(doc.file_size || 0)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm text-foreground">
                              {formatRelativeTime(doc.created_at)}
                            </p>
                            {doc.uploaded_by_user && (
                              <p className="text-xs text-muted-foreground">
                                por {doc.uploaded_by_user.first_name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {doc.google_drive_id && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8"
                                      asChild
                                    >
                                      <a 
                                        href={`https://drive.google.com/file/d/${doc.google_drive_id}/view`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Abrir en Google Drive</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Vista previa</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Descargar</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/documentos/${doc.id}`}>
                                    Ver detalles
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem>Editar metadatos</DropdownMenuItem>
                                <DropdownMenuItem>
                                  {!doc.is_visible_to_client 
                                    ? 'Hacer visible a cliente' 
                                    : 'Hacer interno'
                                  }
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive">
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FolderOpen className="h-8 w-8" />
                        <p>No se encontraron documentos</p>
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/documentos/subir">
                            <Upload className="mr-2 h-4 w-4" />
                            Subir primer documento
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {documents?.length || 0} de {total} documentos · Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              asChild={page > 1}
            >
              {page > 1 ? (
                <Link 
                  href={`/documentos?page=${page - 1}${params.case_id ? `&case_id=${params.case_id}` : ''}${params.type ? `&type=${params.type}` : ''}${params.visibility ? `&visibility=${params.visibility}` : ''}${params.search ? `&search=${params.search}` : ''}${params.view ? `&view=${params.view}` : ''}`}
                >
                  Anterior
                </Link>
              ) : (
                'Anterior'
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              asChild={page < totalPages}
            >
              {page < totalPages ? (
                <Link 
                  href={`/documentos?page=${page + 1}${params.case_id ? `&case_id=${params.case_id}` : ''}${params.type ? `&type=${params.type}` : ''}${params.visibility ? `&visibility=${params.visibility}` : ''}${params.search ? `&search=${params.search}` : ''}${params.view ? `&view=${params.view}` : ''}`}
                >
                  Siguiente
                </Link>
              ) : (
                'Siguiente'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Grid card component for documents */
function DocumentGridCard({ doc, isAdmin }: { doc: Record<string, unknown>; isAdmin: boolean }) {
  const docType = DOCUMENT_TYPES[(doc.category as keyof typeof DOCUMENT_TYPES)] || DOCUMENT_TYPES.other

  return (
    <Card className="border-border/60 transition-all hover:border-primary/50 hover:shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/50 shrink-0">
            {getDocumentIcon((doc.name || doc.file_name) as string)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-medium text-foreground truncate">
              {(doc.name || doc.file_name) as string}
            </h4>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Badge 
                variant="outline" 
                className={`${docType.color} border text-[10px]`}
              >
                {docType.label}
              </Badge>
              <Badge 
                variant={doc.is_visible_to_client ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {doc.is_visible_to_client ? 'Cliente' : 'Interno'}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatFileSize((doc.file_size || 0) as number)} · {formatRelativeTime(doc.created_at as string)}
            </p>
          </div>
        </div>
        {(doc.case as { case_number: string; id: string }) && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <Link 
              href={`/casos/${(doc.case as { id: string }).id}`}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Briefcase className="h-3 w-3" />
              {(doc.case as { case_number: string }).case_number}
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
