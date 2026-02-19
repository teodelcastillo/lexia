/**
 * Reset Password Page
 *
 * Shown when user follows the link from the recovery email.
 * Supabase passes tokens in the URL hash; the client establishes the session.
 * User sets a new password via updateUser.
 */
'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Scale, Loader2, ArrowLeft } from 'lucide-react'

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setHasValidSession(!!session)
    }
    checkSession()
  }, [supabase])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!PASSWORD_REGEX.test(password)) {
      setError(
        'La contraseña debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y caracteres especiales (@$!%*?&).',
      )
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setIsLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })
      if (updateError) throw updateError
      await supabase.auth.signOut()
      router.push('/auth/login?reset=success')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al actualizar la contraseña',
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (hasValidSession === null) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Comprobando enlace...</p>
        </div>
      </div>
    )
  }

  if (!hasValidSession) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Scale className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Lexia
            </h1>
          </div>
          <Card className="border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">Enlace inválido o expirado</CardTitle>
              <CardDescription>
                El enlace de recuperación no es válido o ya ha caducado. Solicita uno nuevo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/auth/forgot-password">
                  Solicitar nuevo enlace
                  <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                </Link>
              </Button>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                <Link href="/auth/login" className="text-primary hover:underline">
                  Volver al inicio de sesión
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Scale className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Lexia
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sistema de Gestión Legal
          </p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Nueva contraseña</CardTitle>
            <CardDescription>
              Elige una contraseña segura para tu cuenta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Mín. 8 caracteres, mayúsculas, minúsculas, números y caracteres especiales
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  'Guardar contraseña'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/auth/login"
            className="font-medium text-primary hover:underline"
          >
            ← Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
