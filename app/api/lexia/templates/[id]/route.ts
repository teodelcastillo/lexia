/**
 * Lexia Document Templates - Update / Delete org template
 * PUT /api/lexia/templates/[id]
 * DELETE /api/lexia/templates/[id]
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const orgId = profile?.organization_id ?? null
    if (!orgId) {
      return NextResponse.json({ error: 'User must belong to an organization' }, { status: 403 })
    }

    const { data: existing } = await supabase
      .from('lexia_document_templates')
      .select('id, organization_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (existing.organization_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden: cannot update another organization template' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) updates.name = String(body.name)
    if (body.system_prompt_fragment !== undefined) updates.system_prompt_fragment = body.system_prompt_fragment
    if (body.template_content !== undefined) updates.template_content = body.template_content
    if (body.structure_schema !== undefined) {
      if (typeof body.structure_schema === 'object' && body.structure_schema !== null) {
        updates.structure_schema = body.structure_schema
      }
    }
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('lexia_document_templates')
      .update(updates)
      .eq('id', id)
      .select('id, document_type, name, organization_id, updated_at')
      .single()

    if (error) {
      console.error('[Lexia Templates] PUT error:', error)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('[Lexia Templates] Error:', err)
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 })
  }
}

export async function DELETE(
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const orgId = profile?.organization_id ?? null
    if (!orgId) {
      return NextResponse.json({ error: 'User must belong to an organization' }, { status: 403 })
    }

    const { data: existing } = await supabase
      .from('lexia_document_templates')
      .select('id, organization_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (existing.organization_id !== orgId) {
      return NextResponse.json({ error: 'Forbidden: cannot delete another organization template' }, { status: 403 })
    }

    const { error } = await supabase
      .from('lexia_document_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[Lexia Templates] DELETE error:', error)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Lexia Templates] Error:', err)
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 })
  }
}
