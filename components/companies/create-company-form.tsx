'use client'

import React from "react"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'

export function CreateCompanyForm() {
  const router = useRouter()
  const supabase = createClient()
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    company_name: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Validations
      if (!formData.company_name?.trim()) {
        throw new Error('El nombre de la empresa es requerido')
      }

      // Insert company
      const { data: newCompany, error: insertError } = await supabase
        .from('companies')
        .insert([
          {
            company_name: formData.company_name,
            name: formData.name || formData.company_name,
            email: formData.email || null,
            phone: formData.phone || null,
            address: formData.address || null,
            notes: formData.notes || null,
          }
        ])
        .select()
        .single()

      if (insertError) throw insertError
      if (!newCompany) throw new Error('Error al crear la empresa')

      // Redirect to company detail
      router.push(`/empresas/${newCompany.id}`)
    } catch (err) {
      console.error('[v0] Error creating company:', err)
      setError(err instanceof Error ? err.message : 'Error al crear la empresa')
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="company_name" className="text-sm font-medium">
                  Nombre de la Empresa *
                </label>
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
                <label htmlFor="name" className="text-sm font-medium">
                  Nombre Comercial
                </label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ej: Mi Empresa"
                  value={formData.name}
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
                  placeholder="contacto@empresa.com"
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

            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium">
                Dirección
              </label>
              <Input
                id="address"
                name="address"
                placeholder="Calle 123, Piso 4, Buenos Aires"
                value={formData.address}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Notas Adicionales
              </label>
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
