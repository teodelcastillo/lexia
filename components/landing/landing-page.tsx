/**
 * Landing Page - Lexia
 *
 * Página principal pública: describe la plataforma y está dirigida a
 * estudios jurídicos y abogados. Incluye enlace a política de privacidad
 * y propósito de la aplicación para cumplir con requisitos de verificación.
 */
import React from 'react'
import Link from 'next/link'
import {
  Scale,
  Briefcase,
  FileText,
  Calendar,
  Users,
  CheckSquare,
  Bot,
  Shield,
  ArrowRight,
  Building2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const features = [
  {
    icon: Briefcase,
    title: 'Gestión de casos',
    description: 'Organice expedientes, estados, prioridades y equipos por caso. Visibilidad completa para líderes y abogados.',
  },
  {
    icon: Users,
    title: 'Clientes y empresas',
    description: 'Centralice datos de clientes, personas y empresas. Portal para que sus clientes vean el estado de sus casos.',
  },
  {
    icon: FileText,
    title: 'Documentos',
    description: 'Suba y vincule escritos, contratos y pruebas por caso. Control de visibilidad y versionado.',
  },
  {
    icon: CheckSquare,
    title: 'Tareas y vencimientos',
    description: 'Plazos procesales, audiencias y tareas asignadas. Recordatorios y vista unificada de plazos.',
  },
  {
    icon: Calendar,
    title: 'Calendario e integraciones',
    description: 'Vista mensual de audiencias y vencimientos. Sincronización con Google Calendar.',
  },
  {
    icon: Bot,
    title: 'Lexia – Asistente legal con IA',
    description: 'Asistente especializado en derecho argentino: redacción de borradores, cálculo de plazos, contestación guiada y consultas procesales.',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-svh flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scale className="h-5 w-5" />
            </div>
            Lexia – Asistente legal
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link
              href="/privacidad"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Política de privacidad
            </Link>
            <Link
              href="/terminos"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Términos
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="sm">
                Iniciar sesión
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="container mx-auto px-4 py-16 md:py-24 lg:py-32">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Gestión legal integral para su estudio jurídico
            </h1>
            <p className="text-lg text-muted-foreground md:text-xl">
              Lexia es una plataforma que centraliza casos, clientes, documentos, tareas y plazos en un solo lugar, con un asistente de inteligencia artificial especializado en derecho argentino para redacción, plazos y consultas.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <Link href="/auth/login">
                <Button size="lg" className="gap-2">
                  Acceder a la plataforma
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button variant="outline" size="lg">
                  Solicitar acceso
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Purpose - for verification */}
        <section className="border-y border-border/60 bg-muted/30">
          <div className="container mx-auto px-4 py-10 md:py-14">
            <div className="mx-auto max-w-2xl text-center space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                Propósito de la aplicación
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Lexia está dirigida a estudios jurídicos y abogados que necesitan gestionar casos, clientes, documentos, tareas y vencimientos de forma centralizada. La aplicación permite al equipo interno trabajar de forma coordinada y ofrece un portal para que los clientes consulten el estado de sus asuntos. Incluye un asistente de IA (Lexia) para apoyo en redacción de escritos, cálculo de plazos procesales y consultas sobre derecho argentino.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Todo lo que su estudio necesita
            </h2>
            <p className="mt-3 text-muted-foreground">
              Módulos pensados para el día a día del abogado y del equipo.
            </p>
          </div>
          <div className="mx-auto max-w-5xl grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="border-border/60">
                <CardContent className="pt-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Who it's for */}
        <section className="border-t border-border/60 bg-muted/20">
          <div className="container mx-auto px-4 py-16 md:py-20">
            <div className="flex flex-col items-center gap-8 md:flex-row md:justify-center md:gap-16">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Estudios jurídicos</h3>
                  <p className="text-sm text-muted-foreground">
                    Administradores, líderes de caso y abogados con roles y permisos configurables.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Clientes</h3>
                  <p className="text-sm text-muted-foreground">
                    Portal seguro para que sus clientes vean el estado de sus casos y documentos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-2xl text-center space-y-6 rounded-2xl border border-border bg-card p-8 md:p-12">
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">
              Centralice su práctica legal
            </h2>
            <p className="text-muted-foreground">
              Casos, documentos, plazos y asistente de IA en una sola plataforma.
            </p>
            <Link href="/auth/login">
              <Button size="lg" className="gap-2">
                Iniciar sesión
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Scale className="h-5 w-5 text-primary" />
              Lexia – Asistente legal
            </div>
            <p className="text-sm text-muted-foreground text-center">
              <Link href="/privacidad" className="underline hover:text-foreground">
                Política de Privacidad
              </Link>
              {' · '}
              <Link href="/terminos" className="underline hover:text-foreground">
                Términos de Servicio
              </Link>
            </p>
          </div>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Lexia. Plataforma de gestión para estudios jurídicos.
          </p>
        </div>
      </footer>
    </div>
  )
}
