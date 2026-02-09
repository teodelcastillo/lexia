/**
 * New User Form Component
 * 
 * Form for admins to create new team member accounts.
 * Uses a server action to create the auth user and profile.
 */
'use client'

import React from "react"
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, UserPlus, Mail, User, Briefcase, Shield, Building2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createTeamMember } from '@/app/actions/create-team-member'
import { createClient } from '@/lib/supabase/client'
import type { Person, Company } from '@/lib/types'

/**
 * Form for creating new team member accounts
 */
export function NewUserForm() {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [userType, setUserType] = useState<'team' | 'client'>('team')
  const [people, setPeople] = useState<Person[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'case_leader' as 'admin_general' | 'case_leader' | 'staff' | 'client',
    personId: '',
    companyId: '',
  })

  // Load people and companies for client users
  useEffect(() => {
    if (userType === 'client') {
      const loadData = async () => {
        setIsLoadingData(true)
        try {
          const [{ data: peopleData }, { data: companiesData }] = await Promise.all([
            supabase
              .from('people')
              .select('*')
              .eq('person_type', 'client')
              .order('name'),
            supabase
              .from('companies')
              .select('*')
              .order('company_name'),
          ])
          
          setPeople(peopleData || [])
          setCompanies(companiesData || [])
        } catch (err) {
          console.error('[v0] Error loading people and companies:', err)
          setError('Error al cargar personas y empresas')
        } finally {
          setIsLoadingData(false)
        }
      }
      
      loadData()
    }
  }, [userType, supabase])

  /**
   * Handles form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (userType === 'client') {
        // For client users, validate person and company
        if (!formData.personId || !formData.companyId) {
          setError('Por favor seleccione una persona y una empresa')
          setIsLoading(false)
          return
        }

        // Create client user via server action or API
        const response = await fetch('/api/admin/create-client-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            personId: formData.personId,
            companyId: formData.companyId,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || 'Error al crear usuario cliente')
          return
        }

        setSuccess(true)
        setTimeout(() => {
          router.push('/admin/usuarios')
        }, 2000)
      } else {
        // For team members
        const result = await createTeamMember({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role as 'admin_general' | 'case_leader' | 'staff',
        })
        
        if (result.error) {
          setError(result.error)
        } else {
          setSuccess(true)
          setTimeout(() => {
            router.push('/admin/usuarios')
          }, 2000)
        }
      }
    } catch (err) {
      setError('Error al crear el usuario. Por favor intente nuevamente.')
      console.error('[v0] Error creating user:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <UserPlus className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-foreground">
              Usuario creado exitosamente
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Se ha enviado un email de invitación a {formData.email}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Redirigiendo a la lista de usuarios...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crear Nuevo Usuario</CardTitle>
        <CardDescription>
          Complete los datos del nuevo usuario
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* User Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="userType">
              Tipo de Usuario <span className="text-destructive">*</span>
            </Label>
            <Select
              value={userType}
              onValueChange={(value: 'team' | 'client') => {
                setUserType(value)
                setFormData({
                  email: '',
                  firstName: '',
                  lastName: '',
                  role: value === 'client' ? 'client' : 'case_leader',
                  personId: '',
                  companyId: '',
                })
                setError(null)
              }}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    <span>Miembro del Equipo</span>
                  </div>
                </SelectItem>
                <SelectItem value="client">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Cliente</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="pl-9"
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {userType === 'team' ? (
            // Team Member Fields
            <>
              {/* First Name */}
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="Juan"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="pl-9"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Apellido <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Pérez"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="pl-9"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="role">
                  Rol <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value as 'admin_general' | 'case_leader' | 'staff' })
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span>Administrador</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="lawyer">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        <span>Abogado</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="staff">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Personal</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Role Descriptions */}
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <h4 className="text-sm font-medium text-foreground mb-3">Permisos por rol:</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Shield className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">Administrador:</span> Acceso completo a todas las funciones
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Briefcase className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">Abogado:</span> Gestión de casos y clientes asignados
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <User className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">Personal:</span> Acceso a tareas y documentos asignados
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            // Client User Fields
            <>
              {/* Person Selection */}
              <div className="space-y-2">
                <Label htmlFor="person">
                  Persona <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.personId}
                  onValueChange={(value) => setFormData({ ...formData, personId: value })}
                  disabled={isLoading || isLoadingData}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar persona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {people.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No hay personas disponibles. Cree una persona primero.
                  </p>
                )}
              </div>

              {/* Company Selection */}
              <div className="space-y-2">
                <Label htmlFor="company">
                  Empresa <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.companyId}
                  onValueChange={(value) => setFormData({ ...formData, companyId: value })}
                  disabled={isLoading || isLoadingData}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.company_name || company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {companies.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No hay empresas disponibles. Cree una empresa primero.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-blue-50 dark:bg-blue-950 p-4">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Información del Usuario Cliente
                </h4>
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  El usuario cliente tendrá acceso únicamente a la información de la persona y empresa seleccionadas, incluyendo todos los casos relacionados.
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              asChild
              disabled={isLoading}
            >
              <Link href="/admin/usuarios">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancelar
              </Link>
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || (userType === 'client' && isLoadingData)} 
              className="flex-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Crear Usuario
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
