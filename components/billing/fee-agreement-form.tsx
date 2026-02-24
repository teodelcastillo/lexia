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
import { feeAgreementTypeConfig } from '@/lib/types'
import type { FeeAgreementType } from '@/lib/types/database'

interface FeeAgreementFormProps {
  clients: Array<{ id: string; first_name: string | null; last_name: string | null; company_name: string | null; client_type: string }>
  companies: Array<{ id: string; company_name: string }>
  cases: Array<{ id: string; title: string; case_number: string }>
  userId: string
}

const TERM_FIELDS: Record<FeeAgreementType, string[]> = {
  monthly_retainer: ['amount', 'billing_day', 'includes'],
  retainer_plus_task: ['base_amount', 'task_rates'],
  custom_quote: ['quoted_amount', 'description'],
  per_consultation: ['rate_per_consultation'],
  hourly: ['rate_per_hour'],
  judicial_regulation: ['percentage_of_regulated', 'minimum'],
  hybrid: ['description'],
}

export function FeeAgreementForm({ clients, companies, cases, userId }: FeeAgreementFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [type, setType] = useState<FeeAgreementType>('monthly_retainer')
  const [formData, setFormData] = useState({
    client_id: '',
    company_id: '',
    case_id: '',
    currency: 'ARS',
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: '',
    notes: '',
  })
  const [terms, setTerms] = useState<Record<string, any>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.client_id && !formData.company_id) {
      toast.error('Debe seleccionar un cliente o empresa')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('fee_agreements').insert({
      client_id: formData.client_id || null,
      company_id: formData.company_id || null,
      case_id: formData.case_id || null,
      type,
      currency: formData.currency,
      valid_from: formData.valid_from,
      valid_until: formData.valid_until || null,
      terms,
      notes: formData.notes || null,
      created_by: userId,
    })

    setLoading(false)
    if (error) {
      toast.error('Error al crear acuerdo: ' + error.message)
    } else {
      toast.success('Acuerdo creado exitosamente')
      router.push('/facturacion/acuerdos')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos del Acuerdo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Cliente (persona)</Label>
              <Select value={formData.client_id} onValueChange={(v) => setFormData(prev => ({ ...prev, client_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente directo</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.client_type === 'company' ? c.company_name : `${c.first_name} ${c.last_name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={formData.company_id} onValueChange={(v) => setFormData(prev => ({ ...prev, company_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empresa..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin empresa</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo de Acuerdo</Label>
              <Select value={type} onValueChange={(v) => { setType(v as FeeAgreementType); setTerms({}) }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(feeAgreementTypeConfig) as [FeeAgreementType, { label: string; description: string }][]).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {feeAgreementTypeConfig[type]?.description}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData(prev => ({ ...prev, currency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS (Peso Argentino)</SelectItem>
                  <SelectItem value="USD">USD (Dólar)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Causa (opcional)</Label>
              <Select value={formData.case_id} onValueChange={(v) => setFormData(prev => ({ ...prev, case_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin causa vinculada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin causa vinculada</SelectItem>
                  {cases.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.case_number} - {c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Vigencia desde</Label>
              <Input
                type="date"
                value={formData.valid_from}
                onChange={(e) => setFormData(prev => ({ ...prev, valid_from: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Vigencia hasta (opcional)</Label>
              <Input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData(prev => ({ ...prev, valid_until: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Términos: {feeAgreementTypeConfig[type]?.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {type === 'monthly_retainer' && (
            <>
              <div className="space-y-2">
                <Label>Monto mensual</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="150000"
                  value={terms.amount || ''}
                  onChange={(e) => setTerms(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Día de facturación</Label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  placeholder="1"
                  value={terms.billing_day || ''}
                  onChange={(e) => setTerms(prev => ({ ...prev, billing_day: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Servicios incluidos</Label>
                <Textarea
                  placeholder="consultas, seguimiento, etc."
                  value={terms.includes || ''}
                  onChange={(e) => setTerms(prev => ({ ...prev, includes: e.target.value }))}
                />
              </div>
            </>
          )}

          {type === 'retainer_plus_task' && (
            <>
              <div className="space-y-2">
                <Label>Monto base mensual</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="80000"
                  value={terms.base_amount || ''}
                  onChange={(e) => setTerms(prev => ({ ...prev, base_amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tarifas por tarea (JSON)</Label>
                <Textarea
                  placeholder='[{"type": "demanda", "amount": 50000}, {"type": "apelacion", "amount": 30000}]'
                  value={terms.task_rates ? JSON.stringify(terms.task_rates) : ''}
                  onChange={(e) => {
                    try {
                      setTerms(prev => ({ ...prev, task_rates: JSON.parse(e.target.value) }))
                    } catch {
                      /* allow partial input */
                    }
                  }}
                  rows={4}
                />
              </div>
            </>
          )}

          {type === 'custom_quote' && (
            <>
              <div className="space-y-2">
                <Label>Monto presupuestado</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="200000"
                  value={terms.quoted_amount || ''}
                  onChange={(e) => setTerms(prev => ({ ...prev, quoted_amount: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción del trabajo</Label>
                <Textarea
                  placeholder="Descripción del trabajo presupuestado..."
                  value={terms.description || ''}
                  onChange={(e) => setTerms(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </>
          )}

          {type === 'per_consultation' && (
            <div className="space-y-2">
              <Label>Tarifa por consulta</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="25000"
                value={terms.rate_per_consultation || ''}
                onChange={(e) => setTerms(prev => ({ ...prev, rate_per_consultation: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          )}

          {type === 'hourly' && (
            <div className="space-y-2">
              <Label>Tarifa por hora</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="15000"
                value={terms.rate_per_hour || ''}
                onChange={(e) => setTerms(prev => ({ ...prev, rate_per_hour: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          )}

          {type === 'judicial_regulation' && (
            <>
              <div className="space-y-2">
                <Label>Porcentaje sobre regulados (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="30"
                  value={terms.percentage_of_regulated || ''}
                  onChange={(e) => setTerms(prev => ({ ...prev, percentage_of_regulated: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Mínimo</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="50000"
                  value={terms.minimum || ''}
                  onChange={(e) => setTerms(prev => ({ ...prev, minimum: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </>
          )}

          {type === 'hybrid' && (
            <div className="space-y-2">
              <Label>Descripción del acuerdo híbrido</Label>
              <Textarea
                placeholder="Detalle las condiciones combinadas..."
                value={terms.description || ''}
                onChange={(e) => setTerms(prev => ({ ...prev, description: e.target.value }))}
                rows={6}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label>Notas adicionales</Label>
            <Textarea
              placeholder="Observaciones o condiciones especiales..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Crear Acuerdo'}
        </Button>
      </div>
    </form>
  )
}
