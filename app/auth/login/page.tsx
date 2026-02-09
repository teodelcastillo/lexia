/**
 * Login Page
 * 
 * Authentication page for internal users (lawyers, assistants, admins).
 * Provides email/password login with professional styling.
 */
'use client'

import React from "react"

import { useState } from 'react'
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
import { Scale, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  /**
   * Handles the login form submission
   */
  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        throw authError
      }

      // Check user's role to redirect appropriately
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Wait a moment for profile to be available (in case it was just created)
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('system_role')
          .eq('id', user.id)
          .single()

        // If profile doesn't exist, show error
        if (profileError || !profile) {
          setError('Su perfil no se ha creado correctamente. Por favor, contacte al administrador o intente registrarse nuevamente.')
          // Sign out to clear session
          await supabase.auth.signOut()
          return
        }

        // Redirect clients to portal, internal users to dashboard
        if (profile.system_role === 'client') {
          router.push('/portal')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al iniciar sesión'
      
      // Translate common Supabase errors to Spanish
      if (errorMessage.includes('Invalid login credentials')) {
        setError('Credenciales inválidas. Verifique su email y contraseña.')
      } else if (errorMessage.includes('Email not confirmed')) {
        setError('Debe confirmar su email antes de iniciar sesión.')
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Scale className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            LegalHub
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sistema de Gestión Legal
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">Iniciar Sesión</CardTitle>
            <CardDescription>
              Ingrese sus credenciales para acceder al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@estudio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link 
                    href="/auth/forgot-password"
                    className="text-xs text-muted-foreground hover:text-primary hover:underline"
                  >
                    ¿Olvidó su contraseña?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>

            {/* Portal Link */}
            <div className="mt-6 space-y-3 border-t border-border pt-4">
              <p className="text-center text-sm text-muted-foreground">
                ¿Es cliente?{' '}
                <Link 
                  href="/auth/portal-login"
                  className="font-medium text-primary hover:underline"
                >
                  Acceder al Portal de Clientes
                </Link>
              </p>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">o</span>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                ¿Nuevo estudio?{' '}
                <Link 
                  href="/auth/sign-up"
                  className="font-medium text-primary hover:underline"
                >
                  Crear cuenta
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Al iniciar sesión, acepta nuestros{' '}
          <Link href="/terminos" className="underline hover:text-foreground">
            Términos de Servicio
          </Link>{' '}
          y{' '}
          <Link href="/privacidad" className="underline hover:text-foreground">
            Política de Privacidad
          </Link>
        </p>
      </div>
    </div>
  )
}
