/**
 * Lexia Document Templates API
 * GET /api/lexia/templates - List templates (global + org)
 * POST /api/lexia/templates - Create org template (duplicate from global)
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDocumentType, type DocumentType } from '@/lib/ai/draft-schemas'
import { DOCUMENT_TYPE_SCHEMAS } from '@/lib/ai/draft-schemas'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const documentType = searchParams.get('documentType')

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const orgId = profile?.organization_id ?? null

    let query = supabase
      .from('lexia_document_templates')
      .select('id, organization_id, document_type, name, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('document_type', { ascending: true })

    if (documentType && isDocumentType(documentType)) {
      query = query.eq('document_type', documentType)
    }

    const { data: templates, error } = await query

    if (error) {
      console.error('[Lexia Templates] GET error:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    const filtered = (templates ?? []).filter(
      (t) => t.organization_id === orgId || t.organization_id === null
    )

    return NextResponse.json(filtered)
  } catch (err) {
    console.error('[Lexia Templates] Error:', err)
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    const orgId = profile?.organization_id ?? null
    if (!orgId) {
      return NextResponse.json(
        { error: 'User must belong to an organization to create templates' },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const documentType = body.documentType as string
    const name = body.name as string | undefined
    const systemPromptFragment = body.system_prompt_fragment as string | undefined
    const templateContent = body.template_content as string | undefined
    const structureSchema = body.structure_schema as object | undefined

    if (!isDocumentType(documentType)) {
      return NextResponse.json({ error: 'Invalid documentType' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('lexia_document_templates')
      .select('id')
      .eq('organization_id', orgId)
      .eq('document_type', documentType)
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Organization already has a template for this document type' },
        { status: 409 }
      )
    }

    const { data: globalTemplate } = await supabase
      .from('lexia_document_templates')
      .select('name, structure_schema, template_content, system_prompt_fragment')
      .eq('document_type', documentType)
      .is('organization_id', null)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    const defaultSchema = DOCUMENT_TYPE_SCHEMAS[documentType as DocumentType]
    const defaultStructureSchema = { fields: defaultSchema.fields.map((f) => f.key) }

    const insert = {
      organization_id: orgId,
      document_type: documentType,
      name: name ?? globalTemplate?.name ?? documentType,
      structure_schema: structureSchema ?? globalTemplate?.structure_schema ?? defaultStructureSchema,
      template_content: templateContent ?? globalTemplate?.template_content ?? '',
      system_prompt_fragment: systemPromptFragment ?? globalTemplate?.system_prompt_fragment ?? '',
      is_active: true,
    }

    const { data: created, error } = await supabase
      .from('lexia_document_templates')
      .insert(insert)
      .select('id, document_type, name, organization_id, created_at')
      .single()

    if (error) {
      console.error('[Lexia Templates] POST error:', error)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json(created)
  } catch (err) {
    console.error('[Lexia Templates] Error:', err)
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 })
  }
}
