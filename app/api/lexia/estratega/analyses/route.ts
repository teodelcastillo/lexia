/**
 * Lexia Estratega - List Analyses
 * GET /api/lexia/estratega/analyses?caseId=...
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const caseId = searchParams.get('caseId')

    let query = supabase
      .from('lexia_strategic_analyses')
      .select('id, case_id, created_at, updated_at, analysis->caseNumber, analysis->caseTitle, analysis->analyzedAt, analysis->riskMatrix->riskLevel, analysis->riskMatrix->overallScore, analysis->recommendations->primaryStrategy')
      .order('created_at', { ascending: false })
      .limit(20)

    if (caseId) {
      const canView = await checkCasePermission(supabase, user.id, caseId, 'can_view')
      if (!canView) {
        return NextResponse.json({ error: 'Sin acceso al caso' }, { status: 403 })
      }
      query = query.eq('case_id', caseId)
    }

    const { data, error } = await query
    if (error) {
      console.error('[Estratega] List error:', error)
      return NextResponse.json({ error: 'Error al obtener análisis' }, { status: 500 })
    }

    return NextResponse.json({ analyses: data ?? [] })
  } catch (err) {
    console.error('[Estratega] List analyses error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
