'use client'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { RotateCcw, Plus, Trash2 } from 'lucide-react'
import type { FormFieldDefinition } from '@/lib/ai/draft-schemas'
import { DOCUMENT_TYPE_SCHEMAS } from '@/lib/ai/draft-schemas'
import type { DocumentType } from '@/lib/ai/draft-schemas'

interface TemplateFieldsEditorProps {
  documentType: DocumentType
  fields: FormFieldDefinition[]
  onChange: (fields: FormFieldDefinition[]) => void
  disabled?: boolean
}

export function TemplateFieldsEditor({
  documentType,
  fields,
  onChange,
  disabled = false,
}: TemplateFieldsEditorProps) {
  const defaultFields = DOCUMENT_TYPE_SCHEMAS[documentType].fields

  const handleReset = () => {
    onChange(defaultFields.map((f) => ({ ...f })))
  }

  const handleFieldChange = (index: number, updates: Partial<FormFieldDefinition>) => {
    const next = [...fields]
    next[index] = { ...next[index], ...updates }
    onChange(next)
  }

  const handleRemove = (index: number) => {
    const next = fields.filter((_, i) => i !== index)
    onChange(next)
  }

  const handleAdd = () => {
    onChange([
      ...fields,
      { key: `campo_${fields.length + 1}`, label: 'Nuevo campo', type: 'text', required: false },
    ])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label>Campos del formulario</Label>
          <p className="text-sm text-muted-foreground">
            Definí qué campos aparecen en el formulario del Redactor para este tipo de documento.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={disabled}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Usar estructura estándar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={disabled}
          >
            <Plus className="h-4 w-4 mr-1" />
            Agregar campo
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <Card key={index}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Campo {index + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(index)}
                  disabled={disabled || fields.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Clave (para placeholders)</Label>
                  <Input
                    value={field.key}
                    onChange={(e) => handleFieldChange(index, { key: e.target.value })}
                    disabled={disabled}
                    placeholder="actor"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Etiqueta</Label>
                  <Input
                    value={field.label}
                    onChange={(e) => handleFieldChange(index, { label: e.target.value })}
                    disabled={disabled}
                    placeholder="Actor (demandante)"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Tipo</Label>
                  <select
                    value={field.type}
                    onChange={(e) =>
                      handleFieldChange(index, {
                        type: e.target.value as 'text' | 'textarea',
                      })
                    }
                    disabled={disabled}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  >
                    <option value="text">Texto corto</option>
                    <option value="textarea">Área de texto</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={field.required}
                    onCheckedChange={(checked) =>
                      handleFieldChange(index, { required: checked })
                    }
                    disabled={disabled}
                  />
                  <Label className="text-xs">Requerido</Label>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Placeholder (opcional)</Label>
                <Input
                  value={field.placeholder ?? ''}
                  onChange={(e) =>
                    handleFieldChange(index, { placeholder: e.target.value || undefined })
                  }
                  disabled={disabled}
                  placeholder="Datos completos del actor..."
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
