'use client'

/**
 * Top-level client for the Lexia Workspace document page.
 * Wires editor + ⌘K popover + autosave + context panel.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Save,
  Sparkles,
  Loader2,
  Check,
  FileSearch,
  Bot,
  ShieldAlert,
  Gavel,
  MessageSquare,
  ClipboardCheck,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

import {
  WorkspaceEditor,
  type EditorImperativeHandle,
  type CmdKRequest,
} from './workspace-editor'
import { AiEditPopover } from './ai-edit-popover'
import { WorkspaceContextPanel } from './workspace-context-panel'
import { InvestigatePanel } from './investigate-panel'
import { CounterArguePanel } from './counter-argue-panel'
import { AgentPanel } from './agent-panel'
import { StressTestPanel } from './stress-test-panel'
import { JurisprudencePanel } from './jurisprudence-panel'
import { GroundingBanner } from './grounding-banner'
import { CommentsPanel } from './comments-panel'
import { ReviewPanel, type DocumentReviewState } from './review-panel'
import { applyAgentStep, scrollToPassage } from './agent-applier'
import type {
  WorkspaceDocumentDTO,
  TiptapDoc,
  AgentStep,
  AgentStepResult,
} from '@/lib/lexia/workspace'

interface WorkspaceClientProps {
  document: WorkspaceDocumentDTO
  caseInfo: {
    id: string
    caseNumber: string
    title: string
  } | null
  /** Documents/persons available as context (server-fetched, could be empty). */
  caseDocuments: Array<{ id: string; name: string }>
  casePersons: Array<{ id: string; name: string; type: string }>
  /** The currently logged in user id, used by comments / reviews panels. */
  currentUserId: string
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

export function WorkspaceClient({
  document: initialDoc,
  caseInfo,
  caseDocuments,
  casePersons,
  currentUserId,
}: WorkspaceClientProps) {
  const editorRef = useRef<EditorImperativeHandle>(null)

  const [title, setTitle] = useState(initialDoc.title)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [version, setVersion] = useState(initialDoc.version)

  // Active context (sent to AI with each edit)
  const [activeDocIds, setActiveDocIds] = useState<string[]>(
    initialDoc.activeContext?.documentIds ?? []
  )
  const [activePersonIds, setActivePersonIds] = useState<string[]>(
    initialDoc.activeContext?.personIds ?? []
  )

  // ⌘K popover state
  const [cmdK, setCmdK] = useState<CmdKRequest | null>(null)
  const popoverOpen = cmdK !== null

  // Right-side panels
  const [investigateOpen, setInvestigateOpen] = useState(false)
  const [counterOpen, setCounterOpen] = useState(false)
  const [counterFragment, setCounterFragment] = useState<{ text: string; from: number; to: number } | null>(null)
  const [agentOpen, setAgentOpen] = useState(false)
  const [stressOpen, setStressOpen] = useState(false)
  const [jurisOpen, setJurisOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [groundingRefreshKey, setGroundingRefreshKey] = useState(0)
  const [commentsReloadKey, setCommentsReloadKey] = useState(0)
  const [reviewReloadKey, setReviewReloadKey] = useState(0)
  const [reviewStatus, setReviewStatus] = useState<DocumentReviewState['reviewStatus']>('draft')
  const [currentSelection, setCurrentSelection] = useState<{
    from: number
    to: number
    text: string
  } | null>(null)

  // Snapshot of the latest editor content (for autosave)
  const latestContentRef = useRef<TiptapDoc>(initialDoc.content)
  const latestTextRef = useRef<string>(initialDoc.contentText)
  const dirtyRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const triggerAutosave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveState('dirty')
    dirtyRef.current = true
    saveTimerRef.current = setTimeout(() => {
      void doSave()
    }, 1200)
  }, [])

  const doSave = useCallback(async () => {
    if (!dirtyRef.current) return
    setSaveState('saving')
    try {
      const res = await fetch(`/api/lexia/documents/${initialDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: latestContentRef.current,
          title,
          activeContext: { documentIds: activeDocIds, personIds: activePersonIds },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const message = (data?.error as string | undefined) ?? 'No se pudo guardar'
        if (reviewStatus === 'approved' || /aprobado/i.test(message)) {
          toast.error(
            'El documento esta aprobado: creá una nueva version para editarlo.'
          )
        } else {
          toast.error(message)
        }
        throw new Error(message)
      }
      const data = (await res.json()) as { document: WorkspaceDocumentDTO }
      setVersion(data.document.version)
      dirtyRef.current = false
      setSaveState('saved')
    } catch (err) {
      console.error(err)
      setSaveState('error')
    }
  }, [initialDoc.id, title, activeDocIds, activePersonIds, reviewStatus])

  // Save context changes & title debounced too.
  useEffect(() => {
    dirtyRef.current = true
    triggerAutosave()
  }, [title, activeDocIds, activePersonIds, triggerAutosave])

  // Flush on unload.
  useEffect(() => {
    const handler = () => {
      if (dirtyRef.current) void doSave()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [doSave])

  // Cmd/Ctrl+S for manual save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        void doSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doSave])

  const handleEditorUpdate = useCallback(
    (doc: TiptapDoc, text: string) => {
      latestContentRef.current = doc
      latestTextRef.current = text
      triggerAutosave()
    },
    [triggerAutosave]
  )

  // Track the current editor selection so the comments panel can anchor a
  // new thread to it. We poll lazily; Tiptap's selectionUpdate would be a
  // tighter hook but the editor ref is not available at mount time.
  useEffect(() => {
    const id = setInterval(() => {
      const ed = editorRef.current?.getEditor?.()
      if (!ed) return
      const { from, to, empty } = ed.state.selection
      if (empty || from === to) {
        setCurrentSelection((prev) => (prev ? null : prev))
        return
      }
      const text = ed.state.doc.textBetween(from, to, '\n')
      setCurrentSelection({ from, to, text })
    }, 400)
    return () => clearInterval(id)
  }, [])

  // Load initial review status so the header badge is up-to-date.
  useEffect(() => {
    let aborted = false
    const load = async () => {
      try {
        const res = await fetch(`/api/lexia/documents/${initialDoc.id}/reviews`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = (await res.json()) as { reviewStatus: DocumentReviewState['reviewStatus'] }
        if (!aborted) setReviewStatus(data.reviewStatus)
      } catch {
        // best effort
      }
    }
    void load()
    return () => {
      aborted = true
    }
  }, [initialDoc.id, reviewReloadKey])

  const handleCmdK = useCallback((req: CmdKRequest) => {
    setCmdK(req)
    if (req.mode === 'selection' && req.from !== req.to) {
      editorRef.current?.markPending(req.from, req.to)
    }
  }, [])

  const closePopover = useCallback(() => {
    setCmdK(null)
    editorRef.current?.clearPending()
    editorRef.current?.focus()
  }, [])

  const handleAgentApplyStep = useCallback(
    (stepResult: AgentStepResult, planStep: AgentStep) => {
      const editor = editorRef.current?.getEditor?.()
      if (!editor) return { ok: false, message: 'Editor no disponible' }
      const outcome = applyAgentStep(editor, stepResult, {
        targetHeading: planStep.targetHeading,
      })
      // Fire a synthetic update so autosave kicks in.
      if (outcome.ok) {
        latestContentRef.current = editor.getJSON() as TiptapDoc
        latestTextRef.current = editor.getText()
        triggerAutosave()
      }
      return outcome
    },
    [triggerAutosave]
  )

  const handleStressNavigate = useCallback((passage: string) => {
    const editor = editorRef.current?.getEditor?.()
    if (!editor) return
    const ok = scrollToPassage(editor, passage)
    if (!ok) toast.error('No encontré el pasaje en el documento')
  }, [])

  const handleStressApplyRewrite = useCallback(
    (passage: string, rewrite: string) => {
      const editor = editorRef.current?.getEditor?.()
      if (!editor) return
      const ok = scrollToPassage(editor, passage)
      if (!ok) {
        toast.error('No encontré el pasaje para reemplazar')
        return
      }
      editorRef.current?.replaceSelectionWithText(rewrite)
      toast.success('Fragmento reforzado')
    },
    []
  )

  const handleChallenge = useCallback(() => {
    if (!cmdK || cmdK.mode !== 'selection' || !cmdK.text) return
    setCounterFragment({ text: cmdK.text, from: cmdK.from, to: cmdK.to })
    setCounterOpen(true)
    setCmdK(null)
  }, [cmdK])

  const handleAccept = useCallback(
    ({ replacement, citations }: { replacement: string; citations?: unknown }) => {
      if (!cmdK) return
      editorRef.current?.clearPending()
      if (cmdK.mode === 'selection') {
        editorRef.current?.replaceSelectionWithText(
          replacement,
          (citations as any) ?? undefined
        )
      } else {
        editorRef.current?.insertTextAt(
          cmdK.from,
          replacement,
          (citations as any) ?? undefined
        )
      }
      setCmdK(null)
      toast.success('Cambio aplicado')
      // The editor's onUpdate will fire and autosave.
      setGroundingRefreshKey((k) => k + 1)
    },
    [cmdK]
  )

  const caseLabel = caseInfo ? `${caseInfo.caseNumber} — ${caseInfo.title}` : null

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5 bg-muted/30 flex-shrink-0">
        <Button size="icon" variant="ghost" asChild>
          <Link href="/lexia">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm font-semibold bg-transparent border-0 shadow-none focus-visible:ring-1 focus-visible:ring-ring px-2"
          />
          <div className="flex items-center gap-2 px-2 mt-0.5 text-[11px] text-muted-foreground">
            {caseLabel && (
              <Link
                href={`/casos/${caseInfo!.id}`}
                className="hover:underline truncate max-w-[400px]"
              >
                {caseLabel}
              </Link>
            )}
            {caseLabel && <span>·</span>}
            <span>v{version}</span>
            <span>·</span>
            <SaveStateIndicator state={saveState} />
            <span>·</span>
            <GroundingBanner documentId={initialDoc.id} refreshKey={groundingRefreshKey} />
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Badge variant="outline" className="text-[10px] font-normal hidden md:inline-flex">
            <Sparkles className="h-3 w-3 mr-1" />⌘K para editar con IA
          </Badge>
          {caseInfo && caseDocuments.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setInvestigateOpen(true)}
              title="Preguntar sobre los documentos del caso"
            >
              <FileSearch className="h-4 w-4 mr-1" />
              Investigar
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setJurisOpen(true)}
            title="Buscar jurisprudencia real en SAIJ (con cache)"
          >
            <Gavel className="h-4 w-4 mr-1" />
            Jurisprudencia
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCommentsOpen(true)}
            title="Comentarios y discusion colaborativa"
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            Comentarios
          </Button>
          <Button
            size="sm"
            variant={reviewStatus === 'approved' ? 'default' : 'ghost'}
            onClick={() => setReviewOpen(true)}
            title="Solicitar revision o aprobar el documento"
          >
            <ClipboardCheck className="h-4 w-4 mr-1" />
            Revision
            {reviewStatus !== 'draft' && (
              <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0">
                {reviewStatus.replace('_', ' ')}
              </Badge>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAgentOpen(true)}
            title="Modo agente: redactar secciones enteras con plan previo"
          >
            <Bot className="h-4 w-4 mr-1" />
            Modo Agente
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setStressOpen(true)}
            title="Stress-test: ataques automáticos al borrador completo"
          >
            <ShieldAlert className="h-4 w-4 mr-1" />
            Stress-test
          </Button>
          <Button size="sm" variant="ghost" onClick={doSave}>
            <Save className="h-4 w-4 mr-1" />
            Guardar
          </Button>
        </div>
      </header>

      {/* Body: context panel + editor */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="hidden md:block border-r border-border bg-muted/20 overflow-auto">
          <WorkspaceContextPanel
            caseInfo={caseInfo}
            documents={caseDocuments}
            persons={casePersons}
            activeDocumentIds={activeDocIds}
            activePersonIds={activePersonIds}
            onDocumentToggle={(id, on) =>
              setActiveDocIds((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)))
            }
            onPersonToggle={(id, on) =>
              setActivePersonIds((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)))
            }
          />
        </aside>

        <main className="min-w-0 min-h-0 overflow-hidden relative">
          <WorkspaceEditor
            ref={editorRef}
            initialContent={initialDoc.content}
            onUpdate={handleEditorUpdate}
            onCmdK={handleCmdK}
          />

          <AiEditPopover
            open={popoverOpen}
            onClose={closePopover}
            mode={cmdK?.mode ?? 'selection'}
            documentId={initialDoc.id}
            anchor={cmdK?.anchor ?? null}
            selectionText={cmdK?.text ?? ''}
            selectionFrom={cmdK?.from ?? 0}
            selectionTo={cmdK?.to ?? 0}
            context={{ documentIds: activeDocIds, personIds: activePersonIds }}
            onAccept={handleAccept}
            onChallenge={cmdK?.mode === 'selection' && cmdK.text ? handleChallenge : undefined}
          />
        </main>
      </div>

      <InvestigatePanel
        open={investigateOpen}
        onClose={() => setInvestigateOpen(false)}
        caseId={caseInfo?.id ?? null}
        documents={caseDocuments}
        defaultDocumentIds={activeDocIds}
        onInsertPassage={(text) => {
          const h = editorRef.current
          if (!h) return
          const editor = h.getEditor?.()
          const pos = editor?.state.selection.to ?? 0
          h.insertTextAt(pos, text)
          toast.success('Pasaje insertado')
          setInvestigateOpen(false)
        }}
      />

      <CounterArguePanel
        open={counterOpen}
        onClose={() => {
          setCounterOpen(false)
          editorRef.current?.clearPending()
        }}
        documentId={initialDoc.id}
        fragment={counterFragment?.text ?? ''}
        clientRole={initialDoc.clientRole ?? null}
        onApplyRewrite={(text) => {
          if (!counterFragment) return
          editorRef.current?.clearPending()
          const editor = editorRef.current?.getEditor?.()
          if (editor) {
            editor
              .chain()
              .focus()
              .setTextSelection({ from: counterFragment.from, to: counterFragment.to })
              .run()
          }
          editorRef.current?.replaceSelectionWithText(text)
          toast.success('Fragmento reemplazado')
          setCounterOpen(false)
        }}
      />

      <AgentPanel
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        documentId={initialDoc.id}
        context={{ documentIds: activeDocIds, personIds: activePersonIds }}
        onApplyStep={handleAgentApplyStep}
        onRequestStressTest={() => setStressOpen(true)}
      />

      <StressTestPanel
        open={stressOpen}
        onClose={() => setStressOpen(false)}
        documentId={initialDoc.id}
        clientRole={initialDoc.clientRole ?? null}
        context={{ documentIds: activeDocIds, personIds: activePersonIds }}
        onNavigateToPassage={handleStressNavigate}
        onApplyRewrite={handleStressApplyRewrite}
      />

      <JurisprudencePanel
        open={jurisOpen}
        onClose={() => setJurisOpen(false)}
        caseId={caseInfo?.id ?? null}
        defaultQuery={caseInfo?.title ?? ''}
        onInsertCitation={({ label, summary }) => {
          const h = editorRef.current
          if (!h) return
          const editor = h.getEditor?.()
          const pos = editor?.state.selection.to ?? 0
          const text = summary
            ? `${summary.slice(0, 280)}... (conforme ${label}).`
            : `Conforme a ${label}.`
          h.insertTextAt(pos, text, [{ label, kind: 'jurisprudencia' }])
          toast.success('Cita insertada')
          setJurisOpen(false)
        }}
      />

      <CommentsPanel
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        documentId={initialDoc.id}
        currentUserId={currentUserId}
        currentSelection={currentSelection}
        reloadKey={commentsReloadKey}
        onThreadCreated={(threadId, from, to) => {
          editorRef.current?.markComment(from, to, threadId)
          setCommentsReloadKey((k) => k + 1)
        }}
        onThreadResolved={(threadId) => {
          editorRef.current?.unmarkComment(threadId)
        }}
        onFocusThread={(threadId) => {
          editorRef.current?.scrollToComment(threadId)
        }}
      />

      <ReviewPanel
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        documentId={initialDoc.id}
        currentUserId={currentUserId}
        reloadKey={reviewReloadKey}
        onStateChange={(state) => {
          setReviewStatus(state.reviewStatus)
          if (state.reviewStatus === 'approved' || state.reviewStatus === 'rejected') {
            setReviewReloadKey((k) => k + 1)
          }
        }}
      />
    </div>
  )
}

// -----------------------------------------------------------------------------
// Save state badge
// -----------------------------------------------------------------------------

function SaveStateIndicator({ state }: { state: SaveState }) {
  if (state === 'saving')
    return (
      <span className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
      </span>
    )
  if (state === 'dirty') return <span>Cambios sin guardar</span>
  if (state === 'error') return <span className="text-red-600">Error al guardar</span>
  return (
    <span className="flex items-center gap-1">
      <Check className="h-3 w-3" /> Guardado
    </span>
  )
}
