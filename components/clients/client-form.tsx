/**
 * Client Form Component
 * 
 * Reusable form for creating and editing clients.
 * Supports both individual and company client types.
 */
'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { 
  User, 
  Building2, 
  Mail, 
  Phone, 
  MapPin,
  FileDigit,
  Save,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Client, ClientType } from '@/lib/types'

interface ClientFormProps {
  /** Existing client data for editing */
  client?: Client
}

export function ClientForm({ client }: ClientFormProps) {
  const router = useRouter()
  const isEditing = !!client
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clientType, setClientType] = useState<ClientType>(client?.client_type || 'individual')
  
  // Form state
  const [formData, setFormData] = useState({
    name: client?.name || '',
    tax_id: client?.tax_id || '',
    email: client?.email || '',
    phone: client?.phone || '',
    address: client?.address || '',
    city: client?.city || '',
    province: client?.province || '',
    postal_code: client?.postal_code || '',
    notes: client?.notes || '',
  })

  /**
   * Handle form field changes
   */
  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  /**
   * Handle form submission
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido')
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      
      // Parse name field: for individuals split into first_name/last_name, for companies use company_name
      // Do not send `name` - it's a generated column
      const nameParts = formData.name.trim().split(/\s+/)
      const firstName = clientType === 'individual' ? nameParts[0] || '' : null
      const lastName = clientType === 'individual' ? nameParts.slice(1).join(' ') || null : null
      const companyName = clientType === 'company' ? formData.name.trim() : null
      
      const personData = {
        client_type: clientType,
        first_name: firstName,
        last_name: lastName,
        company_name: companyName,
        person_type: 'client' as const,
        cuit: formData.tax_id.trim() || null,
        dni: clientType === 'individual' ? (formData.tax_id.trim() || null) : null,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        province: formData.province.trim() || null,
        postal_code: formData.postal_code.trim() || null,
        notes: formData.notes.trim() || null,
        is_active: true,
      }

      if (isEditing && client) {
        // Update existing person (client)
        const { error } = await supabase
          .from('people')
          .update(personData)
          .eq('id', client.id)

        if (error) throw error
        
        toast.success('Cliente actualizado correctamente')
        router.push(`/clientes/${client.id}`)
      } else {
        // Create new person (client)
        const { data, error } = await supabase
          .from('people')
          .insert(personData)
          .select('id')
          .single()

        if (error) throw error
        
        toast.success('Cliente creado correctamente')
        router.push(`/clientes/${data.id}`)
      }
    } catch (error) {
      console.error('Error saving client:', error)
      toast.error(isEditing ? 'Error al actualizar el cliente' : 'Error al crear el cliente')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Client Type Selection */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Tipo de Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={clientType} 
            onValueChange={(value) => setClientType(value as ClientType)}
            className="grid grid-cols-2 gap-4"
          >
            <Label
              htmlFor="individual"
              className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                clientType === 'individual' 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="individual" id="individual" />
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  clientType === 'individual' ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <User className={`h-5 w-5 ${clientType === 'individual' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">Persona Fisica</p>
                  <p className="text-xs text-muted-foreground">Cliente individual</p>
                </div>
              </div>
            </Label>

            <Label
              htmlFor="company"
              className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                clientType === 'company' 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <RadioGroupItem value="company" id="company" />
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  clientType === 'company' ? 'bg-primary/10' : 'bg-muted'
                }`}>
                  <Building2 className={`h-5 w-5 ${clientType === 'company' ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">Persona Juridica</p>
                  <p className="text-xs text-muted-foreground">Empresa u organizacion</p>
                </div>
              </div>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Basic Information */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            {clientType === 'company' ? (
              <Building2 className="h-4 w-4 text-muted-foreground" />
            ) : (
              <User className="h-4 w-4 text-muted-foreground" />
            )}
            Informacion Basica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                {clientType === 'company' ? 'Razon Social' : 'Nombre Completo'} *
              </Label>
              <Input
                id="name"
                placeholder={clientType === 'company' ? 'Empresa S.A.' : 'Juan Perez'}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_id">
                {clientType === 'company' ? 'CUIT' : 'CUIL / DNI'}
              </Label>
              <div className="relative">
                <FileDigit className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tax_id"
                  placeholder={clientType === 'company' ? '30-12345678-9' : '20-12345678-9'}
                  value={formData.tax_id}
                  onChange={(e) => handleChange('tax_id', e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electronico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+54 351 123-4567"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Domicilio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Direccion</Label>
            <Input
              id="address"
              placeholder="Av. Colon 1234, Piso 5, Of. A"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                placeholder="Cordoba"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="province">Provincia</Label>
              <Input
                id="province"
                placeholder="Cordoba"
                value={formData.province}
                onChange={(e) => handleChange('province', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postal_code">Codigo Postal</Label>
              <Input
                id="postal_code"
                placeholder="5000"
                value={formData.postal_code}
                onChange={(e) => handleChange('postal_code', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">
            Observaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            id="notes"
            placeholder="Notas adicionales sobre el cliente..."
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={4}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-4">
        <Button 
          type="button" 
          variant="outline"
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Guardando...' : 'Creando...'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditing ? 'Guardar Cambios' : 'Crear Cliente'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
