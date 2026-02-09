/**
 * Document Upload Form Component
 * 
 * Handles file upload to Google Drive with metadata input.
 * Supports drag-and-drop, case/client association, and visibility settings.
 */
'use client'

import React from "react"

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  FileText,
  File,
  FileImage,
  FileSpreadsheet,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Cloud,
  Shield,
  Users,
  Briefcase,
  Building2,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'

/** Props for the upload form */
interface DocumentUploadFormProps {
  cases: Array<{
    id: string
    case_number: string
    title: string
  }>
  preselectedCaseId?: string
  userId: string
}

/** Document type configuration */
const DOCUMENT_TYPES = [
  { value: 'contract', label: 'Contrato', description: 'Contratos y acuerdos legales' },
  { value: 'filing', label: 'Escrito Judicial', description: 'Demandas, contestaciones, recursos' },
  { value: 'evidence', label: 'Prueba', description: 'Documentos probatorios' },
  { value: 'correspondence', label: 'Correspondencia', description: 'Cartas, notificaciones, emails' },
  { value: 'power_of_attorney', label: 'Poder', description: 'Poderes y autorizaciones' },
  { value: 'id_document', label: 'Identificación', description: 'DNI, CUIT, certificados' },
  { value: 'financial', label: 'Financiero', description: 'Facturas, recibos, balances' },
  { value: 'internal', label: 'Interno', description: 'Notas y documentos internos' },
  { value: 'other', label: 'Otro', description: 'Otros documentos' },
] as const

/** Get file icon based on type */
function getFileIcon(fileType: string) {
  if (fileType.includes('pdf')) return FileText
  if (fileType.includes('image')) return FileImage
  if (fileType.includes('sheet') || fileType.includes('excel')) return FileSpreadsheet
  return File
}

/** Format file size */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function DocumentUploadForm({
  cases,
  preselectedCaseId,
  userId,
}: DocumentUploadFormProps) {
  const router = useRouter()
  const supabase = createClient()

  // Form state
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Form fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [documentType, setDocumentType] = useState<string>('')
  const [caseId, setCaseId] = useState(preselectedCaseId || '')
  const [visibility, setVisibility] = useState<'internal' | 'client_visible'>('internal')
  const [notifyClient, setNotifyClient] = useState(false)

  // Get selected case details
  const selectedCase = cases.find(c => c.id === caseId)

  /** Handle drag events */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      if (!name) {
        setName(droppedFile.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }, [name])

  /** Handle file selection */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  /** Remove selected file */
  const handleRemoveFile = () => {
    setFile(null)
  }

  /** Handle form submission */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast.error('Por favor seleccione un archivo')
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

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Simulate upload progress (in real implementation, this would be actual upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      // In a real implementation, you would:
      // 1. Upload file to Google Drive via API
      // 2. Get the Google Drive file ID
      // 3. Save metadata to Supabase

      // For now, we'll simulate the Google Drive upload and save metadata
      // This would be replaced with actual Google Drive API integration
      const googleDriveId = `gdrive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Save document metadata to Supabase (use name and mime_type, not file_name/file_type)
      const { data, error } = await supabase
        .from('documents')
        .insert({
          case_id: caseId,
          name: name || file.name,
          description: description || null,
          file_path: `/documents/${caseId}/${file.name}`,
          file_size: file.size,
          mime_type: file.type,
          category: documentType,
          is_visible_to_client: visibility === 'client_visible',
          google_drive_id: googleDriveId,
          uploaded_by: userId,
        })
        .select()
        .single()

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (error) throw error

      toast.success('Documento subido exitosamente', {
        description: visibility === 'client_visible' 
          ? 'El documento es visible para el cliente'
          : 'El documento es solo para uso interno',
      })

      // Redirect to documents page or case
      router.push(caseId ? `/casos/${caseId}?tab=documentos` : '/documentos')
      router.refresh()

    } catch (error) {
      console.error('Error uploading document:', error)
      toast.error('Error al subir el documento', {
        description: 'Por favor intente nuevamente',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const FileIcon = file ? getFileIcon(file.type) : File

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* File Drop Zone */}
      <div className="space-y-2">
        <Label>Archivo</Label>
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }
            `}
          >
            <input
              type="file"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
            />
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Arrastra un archivo aquí o haz clic para seleccionar
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  PDF, Word, Excel, imágenes hasta 50MB
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
                  <FileIcon className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(file.size)} · {file.type || 'Documento'}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveFile}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {isUploading && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Subiendo a Google Drive...</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Document Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Nombre del Documento</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Contrato de Servicios - Cliente ABC"
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
      <div className="space-y-3">
        <Label>Tipo de Documento</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {DOCUMENT_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setDocumentType(type.value)}
              className={`
                p-3 rounded-lg border text-left transition-colors
                ${documentType === type.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
                }
              `}
            >
              <p className="text-sm font-medium text-foreground">{type.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Case Selection */}
      <div className="space-y-2">
        <Label htmlFor="case">Caso Asociado</Label>
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
                  Visible solo para el equipo del estudio
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
                  El cliente podrá ver este documento en su portal
                </p>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Notify Client Option */}
      {visibility === 'client_visible' && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
          <Checkbox
            id="notifyClient"
            checked={notifyClient}
            onCheckedChange={(checked) => setNotifyClient(checked as boolean)}
          />
          <div className="space-y-1">
            <Label htmlFor="notifyClient" className="font-medium cursor-pointer">
              Notificar al cliente
            </Label>
            <p className="text-sm text-muted-foreground">
              Enviar un email informando sobre el nuevo documento
            </p>
          </div>
        </div>
      )}

      {/* Google Drive Info */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-blue-50/50">
        <Cloud className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Almacenamiento en Google Drive
          </p>
          <p className="text-sm text-muted-foreground">
            El archivo se subirá a la carpeta compartida del estudio en Google Drive.
            Solo se guardarán los metadatos y el enlace en el sistema.
          </p>
        </div>
      </div>

      {/* Submit Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isUploading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={!file || !caseId || !documentType || isUploading}>
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Subir Documento
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
