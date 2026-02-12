'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface TemplateInstructionsEditorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function TemplateInstructionsEditor({
  value,
  onChange,
  disabled = false,
}: TemplateInstructionsEditorProps) {
  return (
    <div className="space-y-2">
      <Label>Instrucciones específicas para la IA</Label>
      <p className="text-sm text-muted-foreground">
        Agregá indicaciones adicionales sobre cómo debe estructurarse o redactarse el documento.
        Se combinan con la estructura base del tipo.
      </p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Ej: Incluir referencia al art. 123 del CPCC. Usar tono formal conservador..."
        className="min-h-[200px] font-mono text-sm"
      />
    </div>
  )
}
