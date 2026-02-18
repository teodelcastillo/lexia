/**
 * Lawyer/Firm Sign Up Page
 * 
 * Registration page for new legal professionals and firms.
 * Creates a new team/firm account with the first user as admin.
 */
'use client'

import React from "react"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Scale, Loader2, ChevronRight } from 'lucide-react'
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
import { createClient } from '@/lib/supabase/client'

/**
 * Sign up form state
 */
interface SignUpFormData {
  // Firm Information
  firmName: string
  firmCity: string
  
  // First User (Admin) Information
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
}

export default function SignUpPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [formData, setFormData] = useState<SignUpFormData>({
    firmName: '',
    firmCity: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<'firm' | 'user' | 'confirm'>(
    'firm',
  )

  /**
   * Validates password strength
   */
  const validatePassword = (password: string): boolean => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    return passwordRegex.test(password)
  }

  /**
   * Validates email format
   */
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Handles form input changes
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    setError(null)
  }

  /**
   * Validates firm step data
   */
  const validateFirmStep = (): boolean => {
    if (!formData.firmName.trim()) {
      setError('El nombre del estudio es requerido')
      return false
    }
    if (!formData.firmCity.trim()) {
      setError('La ciudad es requerida')
      return false
    }
    return true
  }

  /**
   * Validates user step data
   */
  const validateUserStep = (): boolean => {
    if (!formData.firstName.trim()) {
      setError('El nombre es requerido')
      return false
    }
    if (!formData.lastName.trim()) {
      setError('El apellido es requerido')
      return false
    }
    if (!validateEmail(formData.email)) {
      setError('Ingrese un email válido')
      return false
    }
    if (!validatePassword(formData.password)) {
      setError(
        'La contraseña debe tener al menos 8 caracteres, incluir mayúsculas, minúsculas, números y caracteres especiales (@$!%*?&)',
      )
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      return false
    }
    return true
  }

  /**
   * Moves to next step
   */
  const goToNextStep = () => {
    if (currentStep === 'firm' && validateFirmStep()) {
      setCurrentStep('user')
    } else if (currentStep === 'user' && validateUserStep()) {
      setCurrentStep('confirm')
    }
  }

  /**
   * Moves to previous step
   */
  const goToPreviousStep = () => {
    if (currentStep === 'user') {
      setCurrentStep('firm')
    } else if (currentStep === 'confirm') {
      setCurrentStep('user')
    }
  }

  /**
   * Handles the sign up submission
   */
  const handleSignUp = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // 1. Create Supabase auth account
      const { data: authData, error: authError } =
        await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
              firm_name: formData.firmName,
              firm_city: formData.firmCity,
              system_role: 'admin_general',
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          },
        })

      if (authError) {
        throw authError
      }

      if (!authData.user) {
        throw new Error('No se pudo crear la cuenta')
      }

      // 2. The profile and firm will be created by a trigger in Supabase
      // 3. Redirect to success page
      router.push('/auth/sign-up-success')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'

      // Translate common Supabase errors to Spanish
      if (errorMessage.includes('User already registered')) {
        setError('Este email ya está registrado')
      } else if (errorMessage.includes('Email rate limit exceeded')) {
        setError(
          'Ha intentado registrarse demasiadas veces. Intente más tarde.',
        )
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
            Lexia
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Únase a nuestra plataforma de gestión legal
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8 flex items-center gap-2">
          <div
            className={`h-2 flex-1 rounded-full transition-colors ${
              currentStep === 'firm' || currentStep === 'user' || currentStep === 'confirm'
                ? 'bg-primary'
                : 'bg-muted'
            }`}
          />
          <div
            className={`h-2 flex-1 rounded-full transition-colors ${
              currentStep === 'user' || currentStep === 'confirm'
                ? 'bg-primary'
                : 'bg-muted'
            }`}
          />
          <div
            className={`h-2 flex-1 rounded-full transition-colors ${
              currentStep === 'confirm' ? 'bg-primary' : 'bg-muted'
            }`}
          />
        </div>

        {/* Sign Up Card */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">
              {currentStep === 'firm' && 'Datos del Estudio'}
              {currentStep === 'user' && 'Tu Perfil'}
              {currentStep === 'confirm' && 'Confirmar Registro'}
            </CardTitle>
            <CardDescription>
              {currentStep === 'firm' &&
                'Información básica de tu estudio jurídico'}
              {currentStep === 'user' &&
                'Crea tu cuenta de administrador del estudio'}
              {currentStep === 'confirm' &&
                'Verifica que los datos sean correctos'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Step 1: Firm Information */}
            {currentStep === 'firm' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firmName">Nombre del Estudio *</Label>
                  <Input
                    id="firmName"
                    name="firmName"
                    placeholder="Ej: Estudio Jurídico García"
                    value={formData.firmName}
                    onChange={handleChange}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="firmCity">Ciudad *</Label>
                  <Input
                    id="firmCity"
                    name="firmCity"
                    placeholder="Ej: Córdoba"
                    value={formData.firmCity}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
                  Puede agregar más información del estudio después de crear la
                  cuenta.
                </div>
              </div>
            )}

            {/* Step 2: User Information */}
            {currentStep === 'user' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nombre *</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      placeholder="Juan"
                      value={formData.firstName}
                      onChange={handleChange}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Apellido *</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      placeholder="García"
                      value={formData.lastName}
                      onChange={handleChange}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="juan@estudio.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña *</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mín. 8 caracteres, mayúsculas, minúsculas, números y
                    caracteres especiales
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Contraseña *</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Confirmation */}
            {currentStep === 'confirm' && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Estudio</p>
                    <p className="font-medium text-foreground">
                      {formData.firmName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formData.firmCity}
                    </p>
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="text-sm text-muted-foreground">Administrador</p>
                    <p className="font-medium text-foreground">
                      {formData.firstName} {formData.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formData.email}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                  Al hacer clic en "Crear Cuenta", acepta confirmar su email
                  para completar el registro.
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              {currentStep !== 'firm' && (
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={goToPreviousStep}
                  disabled={isLoading}
                >
                  Anterior
                </Button>
              )}

              {currentStep !== 'confirm' && (
                <Button
                  className="flex-1"
                  onClick={goToNextStep}
                  disabled={isLoading}
                >
                  Siguiente
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}

              {currentStep === 'confirm' && (
                <Button
                  className="flex-1"
                  onClick={handleSignUp}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando cuenta...
                    </>
                  ) : (
                    'Crear Cuenta'
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            ¿Ya tiene una cuenta?{' '}
            <Link
              href="/auth/login"
              className="font-medium text-primary hover:underline"
            >
              Inicie sesión
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Al registrarse, acepta nuestros{' '}
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
