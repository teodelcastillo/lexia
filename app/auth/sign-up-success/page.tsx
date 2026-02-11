/**
 * Sign Up Success Page
 * 
 * Confirmation page after lawyer/firm registration.
 * Displays instructions for email verification and next steps.
 */
'use client'

import React from "react"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Scale, Mail, CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function SignUpSuccessPage() {
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState(30)

  useEffect(() => {
    // Optional: Auto-redirect after 30 seconds if user confirms email
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [])

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

        {/* Success Card */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="space-y-1 pb-4 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">¡Cuenta Creada!</CardTitle>
            <CardDescription>
              Casi listo. Verifique su email para completar el registro
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Email Verification Section */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
              <div className="mb-3 flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="font-medium text-blue-900 dark:text-blue-200">
                    Verificar Email
                  </h3>
                  <p className="mt-1 text-sm text-blue-800 dark:text-blue-300">
                    Hemos enviado un enlace de confirmación a su email. Haga
                    clic en el enlace para verificar su cuenta.
                  </p>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="space-y-3">
              <h4 className="font-medium text-foreground">Próximos pasos:</h4>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    1
                  </span>
                  <span>Revise su bandeja de entrada (y spam)</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    2
                  </span>
                  <span>Haga clic en el enlace de confirmación</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    3
                  </span>
                  <span>Vuelva a iniciar sesión con sus credenciales</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    4
                  </span>
                  <span>Configure su estudio y agregue su equipo</span>
                </li>
              </ol>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <Button asChild className="w-full">
                <Link href="/auth/login">
                  Ir a Iniciar Sesión
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button variant="outline" className="w-full bg-transparent" asChild>
                <Link href="/">Volver al Inicio</Link>
              </Button>
            </div>

            {/* Help Text */}
            <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">¿No recibió el email?</p>
              <p>
                Verifique su carpeta de spam. Si no aparece, contacte a{' '}
                <a
                  href="mailto:soporte@legalhub.com"
                  className="font-medium text-primary hover:underline"
                >
                  soporte@legalhub.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
