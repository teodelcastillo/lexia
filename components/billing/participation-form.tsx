'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { participationTypeConfig } from '@/lib/types'
import type { ParticipationType } from '@/lib/types/database'

interface ParticipationFormProps {
  caseId: string
  lawyers: Array<{ id: string; first_name: string; last_name: string }>
  defaultPercentages: {
    studio_assigned: number
    lawyer_recruited: number
  }
}

export function ParticipationForm({ caseId, lawyers, defaultPercentages }: ParticipationFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    lawyer_id: '',
    participation_type: 'studio_assigned' as ParticipationType,
    percentage: defaultPercentages.studio_assigned.toString(),
    base_amount: '',
    notes: '',
  })

  const handleTypeChange = (type: ParticipationType) => {
    setFormData(prev => ({
      ...prev,
      participation_type: type,
      percentage: (type === 'studio_assigned'
        ? defaultPercentages.studio_assigned
        : defaultPercentages.lawyer_recruited
      ).toString(),
    }))
  }

  const calculatedAmount = formData.base_amount
    ? (parseFloat(formData.base_amount) * parseFloat(formData.percentage) / 100)
    : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.lawyer_id) {
      toast.error('Debe seleccionar un abogado')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('case_participations').insert({
      case_id: caseId,
      lawyer_id: formData.lawyer_id,
      participation_type: formData.participation_type,
      percentage: parseFloat(formData.percentage),
      base_amount: formData.base_amount ? parseFloat(formData.base_amount) : null,
      calculated_amount: calculatedAmount || null,
      notes: formData.notes || null,
    })

    setLoading(false)
    if (error) {
      toast.error('Error al crear participación: ' + error.message)
    } else {
      toast.success('Participación registrada')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Nueva Participación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Abogado</Label>
              <Select value={formData.lawyer_id} onValueChange={(v) => setFormData(prev => ({ ...prev, lawyer_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar abogado..." />
                </SelectTrigger>
                <SelectContent>
                  {lawyers.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.first_name} {l.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de participación</Label>
              <Select
                value={formData.participation_type}
                onValueChange={(v) => handleTypeChange(v as ParticipationType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(participationTypeConfig) as [ParticipationType, { label: string; description: string }][]).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {participationTypeConfig[formData.participation_type]?.description}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Porcentaje (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.percentage}
                onChange={(e) => setFormData(prev => ({ ...prev, percentage: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Monto base ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.base_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, base_amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Calculado</Label>
              <div className="rounded-md border px-3 py-2 text-sm bg-muted">
                ${calculatedAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              placeholder="Observaciones..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Registrar Participación'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
