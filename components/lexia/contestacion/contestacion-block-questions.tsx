'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  DemandBlock,
  BlockQuestion,
  BlockResponse,
} from '@/lib/lexia/contestacion/types'

const POSTURA_OPTIONS = [
  { value: 'admitir', label: 'Admitir' },
  { value: 'negar', label: 'Negar' },
  { value: 'admitir_parcial', label: 'Admitir parcialmente' },
  { value: 'negar_con_matices', label: 'Negar con matices' },
  { value: 'sin_posicion', label: 'No tomar posición' },
] as const

interface ContestacionBlockQuestionsProps {
  bloque: DemandBlock
  preguntas: BlockQuestion[]
  response: BlockResponse | undefined
  onChange: (response: BlockResponse) => void
  isPending?: boolean
  bloqueIdsPendientes?: string[]
}

export function ContestacionBlockQuestions({
  bloque,
  preguntas,
  response,
  onChange,
  isPending = false,
  bloqueIdsPendientes = [],
}: ContestacionBlockQuestionsProps) {
  const isHighlighted = bloqueIdsPendientes.includes(bloque.id)
  const preguntasForBlock = preguntas.filter((p) => p.bloque_id === bloque.id)

  return (
    <div
      className={`rounded-lg border p-4 ${
        isHighlighted ? 'border-amber-500/50 bg-amber-500/5' : 'border-border bg-background'
      }`}
    >
      <h3 className="font-medium text-sm mb-3">
        {bloque.orden}. {bloque.titulo}
      </h3>
      {preguntasForBlock.map((p) => (
        <p key={`${p.bloque_id}-${p.pregunta}`} className="text-sm text-muted-foreground mb-2">
          {p.pregunta}
        </p>
      ))}
      <div className="space-y-3 mt-3">
        <div>
          <Label className="text-xs">Postura</Label>
          <Select
            value={response?.postura ?? ''}
            onValueChange={(v) =>
              onChange({
                bloque_id: bloque.id,
                postura: v as BlockResponse['postura'],
                fundamentacion: response?.fundamentacion,
                prueba_ofrecida: response?.prueba_ofrecida,
              })
            }
            disabled={isPending}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue placeholder="Elegir postura..." />
            </SelectTrigger>
            <SelectContent>
              {POSTURA_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Fundamentación</Label>
          <Textarea
            value={response?.fundamentacion ?? ''}
            onChange={(e) =>
              onChange({
                bloque_id: bloque.id,
                postura: response?.postura ?? 'admitir',
                fundamentacion: e.target.value,
                prueba_ofrecida: response?.prueba_ofrecida,
              })
            }
            placeholder="Argumentos y fundamentos..."
            className="mt-1 min-h-[80px] text-sm"
            disabled={isPending}
          />
        </div>
        <div>
          <Label className="text-xs">Prueba a ofrecer (separar por coma o línea)</Label>
          <Textarea
            value={(response?.prueba_ofrecida ?? []).join('\n')}
            onChange={(e) => {
              const lines = e.target.value
                .split(/[,\n]/)
                .map((s) => s.trim())
                .filter(Boolean)
              onChange({
                bloque_id: bloque.id,
                postura: response?.postura ?? 'admitir',
                fundamentacion: response?.fundamentacion,
                prueba_ofrecida: lines,
              })
            }}
            placeholder="Documentos, testigos, informes..."
            className="mt-1 min-h-[60px] text-sm"
            disabled={isPending}
          />
        </div>
      </div>
    </div>
  )
}
