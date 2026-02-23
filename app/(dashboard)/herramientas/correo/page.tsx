/**
 * Quick Email Tool Page
 *
 * Provides quick access to email templates and composition
 * for common legal communications. Auto-fills from contacts
 * and supports case/client-aware templates (procedural status, client report).
 */
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Mail,
  Copy,
  FileText,
  AlertCircle,
  ExternalLink,
  Sparkles,
  User,
  ChevronsUpDown,
  Briefcase,
  Building2,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ContactItem = { id: string; name: string | null; email: string; company_name: string | null; person_type: string | null }
type CaseItem = {
  id: string
  case_number: string
  title: string
  status: string
  company_id: string | null
  companies?: { id: string; company_name: string; name: string | null } | null
}
type CompanyItem = { id: string; company_name: string; name: string | null; email: string | null }

/** Email template type */
interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: 'client' | 'court' | 'opposing' | 'internal'
  /** Template needs a case to auto-fill (e.g. procedural status) */
  needsCase?: boolean
  /** Template needs a company (client) to auto-fill (e.g. general report) */
  needsCompany?: boolean
}

const statusLabels: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendiente',
  on_hold: 'En Espera',
  closed: 'Cerrado',
  archived: 'Archivado',
}

/** Pre-defined email templates */
const emailTemplates: EmailTemplate[] = [
  {
    id: 'client-update',
    name: 'Actualización al Cliente',
    subject: 'Actualización de su caso - [NÚMERO DE CASO]',
    body: `Estimado/a [NOMBRE DEL CLIENTE],

Le escribo para informarle sobre el estado actual de su caso.

[DETALLES DE LA ACTUALIZACIÓN]

Quedamos a su disposición para cualquier consulta.

Saludos cordiales,
[FIRMA]`,
    category: 'client',
  },
  {
    id: 'procedural-status',
    name: 'Actualización de estado procesal',
    subject: 'Estado procesal - Expediente [NÚMERO DE CASO]',
    body: `Estimado/a [NOMBRE DEL CLIENTE],

Le informamos el estado actual del expediente [NÚMERO DE CASO] - [TÍTULO CASO].

Estado: [ESTADO DEL CASO]

Próximos plazos:
[PRÓXIMOS PLAZOS]

[DETALLES ADICIONALES]

Quedamos a su disposición.

Saludos cordiales,
[FIRMA]`,
    category: 'client',
    needsCase: true,
  },
  {
    id: 'client-status-report',
    name: 'Informe de estado general (cliente)',
    subject: 'Informe de estado de sus casos - [NOMBRE CLIENTE/EMPRESA]',
    body: `Estimado/a [NOMBRE DEL CLIENTE],

Adjuntamos un resumen del estado de los asuntos que tenemos a cargo:

[INFORME DE CASOS]

Quedamos a su disposición para cualquier consulta.

Saludos cordiales,
[FIRMA]`,
    category: 'client',
    needsCompany: true,
  },
  {
    id: 'court-filing',
    name: 'Notificación de Presentación',
    subject: 'Notificación de presentación judicial - Expediente [NÚMERO]',
    body: `Estimado/a [NOMBRE],

Por la presente, le informamos que con fecha [FECHA] se ha presentado [TIPO DE ESCRITO] en el expediente de referencia.

[DETALLES ADICIONALES]

Sin otro particular, saludo a Ud. atentamente.

[FIRMA]`,
    category: 'court',
  },
  {
    id: 'hearing-reminder',
    name: 'Recordatorio de Audiencia',
    subject: 'Recordatorio: Audiencia programada - [FECHA]',
    body: `Estimado/a [NOMBRE DEL CLIENTE],

Le recordamos que tiene una audiencia programada:

Fecha: [FECHA]
Hora: [HORA]
Lugar: [LUGAR/TRIBUNAL]
Expediente: [NÚMERO DE EXPEDIENTE]

Por favor, confirme su asistencia.

Saludos cordiales,
[FIRMA]`,
    category: 'client',
  },
  {
    id: 'document-request',
    name: 'Solicitud de Documentación',
    subject: 'Solicitud de documentación - [ASUNTO]',
    body: `Estimado/a [NOMBRE],

Para continuar con el trámite de su caso, necesitamos que nos proporcione la siguiente documentación:

1. [DOCUMENTO 1]
2. [DOCUMENTO 2]
3. [DOCUMENTO 3]

Le solicitamos enviar los documentos a la brevedad posible.

Quedamos atentos,
[FIRMA]`,
    category: 'client',
  },
]

/** Category labels and colors */
const categoryConfig: Record<string, { label: string; className: string }> = {
  client: { label: 'Cliente', className: 'bg-blue-500/10 text-blue-500' },
  court: { label: 'Judicial', className: 'bg-amber-500/10 text-amber-500' },
  opposing: { label: 'Contraparte', className: 'bg-red-500/10 text-red-500' },
  internal: { label: 'Interno', className: 'bg-muted text-muted-foreground' },
}

function replacePlaceholders(
  text: string,
  map: Record<string, string>
): string {
  let out = text
  for (const [key, value] of Object.entries(map)) {
    out = out.replace(new RegExp(`\\[${key}\\]`, 'gi'), value)
  }
  return out
}

/** Strip HTML tags for plain-text fallback (mailto, clipboard plain) */
function stripHtml(html: string): string {
  if (!html || !html.includes('<')) return html
  const div = typeof document !== 'undefined' ? document.createElement('div') : null
  if (div) {
    div.innerHTML = html
    return (div.textContent ?? div.innerText ?? '').trim()
  }
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function QuickEmailPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<ContactItem | null>(null)
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<CompanyItem | null>(null)

  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [cases, setCases] = useState<CaseItem[]>([])
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingCaseDetail, setLoadingCaseDetail] = useState(false)
  const [loadingClientReport, setLoadingClientReport] = useState(false)
  const [generatingInforme, setGeneratingInforme] = useState(false)

  const displayName = selectedContact?.name?.trim() || selectedContact?.email || ''

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/herramientas/correo/data')
      if (!res.ok) return
      const data = await res.json()
      setContacts(data.contacts ?? [])
      setCases(data.cases ?? [])
      setCompanies(data.companies ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const fillFromContact = useCallback((contact: ContactItem) => {
    setSelectedContact(contact)
    setRecipient(contact.email)
    setContactOpen(false)
    const name = contact.name?.trim() || contact.email
    const map: Record<string, string> = {
      'NOMBRE DEL CLIENTE': name,
      'NOMBRE': name,
    }
    setSubject((s) => replacePlaceholders(s, map))
    setBody((b) => replacePlaceholders(b, map))
  }, [])

  const fetchCaseDetail = useCallback(async (caseId: string) => {
    setLoadingCaseDetail(true)
    try {
      const res = await fetch(`/api/herramientas/correo/data?mode=case-detail&caseId=${encodeURIComponent(caseId)}`)
      const data = await res.json()
      const c = data.case
      const deadlines = data.deadlines ?? []
      if (!c) return
      const caseLabel = statusLabels[c.status] ?? c.status
      const plazos =
        deadlines.length > 0
          ? deadlines
              .map(
                (d: { title: string; due_date: string }) =>
                  `- ${d.title}: ${new Date(d.due_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}`
              )
              .join('\n')
          : '- Sin plazos próximos cargados.'
      const map: Record<string, string> = {
        'NÚMERO DE CASO': c.case_number,
        'TÍTULO CASO': c.title ?? '',
        'ESTADO DEL CASO': caseLabel,
        'PRÓXIMOS PLAZOS': plazos,
        'DETALLES ADICIONALES': '[Completar si corresponde]',
      }
      if (displayName) {
        map['NOMBRE DEL CLIENTE'] = displayName
        map['NOMBRE'] = displayName
      }
      setSubject((s) => replacePlaceholders(s, map))
      setBody((b) => replacePlaceholders(b, map))
    } finally {
      setLoadingCaseDetail(false)
    }
  }, [displayName])

  const fetchClientReport = useCallback(async (companyId: string) => {
    setLoadingClientReport(true)
    try {
      const res = await fetch(`/api/herramientas/correo/data?mode=client-cases&companyId=${encodeURIComponent(companyId)}`)
      const data = await res.json()
      const company = companies.find((co) => co.id === companyId) ?? selectedCompany
      const clientName = company?.company_name ?? company?.name ?? 'Cliente'
      const map: Record<string, string> = {
        'NOMBRE DEL CLIENTE': clientName,
        'NOMBRE CLIENTE/EMPRESA': clientName,
      }
      setSubject((s) => replacePlaceholders(s, map))
      setBody((b) => replacePlaceholders(b, map))
    } finally {
      setLoadingClientReport(false)
    }
  }, [companies, selectedCompany])

  const handleSelectTemplate = (templateId: string) => {
    const template = emailTemplates.find((t) => t.id === templateId)
    if (!template) return
    setSelectedTemplate(template)
    setSubject(template.subject)
    setBody(template.body)
    if (!template.needsCase && !template.needsCompany) {
      if (selectedContact) {
        const name = selectedContact.name?.trim() || selectedContact.email
        setSubject(replacePlaceholders(template.subject, { 'NOMBRE DEL CLIENTE': name, 'NOMBRE': name }))
        setBody(replacePlaceholders(template.body, { 'NOMBRE DEL CLIENTE': name, 'NOMBRE': name }))
      }
    }
    if (template.needsCase && selectedCase) {
      fetchCaseDetail(selectedCase.id)
    }
    if (template.needsCompany && selectedCompany) {
      fetchClientReport(selectedCompany.id)
    }
  }

  const handleSelectCase = (caseId: string) => {
    const c = cases.find((x) => x.id === caseId) ?? null
    setSelectedCase(c)
    if (selectedTemplate?.needsCase && c) {
      fetchCaseDetail(c.id)
    }
  }

  const handleSelectCompany = (companyId: string) => {
    const co = companies.find((x) => x.id === companyId) ?? null
    setSelectedCompany(co)
    if (selectedTemplate?.needsCompany && co) {
      fetchClientReport(co.id)
    }
  }

  const generateInformeIA = useCallback(async () => {
    if (!selectedCase?.id) return
    setGeneratingInforme(true)
    try {
      const res = await fetch('/api/herramientas/correo/informe-estado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: selectedCase.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Error al generar el informe')
      }
      const data = await res.json()
      if (data.fragment) {
        setBody((b) => b.replace(/\[Completar si corresponde\]/g, data.fragment))
      }
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Error al generar el informe')
    } finally {
      setGeneratingInforme(false)
    }
  }, [selectedCase?.id])

  const generateInformeIAClient = useCallback(async () => {
    if (!selectedCompany?.id) return
    setGeneratingInforme(true)
    try {
      const dataRes = await fetch(`/api/herramientas/correo/data?mode=client-cases&companyId=${encodeURIComponent(selectedCompany.id)}`)
      if (!dataRes.ok) throw new Error('Error al cargar casos del cliente')
      const { cases: caseList } = await dataRes.json()
      const casesForReport = (caseList ?? []) as { id: string; case_number: string; title: string }[]
      if (casesForReport.length === 0) {
        setBody((b) => b.replace(/\[INFORME DE CASOS\]/g, 'No hay casos activos registrados para este cliente.'))
        return
      }
      const parts: string[] = []
      for (const c of casesForReport) {
        const res = await fetch('/api/herramientas/correo/informe-estado', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caseId: c.id }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Error al generar fragmento del caso ${c.case_number}`)
        }
        const { fragment } = await res.json()
        const title = `Expediente ${c.case_number} - ${c.title ?? 'Sin carátula'}`
        parts.push(`${title}\n\n${(fragment ?? '').trim()}`)
      }
      const informe = parts.join('\n\n')
      setBody((b) => b.replace(/\[INFORME DE CASOS\]/g, informe))
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : 'Error al generar el informe')
    } finally {
      setGeneratingInforme(false)
    }
  }, [selectedCompany?.id])

  const handleCopy = () => {
    const plainBody = body.includes('<') && body.includes('>') ? stripHtml(body) : body
    const fullContent = `Para: ${recipient}\nAsunto: ${subject}\n\n${plainBody}`
    if (body.includes('<') && body.includes('>') && navigator.clipboard?.write) {
      const htmlBlob = new Blob([body], { type: 'text/html' })
      const textBlob = new Blob([fullContent], { type: 'text/plain' })
      const clipboardItem = new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
      navigator.clipboard.write([clipboardItem]).then(
        () => {
          setIsCopied(true)
          setTimeout(() => setIsCopied(false), 2000)
        },
        () => {
          navigator.clipboard.writeText(fullContent)
          setIsCopied(true)
          setTimeout(() => setIsCopied(false), 2000)
        }
      )
    } else {
      navigator.clipboard.writeText(fullContent)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  const handleOpenInClient = () => {
    const bodyForMailto = body.includes('<') && body.includes('>') ? stripHtml(body) : body
    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyForMailto)}`
    window.open(mailtoUrl, '_blank')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Correo Rápido
        </h1>
        <p className="text-sm text-muted-foreground">
          Plantillas y composición con datos de sus contactos y casos
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Plantillas
            </CardTitle>
            <CardDescription>
              Elija una plantilla; puede vincular caso o cliente para rellenar automáticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {emailTemplates.map((template) => {
                const config = categoryConfig[template.category]
                const isSelected = selectedTemplate?.id === template.id
                return (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template.id)}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-colors',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-sm">{template.name}</span>
                      <Badge variant="outline" className={config.className}>
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {template.subject}
                    </p>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Componer Correo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recipient with contact picker */}
            <div className="space-y-2">
              <Label>Destinatario</Label>
              <div className="flex gap-2">
                <Popover open={contactOpen} onOpenChange={setContactOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={contactOpen}
                      className="w-[200px] justify-between shrink-0"
                    >
                      <User className="mr-2 h-4 w-4" />
                      {loading ? 'Cargando...' : 'Elegir contacto'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[320px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar por nombre o correo..." />
                      <CommandList>
                        <CommandEmpty>Sin resultados</CommandEmpty>
                        <CommandGroup>
                          {contacts.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              value={`${contact.name ?? ''} ${contact.email} ${contact.company_name ?? ''}`}
                              onSelect={() => fillFromContact(contact)}
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">
                                  {contact.name || contact.email}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {contact.email}
                                  {contact.company_name ? ` · ${contact.company_name}` : ''}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Input
                  id="recipient"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value)
                    if (!e.target.value) setSelectedContact(null)
                  }}
                  className="flex-1"
                />
              </div>
              {selectedContact && (
                <p className="text-xs text-muted-foreground">
                  Contacto: {selectedContact.name || selectedContact.email}
                  {selectedContact.company_name ? ` (${selectedContact.company_name})` : ''}
                </p>
              )}
            </div>

            {/* Case selector for procedural-status */}
            {selectedTemplate?.needsCase && (
              <div className="space-y-2">
                <Label>Caso (para rellenar estado procesal)</Label>
                <div className="flex gap-2 flex-wrap">
                  <Select
                    value={selectedCase?.id ?? ''}
                    onValueChange={handleSelectCase}
                    disabled={loadingCaseDetail || generatingInforme}
                  >
                    <SelectTrigger className="flex-1 min-w-[200px]">
                      <SelectValue placeholder="Seleccione un caso" />
                    </SelectTrigger>
                    <SelectContent>
                      {cases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-muted-foreground" />
                            {c.case_number} – {c.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={generateInformeIA}
                    disabled={!selectedCase?.id || generatingInforme}
                  >
                    {generatingInforme ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generar informe con IA
                      </>
                    )}
                  </Button>
                </div>
                {loadingCaseDetail && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Cargando plazos...
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  La IA completa solo [Completar si corresponde] con una breve descripción del estado del caso y próximos pasos.
                </p>
              </div>
            )}

            {/* Company selector for client report */}
            {selectedTemplate?.needsCompany && (
              <div className="space-y-2">
                <Label>Cliente / Empresa (para informe general)</Label>
                <div className="flex gap-2 flex-wrap">
                  <Select
                    value={selectedCompany?.id ?? ''}
                    onValueChange={handleSelectCompany}
                    disabled={loadingClientReport || generatingInforme}
                  >
                    <SelectTrigger className="flex-1 min-w-[200px]">
                      <SelectValue placeholder="Seleccione un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((co) => (
                        <SelectItem key={co.id} value={co.id}>
                          <span className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {co.company_name || co.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={generateInformeIAClient}
                    disabled={!selectedCompany?.id || generatingInforme}
                  >
                    {generatingInforme ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generar informe con IA
                      </>
                    )}
                  </Button>
                </div>
                {loadingClientReport && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Cargando...
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  La IA completará [INFORME DE CASOS] con un listado titulado por causa (número de expediente y carátula); cada caso se genera con una llamada a la IA para mayor precisión.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subject">Asunto</Label>
              <Input
                id="subject"
                placeholder="Asunto del correo"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Mensaje</Label>
              <Textarea
                id="body"
                placeholder="Escriba su mensaje aquí..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                Los campos entre [CORCHETES] se rellenan al elegir un contacto, caso o cliente. El informe generado con IA incluye formato (secciones, listas); al copiar se guarda en el portapapeles con formato para pegar en su cliente de correo.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button onClick={handleOpenInClient} className="flex-1">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir en Cliente de Correo
              </Button>
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                {isCopied ? 'Copiado!' : 'Copiar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Datos personalizados</h3>
              <p className="text-sm text-muted-foreground">
                Use &quot;Elegir contacto&quot; para completar destinatario y saludo. Con &quot;Generar informe con IA&quot; se completa solo el apartado [Completar si corresponde] o [INFORME DE CASOS] con una breve descripción por caso.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
