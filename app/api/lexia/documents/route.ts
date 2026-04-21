/**
 * POST   /api/lexia/documents      - Create a new workspace document from template
 * GET    /api/lexia/documents      - List documents (scope: user / case)
 */

import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import {
  createDocument,
  listDocuments,
  isWorkspaceDocumentType,
  getInitialDocument,
  defaultTitleFor,
  CLIENT_ROLES,
  type ClientRole,
} from '@/lib/lexia/workspace'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Cuerpo JSON invalido' }, { status: 400 })
  }

  const documentType = typeof body.documentType === 'string' ? body.documentType : ''
  if (!isWorkspaceDocumentType(documentType)) {
    return Response.json(
      { error: `Tipo de documento no soportado. Valores: demanda | contestacion` },
      { status: 400 }
    )
  }

  const caseId = typeof body.caseId === 'string' ? body.caseId : null
  if (caseId) {
    const canEdit = await checkCasePermission(supabase, user.id, caseId, 'can_edit')
    if (!canEdit) {
      return Response.json({ error: 'Sin permisos de edición sobre el caso' }, { status: 403 })
    }
  }

  const rawRole = typeof body.clientRole === 'string' ? body.clientRole : null
  const clientRole: ClientRole | null =
    rawRole && (CLIENT_ROLES as readonly string[]).includes(rawRole)
      ? (rawRole as ClientRole)
      : documentType === 'demanda'
        ? 'actor'
        : 'demandado'

  // Try to enrich title with case number for better UX.
  let caseNumber: string | null = null
  if (caseId) {
    const { data: caseRow } = await supabase
      .from('cases')
      .select('case_number')
      .eq('id', caseId)
      .maybeSingle()
    caseNumber = (caseRow as { case_number?: string } | null)?.case_number ?? null
  }

  const initialContent = getInitialDocument(documentType)
  const title = typeof body.title === 'string' && body.title.trim()
    ? body.title.trim()
    : defaultTitleFor(documentType, caseNumber)

  try {
    const doc = await createDocument(supabase, {
      userId: user.id,
      caseId,
      documentType,
      title,
      content: initialContent,
      clientRole,
      metadata: {
        createdFrom: 'template',
      },
    })
    return Response.json({ document: doc }, { status: 201 })
  } catch (err) {
    console.error('[Lexia Workspace] create error:', err)
    return Response.json({ error: 'Error creando el documento' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const caseIdParam = url.searchParams.get('caseId')
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Number.isFinite(limitParam) ? limitParam : 50

  if (caseIdParam) {
    const canView = await checkCasePermission(supabase, user.id, caseIdParam, 'can_view')
    if (!canView) return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const documents = await listDocuments(supabase, {
      userId: user.id,
      caseId: caseIdParam ?? undefined,
      limit,
    })
    return Response.json({ documents })
  } catch (err) {
    console.error('[Lexia Workspace] list error:', err)
    return Response.json({ error: 'Error listando documentos' }, { status: 500 })
  }
}
