'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FileText, Gavel, ArrowRight, Loader2, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CaseOpt {
  id: string
  caseNumber: string
  title: string
}

const DOCUMENT_CHOICES = [
  {
    type: 'demanda' as const,
    title: 'Demanda',
    description:
      'Escrito de inicio. Plantilla con objeto, personería, hechos, derecho, prueba y petitorio.',
    icon: Gavel,
    role: 'actor' as const,
  },
  {
    type: 'contestacion' as const,
    title: 'Contestación de demanda',
    description:
      'Respuesta a la demanda. Plantilla con negativa general, hechos, defensas, excepciones y prueba.',
    icon: FileText,
    role: 'demandado' as const,
  },
]

function NuevoWorkspaceInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const presetCaseId = searchParams.get('caso')

  const [cases, setCases] = useState<CaseOpt[] | null>(null)
  const [caseId, setCaseId] = useState<string>(presetCaseId ?? '')
  const [selectedType, setSelectedType] = useState<'demanda' | 'contestacion' | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        const { data } = await supabase
          .from('cases')
          .select('id, case_number, title')
          .order('updated_at', { ascending: false })
          .limit(50)
        if (cancelled) return
        setCases(
          (data ?? []).map((c) => ({
            id: (c as { id: string }).id,
            caseNumber: (c as { case_number: string }).case_number,
            title: (c as { title: string }).title,
          }))
        )
      } catch (err) {
        console.error(err)
        if (!cancelled) setCases([])
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function create() {
    if (!selectedType) return
    setCreating(true)
    try {
      const choice = DOCUMENT_CHOICES.find((c) => c.type === selectedType)!
      const res = await fetch('/api/lexia/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentType: selectedType,
          caseId: caseId || null,
          clientRole: choice.role,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error del servidor' }))
        throw new Error((err as { error?: string }).error || 'Error')
      }
      const { document } = (await res.json()) as { document: { id: string } }
      router.push(`/lexia/workspace/${document.id}`)
    } catch (err) {
      toast.error((err as Error).message || 'No se pudo crear el documento')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Nuevo documento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Elegí el tipo y, opcionalmente, el caso al que pertenece. Podés cambiar el caso después.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">1. Tipo de documento</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {DOCUMENT_CHOICES.map((choice) => {
              const Icon = choice.icon
              const selected = selectedType === choice.type
              return (
                <button
                  key={choice.type}
                  type="button"
                  onClick={() => setSelectedType(choice.type)}
                  className={cn(
                    'text-left rounded-lg border p-4 transition-all',
                    selected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{choice.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{choice.description}</p>
                </button>
              )
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-medium flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            2. Caso (opcional)
          </h2>
          <Card className="p-0 overflow-hidden">
            {cases === null ? (
              <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando casos…
              </div>
            ) : cases.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                No tenés casos creados todavía.{' '}
                <Link className="text-primary hover:underline" href="/casos">
                  Ir a casos
                </Link>
                .
              </div>
            ) : (
              <ul className="max-h-64 overflow-auto divide-y divide-border">
                <li
                  className={cn(
                    'px-4 py-2 text-sm cursor-pointer hover:bg-muted/40',
                    caseId === '' && 'bg-primary/5'
                  )}
                  onClick={() => setCaseId('')}
                >
                  <span className="font-medium">Sin caso</span>
                  <div className="text-xs text-muted-foreground">Documento general, sin contexto.</div>
                </li>
                {cases.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      'px-4 py-2 text-sm cursor-pointer hover:bg-muted/40',
                      caseId === c.id && 'bg-primary/5'
                    )}
                    onClick={() => setCaseId(c.id)}
                  >
                    <span className="font-medium">{c.caseNumber}</span>
                    <div className="text-xs text-muted-foreground truncate">{c.title}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" asChild>
            <Link href="/lexia">Cancelar</Link>
          </Button>
          <Button onClick={create} disabled={!selectedType || creating}>
            {creating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4 mr-1" />
            )}
            Crear documento
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <NuevoWorkspaceInner />
    </Suspense>
  )
}
