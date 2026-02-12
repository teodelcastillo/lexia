/**
 * Lexia Drafts API - Get / Update draft
 * GET /api/lexia/drafts/[id]
 * PATCH /api/lexia/drafts/[id]
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('lexia_drafts')
      .select('id, document_type, name, content, form_data, case_id, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[Lexia Drafts] GET error:', err)
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) updates.name = String(body.name)
    if (body.content !== undefined) updates.content = String(body.content)
    if (body.form_data !== undefined) updates.form_data = body.form_data
    if (body.case_id !== undefined) updates.case_id = body.case_id || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('lexia_drafts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, document_type, name, case_id, updated_at')
      .single()

    if (error) {
      console.error('[Lexia Drafts] PATCH error:', error)
      return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[Lexia Drafts] Error:', err)
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 })
  }
}
