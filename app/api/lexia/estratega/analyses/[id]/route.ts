/**
 * Lexia Estratega - Get Single Analysis
 * GET /api/lexia/estratega/analyses/[id]
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
      .from('lexia_strategic_analyses')
      .select('id, case_id, analysis, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Análisis no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ analysis: data })
  } catch (err) {
    console.error('[Estratega] Get analysis error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
