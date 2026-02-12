/**
 * Lexia Drafts API
 * GET /api/lexia/drafts - List user's drafts
 * POST /api/lexia/drafts - Create draft
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDocumentType } from '@/lib/ai/draft-schemas'
import { getDefaultDraftTitle } from '@/lib/lexia/draft-title'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const caseId = searchParams.get('caseId')
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100)

    let query = supabase
      .from('lexia_drafts')
      .select('id, document_type, name, case_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (caseId) {
      query = query.eq('case_id', caseId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[Lexia Drafts] GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[Lexia Drafts] Error:', err)
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const documentType = body.documentType as string
    const name = body.name as string | undefined
    const content = (body.content ?? '') as string
    const formData = (body.formData ?? {}) as Record<string, string>
    const caseId = body.caseId as string | null | undefined

    if (!isDocumentType(documentType)) {
      return NextResponse.json({ error: 'Invalid documentType' }, { status: 400 })
    }

    const finalName = name?.trim() || getDefaultDraftTitle(documentType, formData)

    const insert = {
      user_id: user.id,
      document_type: documentType,
      name: finalName,
      content: content || '',
      form_data: formData,
      case_id: caseId || null,
    }

    const { data: created, error } = await supabase
      .from('lexia_drafts')
      .insert(insert)
      .select('id, document_type, name, case_id, created_at')
      .single()

    if (error) {
      console.error('[Lexia Drafts] POST error:', error)
      return NextResponse.json({ error: 'Failed to create draft' }, { status: 500 })
    }

    return NextResponse.json(created)
  } catch (err) {
    console.error('[Lexia Drafts] Error:', err)
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 })
  }
}
