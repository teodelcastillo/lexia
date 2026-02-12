'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PenTool, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RedactorDocumentTypeSelect } from '@/components/lexia/redactor/redactor-document-type-select'
import { RedactorForm } from '@/components/lexia/redactor/redactor-form'
import { RedactorDraftView } from '@/components/lexia/redactor/redactor-draft-view'
import { RedactorIterationChat } from '@/components/lexia/redactor/redactor-iteration-chat'
import { SaveDraftDialog } from '@/components/lexia/redactor/save-draft-dialog'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import type { DocumentType } from '@/lib/ai/draft-schemas'
import type { ClientRole } from '@/lib/lexia/case-party-data'
import { getDefaultDraftTitle } from '@/lib/lexia/draft-title'

type Step = 'select' | 'form' | 'draft'

/** Tipos de documento que tienen actor/demandado y permiten elegir el rol del cliente */
const DOC_TYPES_WITH_CLIENT_ROLE: DocumentType[] = [
  'demanda',
  'contestacion',
  'apelacion',
  'casacion',
  'recurso_extraordinario',
  'carta_documento',
]

interface CaseContext {
  id: string
  caseNumber: string
  title: string
  type?: string
}

export default function RedactorPage() {
  const searchParams = useSearchParams()
  const caseId = searchParams.get('caso')

  const [step, setStep] = useState<Step>('select')
  const [documentType, setDocumentType] = useState<DocumentType | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [draftContent, setDraftContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showIteration, setShowIteration] = useState(false)
  const [caseContext, setCaseContext] = useState<CaseContext | null>(null)
  const [formDefaultsByRole, setFormDefaultsByRole] = useState<{
    actor: Record<string, Record<string, string>>
    demandado: Record<string, Record<string, string>>
  }>({ actor: {}, demandado: {} })
  const [clientRole, setClientRole] = useState<ClientRole>('actor')
  const [templateFields, setTemplateFields] = useState<
    import('@/lib/ai/draft-schemas').FormFieldDefinition[] | null
  >(null)
  const [isOrgTemplate, setIsOrgTemplate] = useState(false)
  const [templateLoaded, setTemplateLoaded] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(false)

  const loadCaseContext = useCallback(async () => {
    if (!caseId) return null
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data, error } = await supabase
        .from('cases')
        .select('id, case_number, title, case_type')
        .eq('id', caseId)
        .single()
      if (!error && data) {
        const ctx: CaseContext = {
          id: data.id,
          caseNumber: data.case_number,
          title: data.title,
          type: data.case_type,
        }
        setCaseContext(ctx)
        return ctx
      }
    } catch (err) {
      console.error('[Redactor] Error loading case:', err)
    }
    return null
  }, [caseId])

  const loadCaseById = useCallback(async (id: string) => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data, error } = await supabase
        .from('cases')
        .select('id, case_number, title, case_type')
        .eq('id', id)
        .single()
      if (!error && data) {
        setCaseContext({
          id: data.id,
          caseNumber: data.case_number,
          title: data.title,
          type: data.case_type,
        })
      }
    } catch (err) {
      console.error('[Redactor] Error loading case:', err)
    }
  }, [])

  const loadCasePartyData = useCallback(async () => {
    if (!caseId) return
    try {
      const res = await fetch(`/api/lexia/case-party-data?caseId=${encodeURIComponent(caseId)}`)
      if (res.ok) {
        const { formDefaultsByRole: defaults } = await res.json()
        setFormDefaultsByRole(defaults ?? { actor: {}, demandado: {} })
      }
    } catch (err) {
      console.error('[Redactor] Error loading case party data:', err)
    }
  }, [caseId])

  useEffect(() => {
    if (caseId) {
      loadCaseContext()
      loadCasePartyData()
    }
  }, [caseId, loadCaseContext, loadCasePartyData])

  const draftId = searchParams.get('borrador')

  useEffect(() => {
    if (!draftId) return
    setLoadingDraft(true)
    fetch(`/api/lexia/drafts/${draftId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Borrador no encontrado')
        return res.json()
      })
      .then(async (draft) => {
        const type = draft.document_type as DocumentType
        setDocumentType(type)
        setFormData((draft.form_data || {}) as Record<string, string>)
        setDraftContent(draft.content || '')
        setStep('draft')
        setShowIteration(true)
        if (draft.case_id) {
          loadCaseById(draft.case_id)
        }
        loadTemplate(type)
      })
      .catch((err) => {
        toast.error(err.message || 'Error al cargar el borrador')
      })
      .finally(() => setLoadingDraft(false))
  }, [draftId, loadCaseById])

  const generateDraft = useCallback(
    async (data: Record<string, string>, previousDraft?: string, iterationInstruction?: string) => {
      setIsGenerating(true)
      setDraftContent('')
      setStep('draft')

      try {
        const ctx = caseContext ?? (await loadCaseContext())
        const res = await fetch('/api/lexia/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            documentType,
            formData: data,
            caseContext: ctx
              ? { caseId: ctx.id, caseNumber: ctx.caseNumber, title: ctx.title, type: ctx.type }
              : null,
            previousDraft: previousDraft || null,
            iterationInstruction: iterationInstruction || null,
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Error al generar el borrador')
        }

        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let content = ''

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            const chunk = decoder.decode(value, { stream: true })
            content += chunk
            setDraftContent(content)
          }
        }

        setShowIteration(true)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al generar el borrador')
        setStep('form')
      } finally {
        setIsGenerating(false)
      }
    },
    [documentType, caseContext, loadCaseContext]
  )

  const loadTemplate = useCallback(async (type: DocumentType) => {
    setTemplateLoaded(false)
    try {
      const res = await fetch(`/api/lexia/templates/by-type/${type}`)
      if (res.ok) {
        const data = await res.json()
        setTemplateFields(data.fields ?? null)
        setIsOrgTemplate(data.isOrgTemplate ?? false)
      } else {
        setTemplateFields(null)
        setIsOrgTemplate(false)
      }
    } catch (err) {
      console.error('[Redactor] Error loading template:', err)
      setTemplateFields(null)
      setIsOrgTemplate(false)
    } finally {
      setTemplateLoaded(true)
    }
  }, [])

  const handleSelectType = (type: DocumentType) => {
    setDocumentType(type)
    setFormData({})
    setClientRole(type === 'contestacion' ? 'demandado' : 'actor')
    setStep('form')
    loadTemplate(type)
  }

  const effectiveDefaults =
    documentType && formDefaultsByRole
      ? formDefaultsByRole[clientRole]?.[documentType] ?? {}
      : {}
  const hasPartyData =
    documentType &&
    ((formDefaultsByRole.actor?.[documentType] &&
      Object.keys(formDefaultsByRole.actor[documentType]).length > 0) ||
      (formDefaultsByRole.demandado?.[documentType] &&
        Object.keys(formDefaultsByRole.demandado[documentType]).length > 0))
  const showClientRoleSelector =
    !!caseContext &&
    !!documentType &&
    DOC_TYPES_WITH_CLIENT_ROLE.includes(documentType) &&
    !!hasPartyData

  const handleBack = () => {
    if (step === 'form') {
      setStep('select')
      setDocumentType(null)
    }
  }

  const handleFormSubmit = (data: Record<string, string>) => {
    setFormData(data)
    generateDraft(data)
  }

  const handleIterate = (instruction: string) => {
    generateDraft(formData, draftContent, instruction)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <PenTool className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold">Redactor Jurídico</h1>
            <p className="text-xs text-muted-foreground">
              {caseContext ? (
                <>
                  Caso asociado:{' '}
                  <Link
                    href={`/casos/${caseContext.id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Briefcase className="h-3 w-3" />
                    {caseContext.caseNumber} - {caseContext.title}
                  </Link>
                  {' '}(podés elegir si representás al actor o al demandado)
                </>
              ) : (
                'Genera documentos legales con formularios guiados'
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card className="max-w-4xl mx-auto p-6">
          {step === 'select' && (
            <RedactorDocumentTypeSelect onSelect={handleSelectType} />
          )}

          {step === 'form' && documentType && (
            <>
              {!templateLoaded ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-pulse text-muted-foreground">Cargando plantilla...</div>
                </div>
              ) : (
                <RedactorForm
                  key={`${documentType}-${templateFields ? 'custom' : 'default'}`}
                  documentType={documentType}
                  onBack={handleBack}
                  onSubmit={handleFormSubmit}
                  isSubmitting={isGenerating}
                  defaultValues={effectiveDefaults}
                  clientRole={showClientRoleSelector ? clientRole : undefined}
                  onClientRoleChange={showClientRoleSelector ? setClientRole : undefined}
                  fieldsOverride={templateFields ?? undefined}
                  isOrgTemplate={isOrgTemplate}
                />
              )}
            </>
          )}

          {step === 'draft' && documentType && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('form')}
                  disabled={isGenerating || loadingDraft}
                >
                  Volver al formulario
                </Button>
              </div>
              {loadingDraft ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  Cargando borrador...
                </div>
              ) : (
                <>
                  <RedactorDraftView
                    documentType={documentType}
                    content={draftContent}
                    isStreaming={isGenerating}
                    onContentChange={(c) => setDraftContent(c)}
                    onSaveClick={() => setSaveDialogOpen(true)}
                  />
                  {showIteration && (
                    <div className="border-t border-border pt-4">
                      <p className="text-sm font-medium mb-2">Modificar borrador</p>
                      <RedactorIterationChat
                        onSend={handleIterate}
                        isGenerating={isGenerating}
                      />
                    </div>
                  )}
                </>
              )}
              <SaveDraftDialog
                open={saveDialogOpen}
                onOpenChange={setSaveDialogOpen}
                documentType={documentType}
                content={draftContent}
                formData={formData}
                preselectedCaseId={caseContext?.id ?? caseId}
                defaultTitle={getDefaultDraftTitle(documentType, formData)}
                onSaved={(id) => {
                  const url = new URL(window.location.href)
                  url.searchParams.set('borrador', id)
                  window.history.replaceState({}, '', url.toString())
                }}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
