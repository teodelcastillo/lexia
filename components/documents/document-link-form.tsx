/**
 * Document Link Form Component
 * 
 * Allows linking existing Google Drive documents to cases.
 * Extracts file ID from Drive URL and fetches metadata.
 */
'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Link as LinkIcon,
  ExternalLink,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Users,
  Briefcase,
  Building2,
  Info,
  Globe,
} from 'lucide-react'
import { toast } from 'sonner'

/** Props for the link form */
interface DocumentLinkFormProps {
  cases: Array<{
    id: string
    case_number: string
    title: string
  }>
  preselectedCaseId?: string
  userId: string
}

/** Document type options */
const DOCUMENT_TYPES = [
  { value: 'contract', label: 'Contrato' },
  { value: 'filing', label: 'Escrito Judicial' },
  { value: 'evidence', label: 'Prueba' },
  { value: 'correspondence', label: 'Correspondencia' },
  { value: 'power_of_attorney', label: 'Poder' },
  { value: 'id_document', label: 'Identificación' },
  { value: 'financial', label: 'Financiero' },
  { value: 'internal', label: 'Interno' },
  { value: 'other', label: 'Otro' },
] as const

/** Extract Google Drive file ID from URL */
function extractDriveId(url: string): string | null {
  // Handle various Google Drive URL formats
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,  // /file/d/{id}
    /id=([a-zA-Z0-9_-]+)/,          // ?id={id}
    /\/d\/([a-zA-Z0-9_-]+)/,        // /d/{id}
    /^([a-zA-Z0-9_-]{25,})$/,       // Just the ID
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

/** Validate Google Drive URL */
function isValidDriveUrl(url: string): boolean {
  return (
    url.includes('drive.google.com') || 
    url.includes('docs.google.com') ||
    /^[a-zA-Z0-9_-]{25,}$/.test(url)  // Just the file ID
  )
}

export function DocumentLinkForm({
  cases,
  preselectedCaseId,
  userId,
}: DocumentLinkFormProps) {
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [driveUrl, setDriveUrl] = useState('')
  const [driveId, setDriveId] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [documentType, setDocumentType] = useState<string>('')
  const [caseId, setCaseId] = useState(preselectedCaseId || '')
  const [visibility, setVisibility] = useState<'internal' | 'client_visible'>('internal')

  // Get selected case details
  const selectedCase = cases.find(c => c.id === caseId)

  /** Handle URL input change */
  const handleUrlChange = async (value: string) => {
    setDriveUrl(value)
    setIsValid(null)
    setDriveId(null)

    if (!value) return

    // Check if it's a valid Drive URL
    if (isValidDriveUrl(value)) {
      setIsValidating(true)
      
      const extractedId = extractDriveId(value)
      
      // Simulate validation (in real app, would verify with Google Drive API)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (extractedId) {
        setDriveId(extractedId)
        setIsValid(true)
        
        // Auto-generate a name if not set
        if (!name) {
          setName(`Documento ${extractedId.substring(0, 8)}...`)
        }
      } else {
        setIsValid(false)
      }
      
      setIsValidating(false)
    }
  }

  /** Handle form submission */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!driveId) {
      toast.error('Por favor ingrese un enlace válido de Google Drive')
      return
    }

    if (!caseId) {
      toast.error('Por favor seleccione un caso')
      return
    }

    if (!documentType) {
      toast.error('Por favor seleccione el tipo de documento')
      return
    }

    if (!name) {
      toast.error('Por favor ingrese un nombre para el documento')
      return
    }

    setIsSubmitting(true)

    try {
      // Save document metadata to Supabase
      const { data, error } = await supabase
        .from('documents')
        .insert({
          case_id: caseId,
          name: name,
          description: description || null,
          file_name: name,
          file_path: `https://drive.google.com/file/d/${driveId}/view`,
          file_size: 0, // Unknown for linked documents
          file_type: 'application/octet-stream', // Generic type for linked files
          category: documentType,
          is_visible_to_client: visibility === 'client_visible',
          google_drive_id: driveId,
          uploaded_by: userId,
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Documento vinculado exitosamente')

      // Redirect to documents page or case
      router.push(caseId ? `/casos/${caseId}?tab=documentos` : '/documentos')
      router.refresh()

    } catch (error) {
      console.error('Error linking document:', error)
      toast.error('Error al vincular el documento', {
        description: 'Por favor intente nuevamente',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Google Drive URL Input */}
      <div className="space-y-2">
        <Label htmlFor="driveUrl">Enlace de Google Drive</Label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="driveUrl"
            value={driveUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://drive.google.com/file/d/... o ID del archivo"
            className="pl-9 pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValidating && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {isValid === true && (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
            {isValid === false && (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Pega el enlace completo de Google Drive o solo el ID del archivo
        </p>
      </div>

      {/* Drive Link Preview */}
      {driveId && isValid && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Documento de Google Drive detectado
                </p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  ID: {driveId}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href={`https://drive.google.com/file/d/${driveId}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-3 w-3" />
                  Verificar
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Nombre del Documento *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Contrato de Servicios - Cliente ABC"
          required
        />
        <p className="text-xs text-muted-foreground">
          Un nombre descriptivo para identificar fácilmente el documento
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Descripción (Opcional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notas adicionales sobre el documento..."
          rows={3}
        />
      </div>

      {/* Document Type */}
      <div className="space-y-2">
        <Label htmlFor="documentType">Tipo de Documento *</Label>
        <Select value={documentType} onValueChange={setDocumentType}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Case Selection */}
      <div className="space-y-2">
        <Label htmlFor="case">Caso Asociado *</Label>
        <Select value={caseId} onValueChange={setCaseId}>
          <SelectTrigger>
            <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Seleccionar caso" />
          </SelectTrigger>
          <SelectContent>
            {cases.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.case_number}</span>
                  <span className="text-muted-foreground">-</span>
                  <span className="truncate">{c.title}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

      </div>

      {/* Visibility */}
      <div className="space-y-3">
        <Label>Visibilidad</Label>
        <RadioGroup
          value={visibility}
          onValueChange={(v) => setVisibility(v as 'internal' | 'client_visible')}
          className="grid gap-3 sm:grid-cols-2"
        >
          <div className="relative">
            <RadioGroupItem value="internal" id="internal" className="sr-only" />
            <Label
              htmlFor="internal"
              className={`
                flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors
                ${visibility === 'internal'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
                }
              `}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 shrink-0">
                <Shield className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-foreground">Solo Interno</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Visible solo para el equipo
                </p>
              </div>
            </Label>
          </div>

          <div className="relative">
            <RadioGroupItem value="client_visible" id="client_visible" className="sr-only" />
            <Label
              htmlFor="client_visible"
              className={`
                flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors
                ${visibility === 'client_visible'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
                }
              `}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 shrink-0">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-foreground">Visible al Cliente</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Accesible desde el portal
                </p>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Important Note */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Permisos de Google Drive
          </p>
          <p className="text-sm text-muted-foreground">
            Asegúrate de que el archivo tenga los permisos de compartición correctos en Google Drive
            para que los usuarios autorizados puedan acceder.
          </p>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={!driveId || !caseId || !documentType || !name || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Vinculando...
            </>
          ) : (
            <>
              <LinkIcon className="mr-2 h-4 w-4" />
              Vincular Documento
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
