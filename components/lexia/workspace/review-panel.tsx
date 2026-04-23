'use client'

/**
 * Review panel — request reviewers, see status, approve/reject.
 *
 * Layout: side sheet. Top shows the current document review state (draft /
 * in_review / approved / rejected) with the list of reviewers and their
 * decisions. Actions depend on who the viewer is (requester / reviewer).
 */

import { useCallback, useEffect, useState } from 'react'
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  UserCheck,
  Users,
  X,
  Check,
  XCircle,
  Ban,
  ClipboardCheck,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface ReviewDTO {
  id: string
  documentId: string
  requestedBy: string
  reviewerId: string
  reviewerName: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  decisionReason: string | null
  requestedAt: string
  decidedAt: string | null
}

export interface DocumentReviewState {
  reviewStatus: 'draft' | 'in_review' | 'approved' | 'rejected'
  approvedBy: string | null
  approvedAt: string | null
  reviewSnapshotVersion: number | null
  reviews: ReviewDTO[]
}

interface ReviewerCandidate {
  id: string
  name: string
  email: string
  role: string
}

interface ReviewPanelProps {
  open: boolean
  onClose: () => void
  documentId: string
  currentUserId: string
  /** Callback fired when review state changes; parent can refresh banner. */
  onStateChange: (state: DocumentReviewState) => void
  reloadKey?: number
}

export function ReviewPanel(props: ReviewPanelProps) {
  const { open, onClose, documentId, currentUserId, onStateChange, reloadKey } = props

  const [state, setState] = useState<DocumentReviewState | null>(null)
  const [candidates, setCandidates] = useState<ReviewerCandidate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [decisionReason, setDecisionReason] = useState('')
  const [decidingId, setDecidingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [stateRes, candRes] = await Promise.all([
        fetch(`/api/lexia/documents/${documentId}/reviews`, { cache: 'no-store' }),
        fetch(`/api/lexia/documents/${documentId}/reviewers`, { cache: 'no-store' }),
      ])
      if (stateRes.ok) {
        const s = (await stateRes.json()) as DocumentReviewState
        setState(s)
        onStateChange(s)
      }
      if (candRes.ok) {
        const c = (await candRes.json()) as { reviewers: ReviewerCandidate[] }
        setCandidates(c.reviewers ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [documentId, onStateChange])

  useEffect(() => {
    if (open) void load()
  }, [open, reloadKey, load])

  const pendingForMe = state?.reviews.find(
    (r) => r.reviewerId === currentUserId && r.status === 'pending'
  )
  const isRequester = state?.reviews.some((r) => r.requestedBy === currentUserId) ?? false

  const requestReview = useCallback(async () => {
    if (selected.size === 0) {
      toast.error('Seleccioná al menos un revisor')
      return
    }
    const res = await fetch(`/api/lexia/documents/${documentId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewerIds: Array.from(selected) }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data?.error ?? 'No se pudo solicitar la revision')
      return
    }
    setSelected(new Set())
    toast.success('Revisión solicitada')
    await load()
  }, [selected, documentId, load])

  const decide = useCallback(
    async (reviewId: string, decision: 'approved' | 'rejected') => {
      setDecidingId(reviewId)
      try {
        const res = await fetch(
          `/api/lexia/documents/${documentId}/reviews/${reviewId}/decide`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ decision, reason: decisionReason.trim() || undefined }),
          }
        )
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast.error(data?.error ?? 'No se pudo decidir')
          return
        }
        setDecisionReason('')
        toast.success(decision === 'approved' ? 'Aprobada' : 'Rechazada')
        await load()
      } finally {
        setDecidingId(null)
      }
    },
    [documentId, decisionReason, load]
  )

  const cancelReview = useCallback(
    async (reviewId: string) => {
      const res = await fetch(
        `/api/lexia/documents/${documentId}/reviews/${reviewId}/cancel`,
        { method: 'POST' }
      )
      if (!res.ok) {
        toast.error('No se pudo cancelar')
        return
      }
      await load()
    },
    [documentId, load]
  )

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" /> Revision
          </SheetTitle>
          <SheetDescription>
            Solicita aprobacion al equipo y hace seguimiento del estado.
          </SheetDescription>
        </SheetHeader>

        <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-3">
          <StatusBadge status={state?.reviewStatus ?? 'draft'} />
          {state?.reviewSnapshotVersion != null && (
            <span className="text-[11px] text-muted-foreground">
              v{state.reviewSnapshotVersion}
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
        </div>

        <div className="flex-1 overflow-auto">
          {/* Reviewer decision action */}
          {pendingForMe && (
            <section className="px-5 py-4 border-b bg-blue-50 dark:bg-blue-950/30">
              <div className="flex items-center gap-2 text-sm font-medium">
                <UserCheck className="h-4 w-4" />
                Tenés que decidir esta revision
              </div>
              <Textarea
                className="mt-3 min-h-[60px] text-sm"
                placeholder="Motivo (opcional al aprobar, recomendado al rechazar)"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => decide(pendingForMe.id, 'approved')}
                  disabled={decidingId === pendingForMe.id}
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => decide(pendingForMe.id, 'rejected')}
                  disabled={decidingId === pendingForMe.id}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Rechazar
                </Button>
              </div>
            </section>
          )}

          {/* Reviewer list */}
          {state && state.reviews.length > 0 && (
            <section className="px-5 py-4 border-b">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Revisores
              </div>
              <div className="space-y-2">
                {state.reviews.map((r) => (
                  <ReviewRow
                    key={r.id}
                    review={r}
                    canCancel={r.status === 'pending' && r.requestedBy === currentUserId}
                    onCancel={() => cancelReview(r.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Request review form (only when draft/rejected and user is owner-ish) */}
          {state && (state.reviewStatus === 'draft' || state.reviewStatus === 'rejected') && (
            <section className="px-5 py-4 border-b">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Solicitar revision
              </div>
              <div className="space-y-1">
                {candidates.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No hay candidatos disponibles.
                  </p>
                )}
                {candidates.map((c) => {
                  const on = selected.has(c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(c.id)) next.delete(c.id)
                          else next.add(c.id)
                          return next
                        })
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-left',
                        on ? 'bg-primary/10 border-primary' : 'hover:bg-muted'
                      )}
                    >
                      <div
                        className={cn(
                          'h-4 w-4 rounded border flex items-center justify-center',
                          on ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                        )}
                      >
                        {on && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {c.email}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {c.role.replace('_', ' ')}
                      </Badge>
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <span className="text-[11px] text-muted-foreground mr-auto">
                  <Users className="inline h-3 w-3 mr-1" />
                  {selected.size} seleccionado(s)
                </span>
                <Button size="sm" onClick={requestReview} disabled={selected.size === 0}>
                  Solicitar
                </Button>
              </div>
            </section>
          )}

          {state?.reviewStatus === 'approved' && (
            <section className="px-5 py-4 border-b bg-emerald-50 dark:bg-emerald-950/30 text-sm">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 font-medium">
                <ShieldCheck className="h-4 w-4" /> Documento aprobado
              </div>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                La edicion esta bloqueada. Para modificar, creá una nueva version.
              </p>
            </section>
          )}
        </div>

        <div className="border-t px-5 py-3 flex items-center justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-3.5 w-3.5 mr-1" /> Cerrar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function StatusBadge({ status }: { status: DocumentReviewState['reviewStatus'] }) {
  if (status === 'approved')
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
        <ShieldCheck className="h-3 w-3 mr-1" /> Aprobado
      </Badge>
    )
  if (status === 'rejected')
    return (
      <Badge className="bg-red-100 text-red-800 border-red-300">
        <XCircle className="h-3 w-3 mr-1" /> Rechazado
      </Badge>
    )
  if (status === 'in_review')
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-300">
        <ShieldAlert className="h-3 w-3 mr-1" /> En revision
      </Badge>
    )
  return (
    <Badge variant="outline">
      <ClipboardCheck className="h-3 w-3 mr-1" /> Borrador
    </Badge>
  )
}

function ReviewRow({
  review,
  canCancel,
  onCancel,
}: {
  review: ReviewDTO
  canCancel: boolean
  onCancel: () => void
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="flex-1 min-w-0">
        <div className="font-medium">{review.reviewerName ?? 'Revisor'}</div>
        {review.decisionReason && (
          <div className="text-xs text-muted-foreground italic mt-0.5">
            &quot;{review.decisionReason}&quot;
          </div>
        )}
        <div className="text-[11px] text-muted-foreground mt-0.5">
          Solicitada: {new Date(review.requestedAt).toLocaleString('es-AR')}
          {review.decidedAt && (
            <> · Decidida: {new Date(review.decidedAt).toLocaleString('es-AR')}</>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {review.status === 'approved' && (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
            <Check className="h-3 w-3 mr-1" /> Aprobada
          </Badge>
        )}
        {review.status === 'rejected' && (
          <Badge className="bg-red-100 text-red-800 border-red-300 text-[10px]">
            <XCircle className="h-3 w-3 mr-1" /> Rechazada
          </Badge>
        )}
        {review.status === 'pending' && (
          <Badge variant="outline" className="text-[10px]">
            Pendiente
          </Badge>
        )}
        {review.status === 'cancelled' && (
          <Badge variant="secondary" className="text-[10px]">
            Cancelada
          </Badge>
        )}
        {canCancel && (
          <Button size="icon" variant="ghost" onClick={onCancel} className="h-6 w-6">
            <Ban className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
