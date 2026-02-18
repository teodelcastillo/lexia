'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface CaseDescriptionCardProps {
  caseId: string
  description: string | null
  canEdit: boolean
}

/**
 * Card that displays the case description with an optional
 * "Actualizar descripción" button to progressively update it
 * using AI and current case context.
 */
export function CaseDescriptionCard({
  caseId,
  description,
  canEdit,
}: CaseDescriptionCardProps) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)

  async function handleUpdateDescription() {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/cases/${caseId}/update-description`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al actualizar')
      toast.success('Descripción actualizada correctamente')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar la descripción')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className="border-border/60 lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Descripción del Caso
          </CardTitle>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUpdateDescription}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span className="ml-1.5">
                {isUpdating ? 'Actualizando...' : 'Actualizar descripción'}
              </span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {description ? (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {description}
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              No se ha agregado una descripción para este caso
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canEdit
                ? 'Use «Actualizar descripción» para generarla desde el contexto del caso'
                : 'Agregue una descripción para documentar los detalles del caso'}
            </p>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleUpdateDescription}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="ml-1.5">Generar descripción</span>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
