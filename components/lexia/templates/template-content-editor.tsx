'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { FormFieldDefinition } from '@/lib/ai/draft-schemas'

interface TemplateContentEditorProps {
  value: string
  onChange: (value: string) => void
  availableFields: FormFieldDefinition[]
  disabled?: boolean
}

export function TemplateContentEditor({
  value,
  onChange,
  availableFields,
  disabled = false,
}: TemplateContentEditorProps) {
  const placeholders = availableFields.map((f) => `{{${f.key}}}`).join(', ')

  return (
    <div className="space-y-2">
      <Label>Contenido base del documento</Label>
      <p className="text-sm text-muted-foreground">
        Texto reutilizable con placeholders que se reemplazan con los datos del formulario.
        Usá doble llave: {'{{'}clave{'}}'}.
      </p>
      <p className="text-xs text-muted-foreground font-mono">
        Claves disponibles: {placeholders}
      </p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={`Ej:\n\nVISTO: Los presentes actuados {{actor}} contra {{demandado}}...\n\nY CONSIDERANDO: {{hechos}}...`}
        className="min-h-[200px] font-mono text-sm"
      />
    </div>
  )
}
