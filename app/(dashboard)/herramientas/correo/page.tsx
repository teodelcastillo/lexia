/**
 * Quick Email Tool Page
 * 
 * Provides quick access to email templates and composition
 * for common legal communications.
 */
'use client'

import { useState } from 'react'
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
  Mail,
  Send,
  Copy,
  FileText,
  Clock,
  Users,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react'

/** Email template type */
interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  category: 'client' | 'court' | 'opposing' | 'internal'
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

export default function QuickEmailPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [recipient, setRecipient] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isCopied, setIsCopied] = useState(false)

  /** Handles template selection */
  const handleSelectTemplate = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(template)
      setSubject(template.subject)
      setBody(template.body)
    }
  }

  /** Copies email content to clipboard */
  const handleCopy = () => {
    const fullContent = `Para: ${recipient}\nAsunto: ${subject}\n\n${body}`
    navigator.clipboard.writeText(fullContent)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  /** Opens email in default client */
  const handleOpenInClient = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.open(mailtoUrl, '_blank')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Correo Rápido
        </h1>
        <p className="text-sm text-muted-foreground">
          Herramienta de composición rápida de correos con plantillas predefinidas
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Templates List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Plantillas
            </CardTitle>
            <CardDescription>
              Seleccione una plantilla para comenzar
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
                    className={`
                      w-full text-left p-3 rounded-lg border transition-colors
                      ${isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:bg-muted/50'
                      }
                    `}
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

        {/* Email Composer */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Componer Correo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recipient */}
            <div className="space-y-2">
              <Label htmlFor="recipient">Destinatario</Label>
              <Input
                id="recipient"
                type="email"
                placeholder="correo@ejemplo.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Asunto</Label>
              <Input
                id="subject"
                placeholder="Asunto del correo"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            {/* Body */}
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

            {/* Help text */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm">
              <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-muted-foreground">
                Reemplace los campos entre [CORCHETES] con la información correspondiente antes de enviar.
              </p>
            </div>

            {/* Actions */}
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

      {/* Quick Tips */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Próximamente: Asistente IA</h3>
              <p className="text-sm text-muted-foreground">
                Pronto podrá generar correos personalizados con ayuda de inteligencia artificial, 
                adaptando automáticamente el tono y contenido según el destinatario y contexto del caso.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
