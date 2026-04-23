/**
 * Lexia Workspace — collaboration (comments + review workflow).
 *
 * Pure persistence helpers + notification glue. Called from the API routes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { insertNotifications } from '@/lib/services/notification-insert'

// =============================================================================
// Types
// =============================================================================

export interface CommentDTO {
  id: string
  documentId: string
  authorId: string
  authorName: string | null
  parentId: string | null
  threadId: string
  selectionFrom: number | null
  selectionTo: number | null
  selectionText: string | null
  content: string
  versionAtCreation: number | null
  resolvedAt: string | null
  resolvedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CommentThread {
  root: CommentDTO
  replies: CommentDTO[]
  resolved: boolean
}

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

// =============================================================================
// Row types (internal)
// =============================================================================

interface CommentRow {
  id: string
  document_id: string
  author_id: string
  parent_id: string | null
  thread_id: string
  selection_from: number | null
  selection_to: number | null
  selection_text: string | null
  content: string
  version_at_creation: number | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
  author?: { first_name: string; last_name: string } | null
}

interface ReviewRow {
  id: string
  document_id: string
  requested_by: string
  reviewer_id: string
  status: ReviewDTO['status']
  decision_reason: string | null
  requested_at: string
  decided_at: string | null
  reviewer?: { first_name: string; last_name: string } | null
}

function commentRowToDTO(row: CommentRow): CommentDTO {
  return {
    id: row.id,
    documentId: row.document_id,
    authorId: row.author_id,
    authorName: row.author
      ? `${row.author.first_name} ${row.author.last_name}`.trim()
      : null,
    parentId: row.parent_id,
    threadId: row.thread_id,
    selectionFrom: row.selection_from,
    selectionTo: row.selection_to,
    selectionText: row.selection_text,
    content: row.content,
    versionAtCreation: row.version_at_creation,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function reviewRowToDTO(row: ReviewRow): ReviewDTO {
  return {
    id: row.id,
    documentId: row.document_id,
    requestedBy: row.requested_by,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer
      ? `${row.reviewer.first_name} ${row.reviewer.last_name}`.trim()
      : null,
    status: row.status,
    decisionReason: row.decision_reason,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
  }
}

// =============================================================================
// Comments
// =============================================================================

export async function listComments(
  db: SupabaseClient,
  documentId: string
): Promise<CommentThread[]> {
  const { data, error } = await db
    .from('lexia_document_comments')
    .select('*, author:profiles!lexia_document_comments_author_id_fkey(first_name,last_name)')
    .eq('document_id', documentId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(`listComments: ${error.message}`)
  const rows = (data ?? []) as CommentRow[]

  const byThread = new Map<string, CommentDTO[]>()
  for (const row of rows) {
    const dto = commentRowToDTO(row)
    const arr = byThread.get(dto.threadId) ?? []
    arr.push(dto)
    byThread.set(dto.threadId, arr)
  }

  const threads: CommentThread[] = []
  for (const [, comments] of byThread.entries()) {
    const root = comments.find((c) => c.parentId == null) ?? comments[0]
    const replies = comments.filter((c) => c.id !== root.id)
    threads.push({
      root,
      replies,
      resolved: root.resolvedAt != null,
    })
  }
  // Sort threads: unresolved first, then by position, then by creation.
  threads.sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
    const aPos = a.root.selectionFrom ?? Number.MAX_SAFE_INTEGER
    const bPos = b.root.selectionFrom ?? Number.MAX_SAFE_INTEGER
    if (aPos !== bPos) return aPos - bPos
    return a.root.createdAt.localeCompare(b.root.createdAt)
  })
  return threads
}

export async function createComment(
  db: SupabaseClient,
  params: {
    documentId: string
    authorId: string
    parentId?: string | null
    selection?: { from: number; to: number; text?: string } | null
    content: string
    versionAtCreation?: number | null
  }
): Promise<CommentDTO> {
  const content = params.content.trim()
  if (!content) throw new Error('Comentario vacio')

  // Resolve threadId: if replying, same as parent's thread_id.
  let threadId: string | null = null
  if (params.parentId) {
    const { data: parent, error: parentErr } = await db
      .from('lexia_document_comments')
      .select('thread_id, document_id')
      .eq('id', params.parentId)
      .maybeSingle()
    if (parentErr || !parent) throw new Error('Comentario padre no encontrado')
    if ((parent as { document_id: string }).document_id !== params.documentId) {
      throw new Error('Documento no coincide con el padre')
    }
    threadId = (parent as { thread_id: string }).thread_id
  }

  const insertPayload: Record<string, unknown> = {
    document_id: params.documentId,
    author_id: params.authorId,
    parent_id: params.parentId ?? null,
    selection_from: params.selection?.from ?? null,
    selection_to: params.selection?.to ?? null,
    selection_text: params.selection?.text ?? null,
    content,
    version_at_creation: params.versionAtCreation ?? null,
    // thread_id: set after insert for root comments; use placeholder for now.
    thread_id: threadId ?? crypto.randomUUID(),
  }

  const { data, error } = await db
    .from('lexia_document_comments')
    .insert(insertPayload)
    .select('*, author:profiles!lexia_document_comments_author_id_fkey(first_name,last_name)')
    .single()
  if (error || !data) throw new Error(`createComment: ${error?.message ?? 'unknown'}`)

  const row = data as CommentRow
  // If this is a root comment, rewrite thread_id = id for self-consistency.
  if (!threadId && row.thread_id !== row.id) {
    const { data: updated } = await db
      .from('lexia_document_comments')
      .update({ thread_id: row.id })
      .eq('id', row.id)
      .select('*, author:profiles!lexia_document_comments_author_id_fkey(first_name,last_name)')
      .single()
    if (updated) return commentRowToDTO(updated as CommentRow)
  }

  // Notify the document owner + any active reviewers (if different from author).
  await notifyCommentAdded(db, {
    documentId: params.documentId,
    authorId: params.authorId,
    commentId: row.id,
    excerpt: content,
  }).catch(() => undefined)

  return commentRowToDTO(row)
}

export async function updateComment(
  db: SupabaseClient,
  params: { commentId: string; userId: string; content?: string; resolved?: boolean }
): Promise<CommentDTO> {
  const update: Record<string, unknown> = {}
  if (typeof params.content === 'string') {
    const trimmed = params.content.trim()
    if (!trimmed) throw new Error('Contenido vacio')
    update.content = trimmed
  }
  if (typeof params.resolved === 'boolean') {
    update.resolved_at = params.resolved ? new Date().toISOString() : null
    update.resolved_by = params.resolved ? params.userId : null
  }
  const { data, error } = await db
    .from('lexia_document_comments')
    .update(update)
    .eq('id', params.commentId)
    .select('*, author:profiles!lexia_document_comments_author_id_fkey(first_name,last_name)')
    .single()
  if (error || !data) throw new Error(`updateComment: ${error?.message ?? 'unknown'}`)
  return commentRowToDTO(data as CommentRow)
}

export async function deleteComment(
  db: SupabaseClient,
  commentId: string
): Promise<void> {
  const { error } = await db
    .from('lexia_document_comments')
    .delete()
    .eq('id', commentId)
  if (error) throw new Error(`deleteComment: ${error.message}`)
}

// =============================================================================
// Reviews
// =============================================================================

export async function getDocumentReviewState(
  db: SupabaseClient,
  documentId: string
): Promise<DocumentReviewState | null> {
  const { data: doc, error: docErr } = await db
    .from('lexia_documents')
    .select('review_status, approved_by, approved_at, review_snapshot_version')
    .eq('id', documentId)
    .maybeSingle()
  if (docErr || !doc) return null

  const { data: reviews, error: revErr } = await db
    .from('lexia_document_reviews')
    .select(
      '*, reviewer:profiles!lexia_document_reviews_reviewer_id_fkey(first_name,last_name)'
    )
    .eq('document_id', documentId)
    .order('requested_at', { ascending: true })
  if (revErr) throw new Error(`getDocumentReviewState: ${revErr.message}`)

  const d = doc as {
    review_status: DocumentReviewState['reviewStatus']
    approved_by: string | null
    approved_at: string | null
    review_snapshot_version: number | null
  }

  return {
    reviewStatus: d.review_status,
    approvedBy: d.approved_by,
    approvedAt: d.approved_at,
    reviewSnapshotVersion: d.review_snapshot_version,
    reviews: (reviews ?? []).map((r) => reviewRowToDTO(r as ReviewRow)),
  }
}

export async function requestReview(
  db: SupabaseClient,
  params: {
    documentId: string
    requestedBy: string
    reviewerIds: string[]
    currentVersion: number
  }
): Promise<ReviewDTO[]> {
  const uniq = Array.from(new Set(params.reviewerIds.filter((id) => id && id !== params.requestedBy)))
  if (uniq.length === 0) throw new Error('Se requiere al menos un revisor')

  // Cancel existing pending reviews for this document first.
  await db
    .from('lexia_document_reviews')
    .update({ status: 'cancelled', decided_at: new Date().toISOString() })
    .eq('document_id', params.documentId)
    .eq('status', 'pending')

  const rows = uniq.map((reviewerId) => ({
    document_id: params.documentId,
    requested_by: params.requestedBy,
    reviewer_id: reviewerId,
    status: 'pending' as const,
  }))
  const { data, error } = await db
    .from('lexia_document_reviews')
    .insert(rows)
    .select(
      '*, reviewer:profiles!lexia_document_reviews_reviewer_id_fkey(first_name,last_name)'
    )
  if (error) throw new Error(`requestReview: ${error.message}`)

  // Update document state.
  await db
    .from('lexia_documents')
    .update({
      review_status: 'in_review',
      review_snapshot_version: params.currentVersion,
      approved_by: null,
      approved_at: null,
    })
    .eq('id', params.documentId)

  const reviews = (data ?? []).map((r) => reviewRowToDTO(r as ReviewRow))

  await notifyReviewRequested(db, {
    documentId: params.documentId,
    requestedBy: params.requestedBy,
    reviewerIds: uniq,
  }).catch(() => undefined)

  return reviews
}

export async function decideReview(
  db: SupabaseClient,
  params: {
    reviewId: string
    reviewerId: string
    decision: 'approved' | 'rejected'
    reason?: string | null
  }
): Promise<{ review: ReviewDTO; documentStatus: DocumentReviewState['reviewStatus'] }> {
  // Load review + doc
  const { data: existing, error: existErr } = await db
    .from('lexia_document_reviews')
    .select('id, document_id, reviewer_id, status, requested_by')
    .eq('id', params.reviewId)
    .maybeSingle()
  if (existErr || !existing) throw new Error('Revision no encontrada')
  const exist = existing as {
    id: string
    document_id: string
    reviewer_id: string
    status: string
    requested_by: string
  }
  if (exist.reviewer_id !== params.reviewerId) {
    throw new Error('Solo el revisor asignado puede decidir')
  }
  if (exist.status !== 'pending') {
    throw new Error('La revision ya fue decidida o cancelada')
  }

  const { data: updated, error: updErr } = await db
    .from('lexia_document_reviews')
    .update({
      status: params.decision,
      decision_reason: params.reason ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', params.reviewId)
    .select(
      '*, reviewer:profiles!lexia_document_reviews_reviewer_id_fkey(first_name,last_name)'
    )
    .single()
  if (updErr || !updated) throw new Error(`decideReview: ${updErr?.message ?? 'unknown'}`)

  // If rejected: mark doc as rejected immediately; pending others stay pending
  // but the requester is notified so they can cancel / rework.
  // If approved and no pending remain: mark doc approved.
  let documentStatus: DocumentReviewState['reviewStatus'] = 'in_review'
  if (params.decision === 'rejected') {
    await db
      .from('lexia_documents')
      .update({ review_status: 'rejected' })
      .eq('id', exist.document_id)
    documentStatus = 'rejected'
  } else {
    const { count } = await db
      .from('lexia_document_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', exist.document_id)
      .eq('status', 'pending')
    if ((count ?? 0) === 0) {
      await db
        .from('lexia_documents')
        .update({
          review_status: 'approved',
          approved_by: params.reviewerId,
          approved_at: new Date().toISOString(),
        })
        .eq('id', exist.document_id)
      documentStatus = 'approved'
    }
  }

  await notifyReviewDecided(db, {
    documentId: exist.document_id,
    requestedBy: exist.requested_by,
    reviewerId: params.reviewerId,
    decision: params.decision,
    reason: params.reason ?? null,
  }).catch(() => undefined)

  return { review: reviewRowToDTO(updated as ReviewRow), documentStatus }
}

export async function cancelReview(
  db: SupabaseClient,
  params: { reviewId: string; userId: string }
): Promise<ReviewDTO> {
  const { data, error } = await db
    .from('lexia_document_reviews')
    .update({ status: 'cancelled', decided_at: new Date().toISOString() })
    .eq('id', params.reviewId)
    .eq('status', 'pending')
    .select(
      '*, reviewer:profiles!lexia_document_reviews_reviewer_id_fkey(first_name,last_name)'
    )
    .single()
  if (error || !data) throw new Error(`cancelReview: ${error?.message ?? 'unknown'}`)

  // If this was the last pending review, move doc back to draft.
  const row = data as ReviewRow
  const { count } = await db
    .from('lexia_document_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', row.document_id)
    .eq('status', 'pending')
  if ((count ?? 0) === 0) {
    await db
      .from('lexia_documents')
      .update({ review_status: 'draft' })
      .eq('id', row.document_id)
  }

  return reviewRowToDTO(row)
}

// =============================================================================
// Notification glue
// =============================================================================

async function notifyCommentAdded(
  db: SupabaseClient,
  params: { documentId: string; authorId: string; commentId: string; excerpt: string }
) {
  // Notify document owner + any active reviewer (excluding author).
  const { data: doc } = await db
    .from('lexia_documents')
    .select('user_id, title, case_id')
    .eq('id', params.documentId)
    .maybeSingle()
  if (!doc) return

  const d = doc as { user_id: string; title: string; case_id: string | null }
  const targets = new Set<string>()
  if (d.user_id !== params.authorId) targets.add(d.user_id)

  const { data: reviewers } = await db
    .from('lexia_document_reviews')
    .select('reviewer_id')
    .eq('document_id', params.documentId)
    .eq('status', 'pending')
  for (const r of reviewers ?? []) {
    const id = (r as { reviewer_id: string }).reviewer_id
    if (id !== params.authorId) targets.add(id)
  }

  if (targets.size === 0) return

  await insertNotifications(db, {
    userIds: Array.from(targets),
    category: 'activity',
    type: 'document_comment',
    title: 'Nuevo comentario en documento',
    message: `${d.title}: "${params.excerpt.slice(0, 120)}"`,
    caseId: d.case_id ?? undefined,
    triggeredBy: params.authorId,
    metadata: { documentId: params.documentId, commentId: params.commentId },
  })
}

async function notifyReviewRequested(
  db: SupabaseClient,
  params: { documentId: string; requestedBy: string; reviewerIds: string[] }
) {
  const { data: doc } = await db
    .from('lexia_documents')
    .select('title, case_id')
    .eq('id', params.documentId)
    .maybeSingle()
  if (!doc) return
  const d = doc as { title: string; case_id: string | null }

  await insertNotifications(db, {
    userIds: params.reviewerIds,
    category: 'work',
    type: 'review_requested',
    title: 'Revision solicitada',
    message: `Te pidieron revisar el documento: ${d.title}`,
    caseId: d.case_id ?? undefined,
    triggeredBy: params.requestedBy,
    metadata: { documentId: params.documentId },
  })
}

async function notifyReviewDecided(
  db: SupabaseClient,
  params: {
    documentId: string
    requestedBy: string
    reviewerId: string
    decision: 'approved' | 'rejected'
    reason: string | null
  }
) {
  const { data: doc } = await db
    .from('lexia_documents')
    .select('title, case_id')
    .eq('id', params.documentId)
    .maybeSingle()
  if (!doc) return
  const d = doc as { title: string; case_id: string | null }

  await insertNotifications(db, {
    userIds: [params.requestedBy],
    category: 'work',
    type: 'review_decided',
    title: params.decision === 'approved' ? 'Revision aprobada' : 'Revision rechazada',
    message: params.reason
      ? `${d.title}: ${params.decision}. ${params.reason.slice(0, 120)}`
      : `${d.title}: ${params.decision}`,
    caseId: d.case_id ?? undefined,
    triggeredBy: params.reviewerId,
    metadata: { documentId: params.documentId, decision: params.decision },
  })
}
