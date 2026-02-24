'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface BillingSettingsFormProps {
  settings: any
  organizationId: string
}

export function BillingSettingsForm({ settings, organizationId }: BillingSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    default_currency: settings?.default_currency || 'ARS',
    invoice_prefix: settings?.invoice_prefix || 'FAC',
    default_tax_rate: settings?.default_tax_rate?.toString() || '21',
    default_payment_terms_days: settings?.default_payment_terms_days?.toString() || '30',
    default_participation_studio_assigned: settings?.default_participation_studio_assigned?.toString() || '30',
    default_participation_lawyer_recruited: settings?.default_participation_lawyer_recruited?.toString() || '20',
    current_jus_value: settings?.current_jus_value?.toString() || '',
    jus_currency: settings?.jus_currency || 'ARS',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const payload = {
      organization_id: organizationId,
      default_currency: formData.default_currency,
      invoice_prefix: formData.invoice_prefix,
      default_tax_rate: parseFloat(formData.default_tax_rate),
      default_payment_terms_days: parseInt(formData.default_payment_terms_days),
      default_participation_studio_assigned: parseFloat(formData.default_participation_studio_assigned),
      default_participation_lawyer_recruited: parseFloat(formData.default_participation_lawyer_recruited),
      current_jus_value: formData.current_jus_value ? parseFloat(formData.current_jus_value) : null,
      jus_currency: formData.jus_currency,
    }

    let error
    if (settings?.id) {
      const result = await supabase
        .from('organization_billing_settings')
        .update(payload)
        .eq('id', settings.id)
      error = result.error
    } else {
      const result = await supabase
        .from('organization_billing_settings')
        .insert(payload)
      error = result.error
    }

    setLoading(false)
    if (error) {
      toast.error('Error al guardar: ' + error.message)
    } else {
      toast.success('Configuración guardada')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Facturación</CardTitle>
          <CardDescription>Configuración general de facturación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Moneda predeterminada</Label>
              <Select value={formData.default_currency} onValueChange={(v) => setFormData(prev => ({ ...prev, default_currency: v }))}>
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
              <Label>Prefijo de factura</Label>
              <Input
                value={formData.invoice_prefix}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_prefix: e.target.value }))}
                placeholder="FAC"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tasa IVA predeterminada (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.default_tax_rate}
                onChange={(e) => setFormData(prev => ({ ...prev, default_tax_rate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Días de pago por defecto</Label>
              <Input
                type="number"
                value={formData.default_payment_terms_days}
                onChange={(e) => setFormData(prev => ({ ...prev, default_payment_terms_days: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participaciones</CardTitle>
          <CardDescription>Porcentajes predeterminados de participación</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Asignado por estudio (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.default_participation_studio_assigned}
                onChange={(e) => setFormData(prev => ({ ...prev, default_participation_studio_assigned: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Porcentaje que cobra el abogado cuando el estudio le asigna una causa
              </p>
            </div>
            <div className="space-y-2">
              <Label>Captado por abogado (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.default_participation_lawyer_recruited}
                onChange={(e) => setFormData(prev => ({ ...prev, default_participation_lawyer_recruited: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Retención del estudio cuando el abogado trae al cliente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valor del JUS</CardTitle>
          <CardDescription>Unidad de medida para honorarios judiciales de Córdoba</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Valor actual del JUS</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.current_jus_value}
                onChange={(e) => setFormData(prev => ({ ...prev, current_jus_value: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Moneda del JUS</Label>
              <Select value={formData.jus_currency} onValueChange={(v) => setFormData(prev => ({ ...prev, jus_currency: v }))}>
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
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </form>
  )
}
