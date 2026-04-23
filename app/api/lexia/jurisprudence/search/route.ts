/**
 * POST /api/lexia/jurisprudence/search
 *
 * Searches real jurisprudence (SAIJ) with a persistent DB cache.
 * Returns normalized results plus provenance (cache/live/mixed/degraded).
 *
 * Body:
 *   {
 *     query: string
 *     tipo?: 'fallo' | 'sumario' | 'legislacion' | 'dictamen' | 'todos'
 *     jurisdiction?: string
 *     court?: string
 *     dateFrom?: string   // YYYY-MM-DD
 *     dateTo?: string     // YYYY-MM-DD
 *     limit?: number
 *     caseId?: string     // if provided, result top-N will be bookmarked
 *     bookmarkTop?: number
 *   }
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { searchOrFetch, bookmarkForCase } from '@/lib/lexia/juris'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const BodySchema = z.object({
  query: z.string().min(2).max(400),
  tipo: z.enum(['fallo', 'sumario', 'legislacion', 'dictamen', 'todos']).optional(),
  jurisdiction: z.string().max(100).nullable().optional(),
  court: z.string().max(200).nullable().optional(),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  limit: z.number().int().min(1).max(20).optional(),
  caseId: z.string().uuid().optional(),
  bookmarkTop: z.number().int().min(0).max(10).optional(),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json(
      { error: 'Parametros invalidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const p = parsed.data
  const search = await searchOrFetch({
    query: p.query,
    tipo: p.tipo,
    jurisdiction: p.jurisdiction ?? null,
    court: p.court ?? null,
    dateFrom: p.dateFrom ?? null,
    dateTo: p.dateTo ?? null,
    limit: p.limit,
  })

  // Optional: bookmark top-N for a case the user has access to.
  if (p.caseId && p.bookmarkTop && p.bookmarkTop > 0 && search.results.length > 0) {
    // Sanity check: user must have access to the case.
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id')
      .eq('id', p.caseId)
      .maybeSingle()
    if (caseRow) {
      const top = search.results.slice(0, p.bookmarkTop)
      for (const doc of top) {
        await bookmarkForCase({
          caseId: p.caseId,
          jurisId: doc.id,
          userId: user.id,
        }).catch(() => undefined)
      }
    }
  }

  return Response.json({
    results: search.results,
    source: search.source,
    degraded: search.degraded,
    error: search.error,
  })
}
