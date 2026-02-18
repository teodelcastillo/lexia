/**
 * Lexia Estratega - Analyze API
 * POST /api/lexia/estratega/analyze
 * Runs a full strategic analysis for a case.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCasePermission } from '@/lib/utils/access-control'
import { analyzeCase } from '@/lib/lexia/estratega/strategic-analyzer'
import type { AnalyzeParams } from '@/lib/lexia/estratega/types'

// Simple in-memory rate limiter (5 analyses per minute per user)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 60_000

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Esperá un minuto.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { caseId } = body as { caseId?: string }

    if (!caseId) {
      return NextResponse.json({ error: 'caseId es requerido' }, { status: 400 })
    }

    // Verify case access
    const canView = await checkCasePermission(supabase, user.id, caseId, 'can_view')
    if (!canView) {
      return NextResponse.json({ error: 'Sin acceso al caso' }, { status: 403 })
    }

    // Load case data
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, case_number, title, case_type, description, filing_date, jurisdiction, court_name, estimated_value')
      .eq('id', caseId)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
    }

    if (!caseData.description?.trim()) {
      return NextResponse.json(
        { error: 'El caso necesita una descripción para poder analizarlo' },
        { status: 422 }
      )
    }

    const params: AnalyzeParams = {
      caseId: caseData.id,
      caseNumber: caseData.case_number,
      caseTitle: caseData.title,
      caseType: caseData.case_type,
      description: caseData.description,
      filingDate: caseData.filing_date ?? null,
      jurisdiction: caseData.jurisdiction ?? null,
      courtName: caseData.court_name ?? null,
      estimatedValue: caseData.estimated_value ?? null,
    }

    // Run the full strategic analysis
    const analysis = await analyzeCase(params)

    // Persist analysis
    const { data: saved, error: saveError } = await supabase
      .from('lexia_strategic_analyses')
      .upsert(
        {
          user_id: user.id,
          case_id: caseId,
          analysis,
        },
        {
          onConflict: 'case_id,user_id',
          ignoreDuplicates: false,
        }
      )
      .select('id, created_at, updated_at')
      .single()

    if (saveError) {
      // If upsert fails (e.g. no unique constraint), insert fresh
      const { data: inserted, error: insertError } = await supabase
        .from('lexia_strategic_analyses')
        .insert({ user_id: user.id, case_id: caseId, analysis })
        .select('id, created_at, updated_at')
        .single()

      if (insertError) {
        console.error('[Estratega] Save error:', insertError)
        return NextResponse.json({ error: 'Error al guardar análisis' }, { status: 500 })
      }

      // Log activity
      await supabase.from('activity_log').insert({
        user_id: user.id,
        case_id: caseId,
        action_type: 'lexia_query',
        entity_type: 'case',
        entity_id: caseId,
        description: `Lexia Estratega: Análisis estratégico completo (${analysis.metadata.durationMs}ms)`,
      }).throwOnError().catch(() => null)

      return NextResponse.json({ analysisId: inserted!.id, analysis })
    }

    // Log activity
    await supabase.from('activity_log').insert({
      user_id: user.id,
      case_id: caseId,
      action_type: 'lexia_query',
      entity_type: 'case',
      entity_id: caseId,
      description: `Lexia Estratega: Análisis estratégico completo (${analysis.metadata.durationMs}ms)`,
    }).throwOnError().catch(() => null)

    return NextResponse.json({ analysisId: saved!.id, analysis })
  } catch (err) {
    console.error('[Estratega] Analyze error:', err)
    const message = err instanceof Error ? err.message : 'Error al analizar caso'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
