/**
 * Database persistence helpers for the Lexia Workspace.
 * Server-only (imports @/lib/supabase/server indirectly through typed client).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TiptapDoc, WorkspaceDocumentDTO, ClientRole } from './types'
import { docToPlainText } from './tiptap-utils'

type DB = SupabaseClient

interface DocumentRow {
  id: string
  document_type: string
  title: string
  content: TiptapDoc
  content_text: string
  case_id: string | null
  client_role: ClientRole | null
  metadata: Record<string, unknown>
  active_context: { documentIds: string[]; personIds: string[] }
  version: number
  created_at: string
  updated_at: string
  user_id: string
}

function rowToDTO(row: DocumentRow): WorkspaceDocumentDTO {
  return {
    id: row.id,
    documentType: row.document_type,
    title: row.title,
    content: row.content,
    contentText: row.content_text,
    caseId: row.case_id,
    clientRole: row.client_role,
    metadata: row.metadata ?? {},
    activeContext: row.active_context ?? { documentIds: [], personIds: [] },
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createDocument(
  db: DB,
  params: {
    userId: string
    caseId: string | null
    documentType: string
    title: string
    content: TiptapDoc
    clientRole: ClientRole | null
    metadata?: Record<string, unknown>
  }
): Promise<WorkspaceDocumentDTO> {
  const contentText = docToPlainText(params.content)
  const baseInsertPayload = {
    user_id: params.userId,
    case_id: params.caseId,
    document_type: params.documentType,
    title: params.title,
    content: params.content,
    content_text: contentText,
  }
  const extendedInsertPayload = {
    ...baseInsertPayload,
    client_role: params.clientRole,
    metadata: params.metadata ?? {},
    active_context: { documentIds: [], personIds: [] },
    version: 1,
  }
  let { data, error } = await db
    .from('lexia_documents')
    .insert(extendedInsertPayload)
    .select('*')
    .single()
  // Backward-compatible fallback for environments with partial migrations.
  if (error?.code === '42703') {
    ;({ data, error } = await db
      .from('lexia_documents')
      .insert(baseInsertPayload)
      .select('*')
      .single())
  }
  if (error || !data) {
    const details = [error?.code, error?.message, error?.details, error?.hint]
      .filter(Boolean)
      .join(' | ')
    throw new Error(`Failed to create document: ${details || 'no data'}`)
  }
  const row = data as unknown as DocumentRow
  // Persist the initial version snapshot.
  const { error: versionError } = await db.from('lexia_document_versions').insert({
    document_id: row.id,
    user_id: params.userId,
    version: 1,
    content: params.content,
    content_text: contentText,
    source: 'template',
    summary: 'Documento creado a partir de plantilla',
  })
  if (versionError) {
    const details = [versionError.code, versionError.message, versionError.details, versionError.hint]
      .filter(Boolean)
      .join(' | ')
    throw new Error(`Failed to create initial document version: ${details}`)
  }
  return rowToDTO(row)
}

export async function getDocument(db: DB, id: string): Promise<WorkspaceDocumentDTO | null> {
  const { data, error } = await db
    .from('lexia_documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`Failed to load document: ${error.message}`)
  if (!data) return null
  return rowToDTO(data as unknown as DocumentRow)
}

export async function updateDocumentContent(
  db: DB,
  params: {
    id: string
    userId: string
    content: TiptapDoc
    title?: string
    activeContext?: { documentIds: string[]; personIds: string[] }
    source?: 'manual' | 'ai_edit' | 'ai_agent'
    summary?: string
    editId?: string | null
    /**
     * When true, editing is allowed even if the document is in `approved`
     * review_status. Reserved for admins / explicit override; the UI never
     * sets this by default.
     */
    forceEditApproved?: boolean
  }
): Promise<WorkspaceDocumentDTO> {
  const contentText = docToPlainText(params.content)

  // Load current version + review state to guard against editing approved
  // documents (unless explicitly forced).
  const { data: current, error: curErr } = await db
    .from('lexia_documents')
    .select('version, user_id, review_status')
    .eq('id', params.id)
    .maybeSingle()
  if (curErr || !current) {
    throw new Error(`Failed to load document for update: ${curErr?.message ?? 'not found'}`)
  }
  const cur = current as { version: number; review_status?: string }
  if (cur.review_status === 'approved' && !params.forceEditApproved) {
    throw new Error(
      'El documento esta aprobado. Creá una nueva version antes de editarlo.'
    )
  }
  const nextVersion = (cur.version ?? 1) + 1

  const updatePayload: Record<string, unknown> = {
    content: params.content,
    content_text: contentText,
    version: nextVersion,
  }
  if (params.title !== undefined) updatePayload.title = params.title
  if (params.activeContext !== undefined) updatePayload.active_context = params.activeContext

  const { data: updated, error: updErr } = await db
    .from('lexia_documents')
    .update(updatePayload)
    .eq('id', params.id)
    .select('*')
    .maybeSingle()
  if (updErr || !updated) {
    throw new Error(`Failed to update document: ${updErr?.message ?? 'blocked by RLS'}`)
  }

  await db.from('lexia_document_versions').insert({
    document_id: params.id,
    user_id: params.userId,
    version: nextVersion,
    content: params.content,
    content_text: contentText,
    source: params.source ?? 'manual',
    summary: params.summary ?? null,
    edit_id: params.editId ?? null,
  })

  return rowToDTO(updated as unknown as DocumentRow)
}

export async function listDocuments(
  db: DB,
  params: { userId: string; caseId?: string | null; limit?: number }
): Promise<WorkspaceDocumentDTO[]> {
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 100)
  let q = db
    .from('lexia_documents')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (params.caseId !== undefined) {
    if (params.caseId === null) q = q.is('case_id', null)
    else q = q.eq('case_id', params.caseId)
  }
  const { data, error } = await q
  if (error) throw new Error(`Failed to list documents: ${error.message}`)
  return (data as unknown as DocumentRow[]).map(rowToDTO)
}
