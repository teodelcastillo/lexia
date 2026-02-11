/**
 * Admin Test Users Page
 * 
 * Tool to create test users for each role type.
 * Only accessible to admin users.
 */
'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { seedTestUsers } from '@/app/admin/seed-users'
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Copy,
  AlertTriangle,
  Shield,
  Users,
  Briefcase,
  User,
  Lock,
} from 'lucide-react'

interface CreatedUser {
  email: string
  password: string
  firstName: string
  lastName: string
  role: string
  description: string
  userId: string
}

interface SeedResult {
  success: boolean
  createdUsers: CreatedUser[]
  errors?: Array<{ email: string; error: string }>
  message: string
}

/**
 * Component for managing test user creation
 */
export default function TestUsersPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SeedResult | null>(null)
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)

  /**
   * Handle creating test users
   */
  const handleCreateTestUsers = async () => {
    setLoading(true)
    try {
      const seedResult = await seedTestUsers()
      setResult(seedResult)
    } catch (error) {
      setResult({
        success: false,
        createdUsers: [],
        errors: [
          {
            email: 'general',
            error: error instanceof Error ? error.message : 'Error desconocido',
          },
        ],
        message: 'Error al crear usuarios de prueba',
      })
    } finally {
      setLoading(false)
    }
  }

  /**
   * Copy to clipboard helper
   */
  const copyToClipboard = (text: string, email: string) => {
    navigator.clipboard.writeText(text)
    setCopiedEmail(email)
    setTimeout(() => setCopiedEmail(null), 2000)
  }

  /**
   * Get role icon and color
   */
  const getRoleInfo = (role: string) => {
    const roleMap: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
      admin: {
        icon: Shield,
        label: 'Administrador',
        color: 'bg-red-50 text-red-700 border-red-200',
      },
      lawyer: {
        icon: Briefcase,
        label: 'Abogado',
        color: 'bg-blue-50 text-blue-700 border-blue-200',
      },
      assistant: {
        icon: Users,
        label: 'Asistente',
        color: 'bg-amber-50 text-amber-700 border-amber-200',
      },
      client: {
        icon: User,
        label: 'Cliente',
        color: 'bg-green-50 text-green-700 border-green-200',
      },
    }
    return roleMap[role] || roleMap.lawyer
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Usuarios de Prueba</h1>
        <p className="mt-1 text-muted-foreground">
          Cree usuarios de prueba para cada tipo de rol del sistema
        </p>
      </div>

      {/* Warning */}
      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>Solo para desarrollo:</strong> Esta herramienta está diseñada para crear usuarios
          de prueba durante la fase de desarrollo. No utilice en producción.
        </AlertDescription>
      </Alert>

      {/* Create Button */}
      <Card>
        <CardHeader>
          <CardTitle>Crear Usuarios de Prueba</CardTitle>
          <CardDescription>
            Se crearán 5 usuarios: 1 administrador, 2 abogados, 1 asistente y 1 cliente externo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreateTestUsers} disabled={loading} size="lg">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando usuarios...
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Crear Usuarios de Prueba
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Success/Error Banner */}
          <Alert
            className={
              result.success
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }
          >
            {result.success ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription
              className={result.success ? 'text-green-800' : 'text-red-800'}
            >
              {result.message}
            </AlertDescription>
          </Alert>

          {/* Created Users */}
          {result.createdUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Usuarios Creados ({result.createdUsers.length})
                </CardTitle>
                <CardDescription>
                  Copie las credenciales para probar cada rol
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {result.createdUsers.map((user) => {
                  const roleInfo = getRoleInfo(user.role)
                  const RoleIcon = roleInfo.icon

                  return (
                    <div
                      key={user.email}
                      className="space-y-3 rounded-lg border border-border p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <RoleIcon className="h-5 w-5" />
                            <h3 className="font-semibold text-foreground">
                              {user.firstName} {user.lastName}
                            </h3>
                            <Badge variant="outline">{roleInfo.label}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {user.description}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {/* Email */}
                        <div className="flex items-center justify-between rounded bg-muted/50 p-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">
                              Correo
                            </p>
                            <p className="break-all font-mono text-sm text-foreground">
                              {user.email}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(user.email, user.email)}
                            className="ml-2 shrink-0"
                          >
                            <Copy
                              className={`h-4 w-4 ${
                                copiedEmail === user.email
                                  ? 'text-green-600'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          </Button>
                        </div>

                        {/* Password */}
                        <div className="flex items-center justify-between rounded bg-muted/50 p-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-muted-foreground">
                              Contraseña
                            </p>
                            <p className="break-all font-mono text-sm text-foreground">
                              {user.password}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              copyToClipboard(user.password, `${user.email}-password`)
                            }
                            className="ml-2 shrink-0"
                          >
                            <Copy
                              className={`h-4 w-4 ${
                                copiedEmail === `${user.email}-password`
                                  ? 'text-green-600'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {result.errors && result.errors.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Errores ({result.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.errors.map((error) => (
                  <div
                    key={error.email}
                    className="flex items-start gap-3 rounded bg-red-50 p-3 text-sm"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <div>
                      <p className="font-medium text-red-900">{error.email}</p>
                      <p className="text-red-700">{error.error}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Login Links */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-900">Próximos Pasos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-blue-800">
              <p>
                ✓ Los usuarios de prueba han sido creados y están listos para usar
              </p>
              <p>
                ✓ Visite <code className="rounded bg-blue-100 px-2 py-1 font-mono">/auth/login</code> para iniciar
                sesión
              </p>
              <p>
                ✓ Use cualquiera de las credenciales anteriores para probar diferentes roles
              </p>
              <p>
                ✓ Los datos de prueba se sincronizarán automáticamente con los casos y documentos
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
