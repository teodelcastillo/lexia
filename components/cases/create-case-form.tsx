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
import type { CaseStatus } from '@/lib/types'

interface Company {
  id: string
  company_name: string | null
  name: string | null
}

interface CreateCaseFormProps {
  companies?: Company[]
  organizationId?: string | null
}

export function CreateCaseForm({ companies: initialCompanies = [], organizationId }: CreateCaseFormProps = {}) {
  const router = useRouter()
  const supabase = createClient()
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false)

  const [formData, setFormData] = useState({
    case_number: '',
    title: '',
    description: '',
    case_type: '',
    status: 'pending' as CaseStatus,
    company_id: '',
  })

  // Only load companies if not provided as prop
  useEffect(() => {
    if (initialCompanies.length > 0) {
      setCompanies(initialCompanies)
      return
    }

    const loadCompanies = async () => {
      setIsLoadingCompanies(true)
      try {
        const query = supabase
          .from('companies')
          .select('id, company_name, name')
          .order('company_name')

        // If organizationId is provided, filter by it
        if (organizationId) {
          query.eq('organization_id', organizationId)
        }

        const { data, error } = await query

        if (error) throw error
        setCompanies(data || [])
      } catch (err) {
        console.error('[v0] Error loading companies:', err)
        setError('Error al cargar empresas')
      } finally {
        setIsLoadingCompanies(false)
      }
    }

    loadCompanies()
  }, [initialCompanies, organizationId, supabase])

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Validate required fields
      if (!formData.case_number.trim()) {
        throw new Error('Número de caso es requerido')
      }
      if (!formData.title.trim()) {
        throw new Error('Título del caso es requerido')
      }
      if (!formData.company_id) {
        throw new Error('Empresa es requerida')
      }

      // Validate that the selected company belongs to the user's organization
      if (organizationId && formData.company_id) {
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('organization_id')
          .eq('id', formData.company_id)
          .single()

        if (companyError) {
          throw new Error('Error al validar la empresa seleccionada')
        }

        if (!company || company.organization_id !== organizationId) {
          throw new Error('La empresa seleccionada no pertenece a su organización')
        }
      }

      // Create case
      // organization_id will be auto-assigned by trigger, but we include it explicitly if available
      const insertData: any = {
        case_number: formData.case_number.trim(),
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        case_type: formData.case_type.trim() || null,
        status: formData.status,
        company_id: formData.company_id,
        // created_at and updated_at have defaults in DB, no need to send explicitly
      }

      // Include organization_id if provided (trigger will handle it if not)
      if (organizationId) {
        insertData.organization_id = organizationId
      }

      const { data: newCase, error: createError } = await supabase
        .from('cases')
        .insert([insertData])
        .select()
        .single()

      if (createError) throw createError

      // Assign creator as case leader so they can view the case
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error: assignError } = await supabase.from('case_assignments').insert({
          case_id: newCase.id,
          user_id: user.id,
          case_role: 'leader',
          assigned_by: user.id,
        })
        if (assignError) {
          console.error('[CreateCaseForm] Error assigning creator to case:', assignError)
          // Don't throw - case was created, user can still be assigned manually
        }
      }

      // Redirect to the new case
      router.push(`/casos/${newCase.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear caso'
      setError(message)
      console.error('[v0] Create case error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Crear Nuevo Caso
        </h1>
        <p className="text-sm text-muted-foreground">
          Complete los datos del caso legal para registrarlo en el sistema
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Caso</CardTitle>
          <CardDescription>
            Ingrese los detalles básicos del nuevo caso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Case Number and Title */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="case_number" className="text-sm font-medium">
                  Número de Caso *
                </label>
                <Input
                  id="case_number"
                  placeholder="Ej: 2025-001"
                  value={formData.case_number}
                  onChange={(e) => handleChange('case_number', e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Título del Caso *
                </label>
                <Input
                  id="title"
                  placeholder="Resumen breve del caso"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Row 2: Company and Case Type */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="company_id" className="text-sm font-medium">
                  Empresa Cliente *
                </label>
                <Select 
                  value={formData.company_id}
                  onValueChange={(value) => handleChange('company_id', value)}
                  disabled={isLoading || isLoadingCompanies}
                >
                  <SelectTrigger id="company_id">
                    <SelectValue placeholder={isLoadingCompanies ? 'Cargando empresas...' : 'Seleccionar empresa'} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.company_name || company.name || 'Sin nombre'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="case_type" className="text-sm font-medium">
                  Tipo de Caso
                </label>
                <Input
                  id="case_type"
                  placeholder="Ej: Civil, Penal, Laboral"
                  value={formData.case_type}
                  onChange={(e) => handleChange('case_type', e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Row 3: Status */}
            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium">
                Estado Inicial
              </label>
              <Select 
                value={formData.status}
                onValueChange={(value) => handleChange('status', value)}
                disabled={isLoading}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="on_hold">En Espera</SelectItem>
                  <SelectItem value="closed">Cerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 4: Description */}
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Descripción
              </label>
              <Textarea
                id="description"
                placeholder="Descripción detallada del caso..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                disabled={isLoading}
                rows={4}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? 'Creando...' : 'Crear Caso'}
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
