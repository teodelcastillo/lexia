'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validateCUIT, validateEmail, validatePhone } from '@/lib/utils/validation'
import { createValidationError, getErrorMessage } from '@/lib/utils/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle, Building2, FileDigit, Globe, MapPin, Briefcase, Mail } from 'lucide-react'

// Legal forms common in Argentina
const legalFormOptions = [
  { value: 'SA', label: 'Sociedad Anónima (SA)' },
  { value: 'SRL', label: 'Sociedad de Responsabilidad Limitada (SRL)' },
  { value: 'SAS', label: 'Sociedad por Acciones Simplificada (SAS)' },
  { value: 'SCA', label: 'Sociedad en Comandita por Acciones (SCA)' },
  { value: 'SCS', label: 'Sociedad en Comandita Simple (SCS)' },
  { value: 'Unipersonal', label: 'Empresa Unipersonal' },
  { value: 'Cooperativa', label: 'Cooperativa' },
  { value: 'Asociacion', label: 'Asociación Civil' },
  { value: 'Fundacion', label: 'Fundación' },
  { value: 'Otro', label: 'Otro' },
]

// Common industries in Argentina
const industryOptions = [
  { value: 'Servicios Legales', label: 'Servicios Legales' },
  { value: 'Comercio', label: 'Comercio' },
  { value: 'Manufactura', label: 'Manufactura' },
  { value: 'Construccion', label: 'Construcción' },
  { value: 'Tecnologia', label: 'Tecnología' },
  { value: 'Salud', label: 'Salud' },
  { value: 'Educacion', label: 'Educación' },
  { value: 'Finanzas', label: 'Finanzas' },
  { value: 'Inmobiliaria', label: 'Inmobiliaria' },
  { value: 'Transporte', label: 'Transporte' },
  { value: 'Agricultura', label: 'Agricultura' },
  { value: 'Ganaderia', label: 'Ganadería' },
  { value: 'Mineria', label: 'Minería' },
  { value: 'Energia', label: 'Energía' },
  { value: 'Turismo', label: 'Turismo' },
  { value: 'Otro', label: 'Otro' },
]

interface CreateCompanyFormProps {
  organizationId?: string | null
}

export function CreateCompanyForm({ organizationId }: CreateCompanyFormProps = {}) {
  const router = useRouter()
  const supabase = createClient()
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    company_name: '',
    company_type: 'client' as 'client' | 'supplier',
    legal_name: '',
    cuit: '',
    tax_id: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    province: '',
    postal_code: '',
    country: 'Argentina',
    industry: '',
    legal_form: '',
    notes: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Validations
      if (!formData.company_name?.trim()) {
        throw createValidationError('El nombre de la empresa es requerido', 'Nombre de empresa')
      }

      // Validate CUIT if provided
      if (formData.cuit?.trim()) {
        if (!validateCUIT(formData.cuit.trim())) {
          throw createValidationError('El CUIT ingresado no es válido. Debe tener formato XX-XXXXXXXX-X', 'CUIT')
        }
      }

      // Validate email if provided
      if (formData.email?.trim()) {
        if (!validateEmail(formData.email.trim())) {
          throw createValidationError('El email ingresado no es válido', 'Email')
        }
      }

      // Validate phone if provided
      if (formData.phone?.trim()) {
        if (!validatePhone(formData.phone.trim())) {
          throw createValidationError('El teléfono ingresado no es válido', 'Teléfono')
        }
      }

      // Insert company (do not send `name` - it is a generated column: COALESCE(company_name, legal_name))
      // organization_id will be auto-assigned by trigger, but we include it explicitly if available
      const insertData: any = {
        company_name: formData.company_name.trim(),
        company_type: formData.company_type,
        legal_name: formData.legal_name?.trim() || null,
        cuit: formData.cuit?.trim() || null,
        tax_id: formData.tax_id?.trim() || null,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        website: formData.website?.trim() || null,
        address: formData.address?.trim() || null,
        city: formData.city?.trim() || null,
        province: formData.province?.trim() || null,
        postal_code: formData.postal_code?.trim() || null,
        country: formData.country?.trim() || 'Argentina',
        industry: formData.industry?.trim() || null,
        legal_form: formData.legal_form?.trim() || null,
        notes: formData.notes?.trim() || null,
      }

      // Include organization_id if provided (trigger will handle it if not)
      if (organizationId) {
        insertData.organization_id = organizationId
      }

      const { data: newCompany, error: insertError } = await supabase
        .from('companies')
        .insert([insertData])
        .select()
        .single()

      if (insertError) throw insertError
      if (!newCompany) throw new Error('Error al crear la empresa')

      // Redirect to company detail
      router.push(`/empresas/${newCompany.id}`)
    } catch (err) {
      console.error('[CreateCompanyForm] Error creating company:', err)
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Empresa</h1>
        <p className="mt-2 text-muted-foreground">
          Registra una nueva empresa en el sistema
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información de la Empresa</CardTitle>
          <CardDescription>
            Completa los datos de la empresa. El nombre es obligatorio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Company Name Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Building2 className="h-4 w-4" />
                Información de la Empresa
              </div>

              <div className="space-y-2">
                <Label>Tipo de compañía</Label>
                <Select
                  value={formData.company_type}
                  onValueChange={(value: 'client' | 'supplier') =>
                    setFormData((prev) => ({ ...prev, company_type: value }))
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Cliente</SelectItem>
                    <SelectItem value="supplier">Proveedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company_name">
                    Nombre de la Empresa *
                  </Label>
                  <Input
                    id="company_name"
                    name="company_name"
                    placeholder="Ej: Empresa S.A."
                    value={formData.company_name}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="legal_name">
                    Razón Social
                  </Label>
                  <Input
                    id="legal_name"
                    name="legal_name"
                    placeholder="Ej: Empresa S.A. - Razón Social Completa"
                    value={formData.legal_name}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Nombre legal completo registrado
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cuit">
                    CUIT
                  </Label>
                  <div className="relative">
                    <FileDigit className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="cuit"
                      name="cuit"
                      placeholder="30-12345678-9"
                      value={formData.cuit}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="pl-9"
                      maxLength={13}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato: XX-XXXXXXXX-X
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_id">
                    ID Fiscal (Opcional)
                  </Label>
                  <Input
                    id="tax_id"
                    name="tax_id"
                    placeholder="ID fiscal genérico"
                    value={formData.tax_id}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="legal_form">
                    Forma Legal
                  </Label>
                  <Select 
                    value={formData.legal_form} 
                    onValueChange={(value) => handleSelectChange('legal_form', value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar forma legal" />
                    </SelectTrigger>
                    <SelectContent>
                      {legalFormOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="industry">
                    Rubro/Industria
                  </Label>
                  <Select 
                    value={formData.industry} 
                    onValueChange={(value) => handleSelectChange('industry', value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar rubro" />
                    </SelectTrigger>
                    <SelectContent>
                      {industryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Contact Information Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Mail className="h-4 w-4" />
                Información de Contacto
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="contacto@empresa.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="+54 9 1123456789"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Sitio Web</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="website"
                    name="website"
                    type="url"
                    placeholder="https://www.empresa.com"
                    value={formData.website}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MapPin className="h-4 w-4" />
                Dirección
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  name="address"
                  placeholder="Calle 123, Piso 4, Oficina A"
                  value={formData.address}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    name="city"
                    placeholder="Córdoba"
                    value={formData.city}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="province">Provincia</Label>
                  <Input
                    id="province"
                    name="province"
                    placeholder="Córdoba"
                    value={formData.province}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postal_code">Código Postal</Label>
                  <Input
                    id="postal_code"
                    name="postal_code"
                    placeholder="5000"
                    value={formData.postal_code}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <Input
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="notes">
                  Notas Adicionales
                </Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Información adicional sobre la empresa..."
                  rows={4}
                  value={formData.notes}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Creando...' : 'Crear Empresa'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
