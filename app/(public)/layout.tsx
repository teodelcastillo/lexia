/**
 * Public Layout
 *
 * Layout for public legal pages (Privacy Policy, Terms of Service).
 * No authentication required.
 */
import React from 'react'
import Link from 'next/link'
import { Scale } from 'lucide-react'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-svh flex flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <Link
            href="/auth/login"
            className="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="h-5 w-5" />
            </div>
            LegalHub
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/privacidad"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Privacidad
            </Link>
            <Link
              href="/terminos"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Términos
            </Link>
            <Link
              href="/auth/login"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/40 py-6">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} LegalHub. Sistema de Gestión Legal.</p>
          <p className="mt-1">
            <Link href="/privacidad" className="underline hover:text-foreground">
              Política de Privacidad
            </Link>
            {' · '}
            <Link href="/terminos" className="underline hover:text-foreground">
              Términos de Servicio
            </Link>
          </p>
        </div>
      </footer>
    </div>
  )
}
