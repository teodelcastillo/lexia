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
import { billingItemTypeConfig } from '@/lib/types'
import type { BillingItemType } from '@/lib/types/database'

interface BillingItemFormProps {
  clients: Array<{ id: string; first_name: string | null; last_name: string | null; company_name: string | null; client_type: string }>
  cases: Array<{ id: string; title: string; case_number: string; client_id: string | null }>
  agreements: Array<{ id: string; type: string; client_id: string | null; company_id: string | null; currency: string }>
  userId: string
}

export function BillingItemForm({ clients, cases, agreements, userId }: BillingItemFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const now = new Date()
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [formData, setFormData] = useState({
    client_id: '',
    case_id: '',
    fee_agreement_id: '',
    type: 'monthly_fee' as BillingItemType,
    description: '',
    amount: '',
    quantity: '1',
    currency: 'ARS',
    period: currentPeriod,
  })

  const filteredAgreements = formData.client_id
    ? agreements.filter(a => a.client_id === formData.client_id)
    : agreements

  const filteredCases = formData.client_id
    ? cases.filter(c => c.client_id === formData.client_id)
    : cases

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.client_id) {
      toast.error('Debe seleccionar un cliente')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error } = await supabase.from('billing_items').insert({
      client_id: formData.client_id,
      case_id: formData.case_id || null,
      fee_agreement_id: formData.fee_agreement_id || null,
      type: formData.type,
      description: formData.description,
      amount: parseFloat(formData.amount),
      quantity: parseFloat(formData.quantity) || 1,
      currency: formData.currency,
      period: formData.period || null,
      created_by: userId,
    })

    setLoading(false)
    if (error) {
      toast.error('Error al crear concepto: ' + error.message)
    } else {
      toast.success('Concepto cargado exitosamente')
      router.push('/facturacion/items')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Datos del Concepto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select
              value={formData.client_id}
              onValueChange={(v) => setFormData(prev => ({ ...prev, client_id: v, case_id: '', fee_agreement_id: '' }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.client_type === 'company' ? c.company_name : `${c.first_name} ${c.last_name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Causa (opcional)</Label>
              <Select value={formData.case_id} onValueChange={(v) => setFormData(prev => ({ ...prev, case_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin causa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin causa vinculada</SelectItem>
                  {filteredCases.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.case_number} - {c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Acuerdo de honorarios (opcional)</Label>
              <Select value={formData.fee_agreement_id} onValueChange={(v) => setFormData(prev => ({ ...prev, fee_agreement_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin acuerdo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin acuerdo vinculado</SelectItem>
                  {filteredAgreements.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {billingItemTypeConfig[a.type as keyof typeof billingItemTypeConfig]?.label || a.type} ({a.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de concepto</Label>
              <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v as BillingItemType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(billingItemTypeConfig) as [string, { label: string }][]).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Período</Label>
              <Input
                type="month"
                value={formData.period}
                onChange={(e) => setFormData(prev => ({ ...prev, period: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descripción *</Label>
            <Textarea
              placeholder="Descripción del concepto a cobrar..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Monto unitario *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select value={formData.currency} onValueChange={(v) => setFormData(prev => ({ ...prev, currency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">ARS</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.amount && formData.quantity && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-bold">
                {formData.currency} {(parseFloat(formData.amount) * parseFloat(formData.quantity)).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Cargar Concepto'}
        </Button>
      </div>
    </form>
  )
}
