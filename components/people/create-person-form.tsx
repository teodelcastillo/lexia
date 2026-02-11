'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validateCUIT, validateDNI, validateEmail, validatePhone } from '@/lib/utils/validation'
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
import { Loader2, AlertCircle, User, Building2, MapPin, FileDigit, Phone, Briefcase } from 'lucide-react'
import type { PersonType } from '@/lib/types'

interface Company {
  id: string
  company_name: string | null
  name: string | null
}

const personTypeOptions: { value: PersonType; label: string }[] = [
  { value: 'client', label: 'Cliente' },
  { value: 'judge', label: 'Juez' },
  { value: 'opposing_lawyer', label: 'Abogado Contraparte' },
  { value: 'prosecutor', label: 'Fiscal' },
  { value: 'expert', label: 'Perito' },
  { value: 'witness', label: 'Testigo' },
  { value: 'notary', label: 'Escribano' },
]

const companyRoleOptions = [
  { value: 'legal_representative', label: 'Representante Legal' },
  { value: 'attorney', label: 'Apoderado' },
  { value: 'contact', label: 'Contacto' },
  { value: 'shareholder', label: 'Accionista' },
  { value: 'director', label: 'Director' },
  { value: 'other', label: 'Otro' },
]

// Note: The enum in DB uses 'attorney' but the label mapping uses 'proxy'
// We'll use 'attorney' to match the DB enum

interface CreatePersonFormProps {
  preselectedCompanyId?: string
  organizationId?: string | null
}

export function CreatePersonForm({ preselectedCompanyId, organizationId }: CreatePersonFormProps = {}) {
  const router = useRouter()
  const supabase = createClient()
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)

  // Get company_id from props (passed from server component)
  const initialCompanyId = preselectedCompanyId || 'defaultCompany'

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    secondary_phone: '',
    person_type: 'client' as PersonType,
    company_id: initialCompanyId,
    company_role: '' as string,
    cuit: '',
    dni: '',
    address: '',
    city: '',
    province: '',
    postal_code: '',
    notes: '',
  })

  // Load companies on mount (filtered by organization)
  useEffect(() => {
    const loadCompanies = async () => {
      setIsLoadingCompanies(true)
      try {
        const query = supabase
          .from('companies')
          .select('id, company_name, name')
          .order('company_name')

        // Filter by organization if provided
        if (organizationId) {
          query.eq('organization_id', organizationId)
        }

        const { data, error } = await query

        if (error) throw error
        setCompanies(data || [])
        
        // If preselectedCompanyId, find and set the company
        if (initialCompanyId && initialCompanyId !== 'defaultCompany') {
          const company = data?.find(c => c.id === initialCompanyId)
          if (company) {
            setSelectedCompany(company)
            // Update formData to ensure company_id is set
            setFormData(prev => ({ ...prev, company_id: initialCompanyId }))
          }
        }
      } catch (err) {
        console.error('[v0] Error loading companies:', err)
      } finally {
        setIsLoadingCompanies(false)
      }
    }

    loadCompanies()
  }, [initialCompanyId, organizationId, supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handlePersonTypeChange = (value: string) => {
    setFormData(prev => ({ ...prev, person_type: value as PersonType }))
  }

  const handleCompanyChange = (value: string) => {
    const company = companies.find(c => c.id === value)
    setSelectedCompany(company || null)
    setFormData(prev => ({ 
      ...prev, 
      company_id: value,
      company_role: value === 'defaultCompany' ? '' : prev.company_role // Clear role if no company
    }))
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
      if (!formData.first_name?.trim()) {
        throw createValidationError('El nombre es requerido', 'Nombre')
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

      // Validate secondary phone if provided
      if (formData.secondary_phone?.trim()) {
        if (!validatePhone(formData.secondary_phone.trim())) {
          throw createValidationError('El teléfono secundario ingresado no es válido', 'Teléfono secundario')
        }
      }

      // Validate CUIT if provided
      if (formData.cuit?.trim()) {
        if (!validateCUIT(formData.cuit.trim())) {
          throw createValidationError('El CUIT ingresado no es válido. Debe tener formato XX-XXXXXXXX-X', 'CUIT')
        }
      }

      // Validate DNI if provided
      if (formData.dni?.trim()) {
        if (!validateDNI(formData.dni.trim())) {
          throw createValidationError('El DNI ingresado no es válido. Debe tener 7 u 8 dígitos', 'DNI')
        }
      }

      // Insert person (do not send `name` - it is a generated column)
      const { data: newPerson, error: insertError } = await supabase
        .from('people')
        .insert([
          {
            first_name: formData.first_name.trim(),
            last_name: formData.last_name?.trim() || null,
            email: formData.email?.trim() || null,
            phone: formData.phone?.trim() || null,
            secondary_phone: formData.secondary_phone?.trim() || null,
            person_type: formData.person_type,
            company_id: formData.company_id === 'defaultCompany' ? null : formData.company_id || null,
            company_role: formData.company_id !== 'defaultCompany' && formData.company_role 
              ? (formData.company_role as any) 
              : null,
            cuit: formData.cuit?.trim() || null,
            dni: formData.dni?.trim() || null,
            address: formData.address?.trim() || null,
            city: formData.city?.trim() || null,
            province: formData.province?.trim() || null,
            postal_code: formData.postal_code?.trim() || null,
            notes: formData.notes?.trim() || null,
            client_type: 'individual', // Default for individual persons
          }
        ])
        .select()
        .single()

      if (insertError) throw insertError
      if (!newPerson) throw new Error('Error al crear la persona')

      // Redirect based on context
      if (formData.company_id !== 'defaultCompany') {
        // If created from company page, redirect back to company
        router.push(`/empresas/${formData.company_id}`)
      } else {
        // Otherwise redirect to person detail
        router.push(`/personas/${newPerson.id}`)
      }
    } catch (err) {
      console.error('[CreatePersonForm] Error creating person:', err)
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Persona</h1>
        <p className="mt-2 text-muted-foreground">
          {selectedCompany 
            ? `Registra una nueva persona vinculada a ${selectedCompany.company_name || selectedCompany.name}`
            : 'Registra una nueva persona en el sistema. Puede ser cliente, juez, abogado, perito, etc.'}
        </p>
        {selectedCompany && (
          <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Empresa:</span>
              <span>{selectedCompany.company_name || selectedCompany.name}</span>
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información Personal</CardTitle>
          <CardDescription>
            Completa los datos de la persona. El nombre es obligatorio.
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

            {/* Personal Information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <User className="h-4 w-4" />
                Información Personal
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">
                    Nombre *
                  </Label>
                  <Input
                    id="first_name"
                    name="first_name"
                    placeholder="Juan"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">
                    Apellido
                  </Label>
                  <Input
                    id="last_name"
                    name="last_name"
                    placeholder="Pérez"
                    value={formData.last_name}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dni">
                    DNI
                  </Label>
                  <div className="relative">
                    <FileDigit className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="dni"
                      name="dni"
                      placeholder="12345678"
                      value={formData.dni}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cuit">
                    CUIT/CUIL
                  </Label>
                  <div className="relative">
                    <FileDigit className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="cuit"
                      name="cuit"
                      placeholder="20-12345678-9"
                      value={formData.cuit}
                      onChange={handleChange}
                      disabled={isLoading}
                      className="pl-9"
                      maxLength={13}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Phone className="h-4 w-4" />
                Información de Contacto
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="juan@example.com"
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
                <Label htmlFor="secondary_phone">Teléfono Secundario</Label>
                <Input
                  id="secondary_phone"
                  name="secondary_phone"
                  placeholder="+54 9 1123456789"
                  value={formData.secondary_phone}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Address */}
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
            </div>

            {/* Type and Company */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Briefcase className="h-4 w-4" />
                Tipo y Relaciones
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="person_type">
                    Tipo de Persona *
                  </Label>
                  <Select 
                    value={formData.person_type} 
                    onValueChange={handlePersonTypeChange} 
                    disabled={isLoading}
                  >
                    <SelectTrigger id="person_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {personTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_id">
                    Empresa (Opcional)
                  </Label>
                  <Select 
                    value={formData.company_id} 
                    onValueChange={handleCompanyChange} 
                    disabled={isLoading || isLoadingCompanies}
                  >
                    <SelectTrigger id="company_id">
                      <SelectValue placeholder="Selecciona una empresa..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="defaultCompany">Sin empresa</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.company_name || company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Show company_role selector only when a company is selected */}
              {formData.company_id !== 'defaultCompany' && (
                <div className="space-y-2">
                  <Label htmlFor="company_role">
                    Rol en la Empresa
                  </Label>
                  <Select 
                    value={formData.company_role} 
                    onValueChange={(value) => handleSelectChange('company_role', value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger id="company_role">
                      <SelectValue placeholder="Seleccionar rol..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companyRoleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Rol que esta persona tiene dentro de la empresa seleccionada
                  </p>
                </div>
              )}

              {selectedCompany && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Empresa seleccionada:</span>
                    <span>{selectedCompany.company_name || selectedCompany.name}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="notes">
                  Notas Adicionales
                </Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Información adicional sobre la persona..."
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
                {isLoading ? 'Creando...' : 'Crear Persona'}
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
