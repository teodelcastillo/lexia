'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  getFieldsForDocumentType,
  getSchemaForDocumentType,
  type DocumentType,
} from '@/lib/ai/draft-schemas'

interface RedactorFormProps {
  documentType: DocumentType
  onBack: () => void
  onSubmit: (formData: Record<string, string>) => void
  isSubmitting?: boolean
}

export function RedactorForm({
  documentType,
  onBack,
  onSubmit,
  isSubmitting = false,
}: RedactorFormProps) {
  const schema = getSchemaForDocumentType(documentType)
  const fields = getFieldsForDocumentType(documentType)

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: fields.reduce(
      (acc, f) => ({ ...acc, [f.key]: '' }),
      {} as Record<string, string>
    ),
  })

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data as Record<string, string>)
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver
        </Button>
      </div>

      <div className="space-y-4">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={field.key}>
              {field.label}
              {field.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {field.type === 'textarea' ? (
              <Textarea
                id={field.key}
                placeholder={field.placeholder}
                disabled={isSubmitting}
                className="min-h-[100px]"
                {...form.register(field.key)}
              />
            ) : (
              <Input
                id={field.key}
                placeholder={field.placeholder}
                disabled={isSubmitting}
                {...form.register(field.key)}
              />
            )}
            {form.formState.errors[field.key] && (
              <p className="text-sm text-destructive">
                {form.formState.errors[field.key]?.message as string}
              </p>
            )}
          </div>
        ))}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generando borrador...
          </>
        ) : (
          'Generar borrador'
        )}
      </Button>
    </form>
  )
}
