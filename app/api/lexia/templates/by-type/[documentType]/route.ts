/**
 * Lexia Document Templates - Get effective template by document type
 * GET /api/lexia/templates/by-type/[documentType]
 * Returns org template if exists, otherwise global. Used by Redactor and editor.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDocumentType } from '@/lib/ai/draft-schemas'
import { getFieldsForDocumentType } from '@/lib/ai/draft-schemas'
import type { StructureSchema } from '@/lib/ai/draft-schemas'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentType: string }> }
) {
  try {
    const { documentType } = await params
    if (!isDocumentType(documentType)) {
      return NextResponse.json({ error: 'Invalid documentType' }, { status: 400 })
    }

    const { searchParams } = new URL(req.url)
    const variant = searchParams.get('variant') ?? ''

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

    let template: {
      id: string
      organization_id: string | null
      document_type: string
      name: string
      structure_schema: unknown
      template_content: string | null
      system_prompt_fragment: string | null
      is_active: boolean
    } | null = null

    if (orgId) {
      const { data: orgTemplate } = await supabase
        .from('lexia_document_templates')
        .select('id, organization_id, document_type, variant, name, structure_schema, template_content, system_prompt_fragment, is_active')
        .eq('document_type', documentType)
        .eq('variant', variant)
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (orgTemplate) template = orgTemplate as typeof template
    }

    if (!template) {
      const { data: globalTemplate } = await supabase
        .from('lexia_document_templates')
        .select('id, organization_id, document_type, variant, name, structure_schema, template_content, system_prompt_fragment, is_active')
        .eq('document_type', documentType)
        .eq('variant', variant)
        .is('organization_id', null)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()
      if (globalTemplate) template = globalTemplate as typeof template
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const structureSchema = template.structure_schema as StructureSchema
    const sanitizedStructureSchema =
      structureSchema && typeof structureSchema === 'object' && Array.isArray(structureSchema.fields)
        ? structureSchema
        : null

    const fields = getFieldsForDocumentType(documentType, sanitizedStructureSchema)

    return NextResponse.json({
      id: template.id,
      organization_id: template.organization_id,
      document_type: template.document_type,
      variant: (template as { variant?: string }).variant ?? '',
      name: template.name,
      structure_schema: template.structure_schema,
      template_content: template.template_content,
      system_prompt_fragment: template.system_prompt_fragment,
      is_active: template.is_active,
      isOrgTemplate: template.organization_id !== null,
      fields,
    })
  } catch (err) {
    console.error('[Lexia Templates] by-type GET error:', err)
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 })
  }
}
