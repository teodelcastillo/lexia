/**
 * Procesador de Cédulas - Sugerir caso
 * POST /api/herramientas/cedulas/sugerir-caso
 *
 * Busca un caso que coincida con el expediente y/o carátula extraídos de la cédula.
 * Retorna la sugerencia sin obligar al usuario a usarla.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Normaliza el número de expediente para comparación.
 * Ej: "EX-2024-12345678-CSD" -> "202412345678", "12345/2024" -> "123452024"
 */
function normalizeExpediente(exp: string): string {
  return exp
    .replace(/\s+/g, '')
    .replace(/[-/._]/g, '')
    .replace(/[^0-9a-zA-Z]/g, '')
    .toLowerCase()
}

/**
 * Extrae términos significativos de la carátula/partes para búsqueda.
 * Ej: "Pérez, Juan c/ García, María s/ Daños" -> ["perez", "juan", "garcia", "maria", "danos"]
 */
function extractSearchTerms(caratula: string): string[] {
  return caratula
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 10)
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const numero_expediente = (body.numero_expediente ?? '').trim()
    const partes = (body.partes ?? body.caratula ?? '').trim()

    if (!numero_expediente && !partes) {
      return NextResponse.json({
        suggestedCase: null,
        matchReason: null,
      })
    }

    const { data: cases, error } = await supabase
      .from('cases')
      .select('id, case_number, title')
      .in('status', ['active', 'pending'])
      .order('case_number', { ascending: false })
      .limit(200)

    if (error) {
      console.error('[Cedulas] Sugerir caso error:', error)
      return NextResponse.json({ suggestedCase: null, matchReason: null })
    }

    const caseList = cases ?? []
    if (caseList.length === 0) {
      return NextResponse.json({ suggestedCase: null, matchReason: null })
    }

    const normExpediente = numero_expediente ? normalizeExpediente(numero_expediente) : ''
    const terms = partes ? extractSearchTerms(partes) : []

    let best: { case: (typeof caseList)[0]; score: number; reason: string } | null = null

    for (const c of caseList) {
      const normCaseNumber = c.case_number ? normalizeExpediente(c.case_number) : ''
      const normTitle = (c.title ?? '').toLowerCase()

      let score = 0
      let reason = ''

      // Coincidencia por expediente
      if (normExpediente && normCaseNumber) {
        if (normCaseNumber === normExpediente) {
          score = 100
          reason = 'Expediente coincide'
        } else if (normCaseNumber.includes(normExpediente) || normExpediente.includes(normCaseNumber)) {
          const partialScore = Math.min(normExpediente.length, normCaseNumber.length) / Math.max(normExpediente.length, normCaseNumber.length) * 80
          if (partialScore > score) {
            score = partialScore
            reason = 'Expediente similar'
          }
        }
      }

      // Coincidencia por carátula/partes en título
      if (terms.length > 0 && normTitle) {
        const matchedTerms = terms.filter((t) => normTitle.includes(t))
        const titleScore = (matchedTerms.length / terms.length) * 60
        if (titleScore > score) {
          score = titleScore
          reason = matchedTerms.length >= 2 ? 'Carátula coincide' : 'Carátula parcial'
        }
      }

      if (score > 0 && (!best || score > best.score)) {
        best = { case: c, score, reason }
      }
    }

    // Umbral mínimo para considerar sugerencia válida
    const MIN_SCORE = 40
    if (best && best.score >= MIN_SCORE) {
      return NextResponse.json({
        suggestedCase: best.case,
        matchReason: best.reason,
      })
    }

    return NextResponse.json({ suggestedCase: null, matchReason: null })
  } catch (err) {
    console.error('[Cedulas] Sugerir caso error:', err)
    return NextResponse.json({ suggestedCase: null, matchReason: null })
  }
}
