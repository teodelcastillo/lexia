'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { FileEdit, ArrowLeft, Loader2, Briefcase, FolderOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DOCUMENT_TYPE_CONFIG } from '@/lib/lexia/document-type-config'
import type { DocumentType } from '@/lib/ai/draft-schemas'

interface DraftItem {
  id: string
  document_type: string
  name: string
  case_id: string | null
  created_at: string
  updated_at: string
}

interface CaseInfo {
  id: string
  case_number: string
  title: string
}

export default function BorradoresPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const caseFilter = searchParams.get('caso')
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [cases, setCases] = useState<Record<string, CaseInfo>>({})
  const [availableCases, setAvailableCases] = useState<CaseInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const params = new URLSearchParams()
        if (caseFilter) params.set('caseId', caseFilter)
        const res = await fetch(`/api/lexia/drafts?${params}`)
        if (res.ok) {
          const data = await res.json()
          setDrafts(data)
        }
      } catch (err) {
        console.error('[Borradores] Error:', err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [caseFilter])

  useEffect(() => {
    const caseIds = [...new Set(drafts.map((d) => d.case_id).filter(Boolean))] as string[]
    if (caseIds.length === 0) return
    const supabase = createClient()
    supabase
      .from('cases')
      .select('id, case_number, title')
      .in('id', caseIds)
      .then(({ data }) => {
        if (data) {
          setCases(Object.fromEntries(data.map((c) => [c.id, c])))
        }
      })
  }, [drafts])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('cases')
      .select('id, case_number, title')
      .order('updated_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setAvailableCases(data)
      })
  }, [])

  const formatDate = (s: string) => {
    const d = new Date(s)
    return d.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <FileEdit className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold">Mis borradores</h1>
            <p className="text-xs text-muted-foreground">
              Retomá borradores guardados para continuar editando
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/lexia/redactor">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver al Redactor
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <Select
              value={caseFilter ?? 'all'}
              onValueChange={(v) => {
                const params = new URLSearchParams(searchParams)
                if (v === 'all') {
                  params.delete('caso')
                } else {
                  params.set('caso', v)
                }
                const q = params.toString()
                router.push(q ? `/lexia/borradores?${q}` : '/lexia/borradores')
              }}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Filtrar por caso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los borradores</SelectItem>
                {availableCases.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.case_number} - {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {caseFilter
                  ? 'No hay borradores asociados a este caso'
                  : 'No tenés borradores guardados'}
              </p>
              <Button asChild>
                <Link href={caseFilter ? `/lexia/redactor?caso=${caseFilter}` : '/lexia/redactor'}>
                  Crear borrador
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((d) => {
                const config = DOCUMENT_TYPE_CONFIG[d.document_type as DocumentType]
                const Icon = config?.icon ?? FileEdit
                const caseInfo = d.case_id ? cases[d.case_id] : null

                return (
                  <Link key={d.id} href={`/lexia/redactor?borrador=${d.id}`}>
                    <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{d.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="secondary" className="text-xs">
                                {config?.label ?? d.document_type}
                              </Badge>
                              {caseInfo && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Briefcase className="h-3 w-3" />
                                  {caseInfo.case_number} - {caseInfo.title}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Actualizado: {formatDate(d.updated_at)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
