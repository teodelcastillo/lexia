'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

interface InvoiceGeneratorProps {
  approvedItems: any[]
  settings: any
  userId: string
}

export function InvoiceGenerator({ approvedItems, settings, userId }: InvoiceGeneratorProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [taxRate, setTaxRate] = useState(settings?.default_tax_rate?.toString() || '21')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const clientGroups = useMemo(() => {
    const groups: Record<string, { name: string; items: any[] }> = {}
    for (const item of approvedItems) {
      const clientId = item.client_id
      if (!groups[clientId]) {
        const name = item.people?.client_type === 'company'
          ? item.people?.company_name
          : `${item.people?.first_name} ${item.people?.last_name}`
        groups[clientId] = { name, items: [] }
      }
      groups[clientId].items.push(item)
    }
    return groups
  }, [approvedItems])

  const currentItems = selectedClient ? (clientGroups[selectedClient]?.items || []) : []

  const selectedItems = currentItems.filter(item => selectedIds.has(item.id))
  const subtotal = selectedItems.reduce((sum, item) => sum + (item.line_total || 0), 0)
  const taxAmount = subtotal * (parseFloat(taxRate) || 0) / 100
  const total = subtotal + taxAmount

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === currentItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(currentItems.map(i => i.id)))
    }
  }

  const handleGenerate = async () => {
    if (selectedItems.length === 0) {
      toast.error('Seleccione al menos un concepto')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const firstItem = selectedItems[0]
    const period = firstItem?.period || null

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        client_id: selectedClient,
        invoice_number: `TEMP-${Date.now()}`,
        issue_date: new Date().toISOString().split('T')[0],
        due_date: dueDate || null,
        subtotal,
        tax_rate: parseFloat(taxRate) || 0,
        tax_amount: taxAmount,
        total,
        currency: firstItem?.currency || 'ARS',
        period,
        notes: notes || null,
        created_by: userId,
      })
      .select('id')
      .single()

    if (invoiceError || !invoice) {
      setLoading(false)
      toast.error('Error al crear factura: ' + (invoiceError?.message || 'Error desconocido'))
      return
    }

    const { error: updateError } = await supabase
      .from('billing_items')
      .update({ invoice_id: invoice.id, status: 'invoiced' })
      .in('id', selectedItems.map(i => i.id))

    if (updateError) {
      setLoading(false)
      toast.error('Error al vincular conceptos: ' + updateError.message)
      return
    }

    const { error: movementError } = await supabase
      .from('account_movements')
      .insert({
        client_id: selectedClient,
        type: 'invoice',
        amount: total,
        currency: firstItem?.currency || 'ARS',
        movement_date: new Date().toISOString().split('T')[0],
        reference_id: invoice.id,
        reference_type: 'invoice',
        invoice_id: invoice.id,
        notes: `Factura generada`,
        created_by: userId,
      })

    setLoading(false)
    if (movementError) {
      toast.error('Factura creada pero error en movimiento: ' + movementError.message)
    } else {
      toast.success('Factura generada exitosamente')
    }
    router.push(`/facturacion/facturas/${invoice.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Cliente</CardTitle>
          <CardDescription>Elija el cliente para agrupar conceptos en una factura</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedClient} onValueChange={(v) => { setSelectedClient(v); setSelectedIds(new Set()) }}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Seleccionar cliente..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(clientGroups).map(([id, group]) => (
                <SelectItem key={id} value={id}>
                  {group.name} ({group.items.length} conceptos)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedClient && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Conceptos Aprobados</CardTitle>
                  <CardDescription>
                    {selectedIds.size} de {currentItems.length} seleccionados
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={selectAll}>
                  {selectedIds.size === currentItems.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentItems.map((item: any) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedIds.has(item.id) ? 'bg-primary/5 border-primary/20' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => toggleItem(item.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.cases?.case_number && `${item.cases.case_number} · `}
                        {item.period || 'Sin período'}
                      </p>
                    </div>
                    <span className="text-sm font-medium">
                      ${item.line_total?.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumen de Factura</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tasa de IVA (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de vencimiento</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  placeholder="Notas para la factura..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({selectedItems.length} conceptos)</span>
                  <span>${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>IVA ({taxRate}%)</span>
                  <span>${taxAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => router.back()}>
                  Cancelar
                </Button>
                <Button onClick={handleGenerate} disabled={loading || selectedItems.length === 0}>
                  {loading ? 'Generando...' : 'Generar Factura'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {Object.keys(clientGroups).length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No hay conceptos aprobados pendientes de facturación
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
