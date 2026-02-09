'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
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

export function CreatePersonForm() {
  const router = useRouter()
  const supabase = createClient()
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true)

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    person_type: 'client' as PersonType,
    company_id: 'defaultCompany', // Updated default value to be a non-empty string
    notes: '',
  })

  // Load companies on mount
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, company_name, name')
          .order('company_name')

        if (error) throw error
        setCompanies(data || [])
      } catch (err) {
        console.error('[v0] Error loading companies:', err)
      } finally {
        setIsLoadingCompanies(false)
      }
    }

    loadCompanies()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, person_type: value as PersonType }))
  }

  const handleCompanyChange = (value: string) => {
    setFormData(prev => ({ ...prev, company_id: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Validations
      if (!formData.first_name?.trim()) {
        throw new Error('El nombre es requerido')
      }

      // Insert person (do not send `name` - it is a generated column: COALESCE(first_name + last_name, company_name))
      const { data: newPerson, error: insertError } = await supabase
        .from('people')
        .insert([
          {
            first_name: formData.first_name.trim(),
            last_name: formData.last_name?.trim() || null,
            email: formData.email?.trim() || null,
            phone: formData.phone?.trim() || null,
            person_type: formData.person_type,
            company_id: formData.company_id === 'defaultCompany' ? null : formData.company_id || null,
            notes: formData.notes?.trim() || null,
            client_type: 'individual', // Default for individual persons
          }
        ])
        .select()
        .single()

      if (insertError) throw insertError
      if (!newPerson) throw new Error('Error al crear la persona')

      // Redirect to person detail
      router.push(`/personas/${newPerson.id}`)
    } catch (err) {
      console.error('[v0] Error creating person:', err)
      setError(err instanceof Error ? err.message : 'Error al crear la persona')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nueva Persona</h1>
        <p className="mt-2 text-muted-foreground">
          Registra una nueva persona en el sistema. Puede ser cliente, juez, abogado, perito, etc.
        </p>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="first_name" className="text-sm font-medium">
                  Nombre *
                </label>
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
                <label htmlFor="last_name" className="text-sm font-medium">
                  Apellido
                </label>
                <Input
                  id="last_name"
                  name="last_name"
                  placeholder="Pérez"
                  value={formData.last_name}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
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
                <label htmlFor="phone" className="text-sm font-medium">
                  Teléfono
                </label>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="person_type" className="text-sm font-medium">
                  Tipo de Persona *
                </label>
                <Select value={formData.person_type} onValueChange={handleSelectChange} disabled={isLoading}>
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
                <label htmlFor="company_id" className="text-sm font-medium">
                  Empresa (Opcional)
                </label>
                <Select value={formData.company_id} onValueChange={handleCompanyChange} disabled={isLoading || isLoadingCompanies}>
                  <SelectTrigger id="company_id">
                    <SelectValue placeholder="Selecciona una empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="defaultCompany">Sin empresa</SelectItem> {/* Updated value prop to be a non-empty string */}
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.company_name || company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Notas Adicionales
              </label>
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
