/**
 * Authentication Error Page
 * 
 * Displays errors from the authentication flow.
 */
'use client'

import React from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, ArrowLeft, Scale } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import Loading from './loading'

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  /**
   * Get user-friendly error message based on error code
   */
  const getErrorMessage = (): { title: string; description: string } => {
    if (error === 'access_denied') {
      return {
        title: 'Acceso Denegado',
        description:
          'No tiene permiso para acceder a este recurso. Por favor, contacte al administrador.',
      }
    }

    if (error === 'server_error') {
      return {
        title: 'Error del Servidor',
        description:
          'Ocurrió un error en nuestros servidores. Por favor, intente nuevamente más tarde.',
      }
    }

    if (errorDescription?.includes('Email not confirmed')) {
      return {
        title: 'Email No Confirmado',
        description:
          'Debe confirmar su dirección de email antes de iniciar sesión. Revise su bandeja de entrada.',
      }
    }

    if (errorDescription?.includes('Invalid')) {
      return {
        title: 'Enlace Inválido',
        description:
          'El enlace de verificación es inválido o ha expirado. Solicite un nuevo enlace.',
      }
    }

    return {
      title: 'Error de Autenticación',
      description:
        errorDescription ||
        'Ocurrió un error durante la autenticación. Por favor, intente nuevamente.',
    }
  }

  const errorInfo = getErrorMessage()

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Scale className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            LegalHub
          </h1>
        </div>

        {/* Error Card */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <div className="mb-2 flex justify-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-center text-xl">
              {errorInfo.title}
            </CardTitle>
            <CardDescription className="text-center">
              {errorInfo.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Action Buttons */}
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link href="/auth/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver a Iniciar Sesión
                </Link>
              </Button>

              {errorDescription?.includes('Email not confirmed') && (
                <Button asChild variant="outline" className="w-full bg-transparent">
                  <Link href="/auth/resend-confirmation">
                    Reenviar Email de Confirmación
                  </Link>
                </Button>
              )}
            </div>

            {/* Help Section */}
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-center">
              <p className="text-sm text-muted-foreground">
                ¿Necesita ayuda?{' '}
                <Link
                  href="/contacto"
                  className="font-medium text-primary hover:underline"
                >
                  Contáctenos
                </Link>
              </p>
            </div>

            {/* Technical Details (for debugging) */}
            {process.env.NODE_ENV === 'development' && error && (
              <details className="rounded-lg border border-border bg-muted/30 p-3">
                <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                  Detalles Técnicos
                </summary>
                <div className="mt-2 space-y-1 text-xs font-mono">
                  <p>
                    <span className="text-muted-foreground">Error:</span>{' '}
                    {error}
                  </p>
                  {errorDescription && (
                    <p>
                      <span className="text-muted-foreground">
                        Description:
                      </span>{' '}
                      {errorDescription}
                    </p>
                  )}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
