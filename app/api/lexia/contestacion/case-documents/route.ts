/**
 * Lexia Contestación - Case Documents API
 * GET /api/lexia/contestacion/case-documents?caseId=...
 * Lists documents for a case that can be used as demanda source (PDF, Word).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'

const EXTRACTABLE_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]

export async function GET(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const caseId = searchParams.get('caseId')
    if (!caseId) {
      return NextResponse.json(
        { error: 'caseId query parameter is required' },
        { status: 400 }
      )
    }

    const canView = await checkCasePermission(supabase, user.id, caseId, 'can_view')
    if (!canView) {
      return NextResponse.json(
        { error: 'Forbidden: no access to this case' },
        { status: 403 }
      )
    }

    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, name, mime_type, file_path, file_size')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[Contestacion] Case documents error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    const extractable = (documents ?? []).filter(
      (d) => d.mime_type && EXTRACTABLE_MIME.includes(d.mime_type)
    )

    return NextResponse.json({ documents: extractable })
  } catch (err) {
    console.error('[Contestacion] Case documents error:', err)
    return NextResponse.json(
      { error: 'Error fetching documents' },
      { status: 500 }
    )
  }
}
