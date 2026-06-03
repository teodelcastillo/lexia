/**
 * Cron: SAC Sync
 *
 * Daily job that synchronizes all active cases linked to SAC expedientes.
 * Processes up to 50 cases per run with rate limiting between requests.
 *
 * Security: Requires Authorization: Bearer <CRON_SECRET>
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncSacCase } from '@/lib/sac/sync'
import { waitBetweenQueries, waitBetweenBatches } from '@/lib/sac/http-scraper'
import { SAC_RATE_LIMITS } from '@/lib/sac/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  const token = authHeader?.replace(/^Bearer\s+/i, '')

  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    // Fetch active cases with SAC expediente linked, ordered by oldest sync first
    const { data: cases, error } = await supabase
      .from('cases')
      .select(
        'id, case_number, title, organization_id, sac_expediente_number, sac_anio, sac_fuero, sac_responsible_lawyer_id, sac_last_sync'
      )
      .eq('status', 'active')
      .not('sac_expediente_number', 'is', null)
      .not('sac_responsible_lawyer_id', 'is', null)
      .order('sac_last_sync', { ascending: true, nullsFirst: true })
      .limit(SAC_RATE_LIMITS.maxCasesPerRun)

    if (error) {
      console.error('[cron sac-sync] query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!cases || cases.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: 'No cases to sync' })
    }

    const results: { caseId: string; caseNumber: string; status: string; movements: number }[] = []

    for (let i = 0; i < cases.length; i++) {
      const c = cases[i]

      try {
        const result = await syncSacCase({
          caseId: c.id,
          caseNumber: c.case_number,
          caseTitle: c.title,
          expedienteNumber: c.sac_expediente_number!,
          anio: c.sac_anio || '',
          fuero: c.sac_fuero || undefined,
          lawyerId: c.sac_responsible_lawyer_id!,
          organizationId: c.organization_id,
          supabase,
        })

        results.push({
          caseId: c.id,
          caseNumber: c.case_number,
          status: result.status,
          movements: result.new_movements_inserted,
        })
      } catch (err) {
        console.error(`[cron sac-sync] case ${c.case_number}:`, err)
        results.push({
          caseId: c.id,
          caseNumber: c.case_number,
          status: 'error',
          movements: 0,
        })
      }

      // Rate limiting
      if (i < cases.length - 1) {
        const isEndOfBatch = (i + 1) % SAC_RATE_LIMITS.batchSize === 0
        if (isEndOfBatch) {
          await waitBetweenBatches()
        } else {
          await waitBetweenQueries()
        }
      }
    }

    const totalNew = results.reduce((sum, r) => sum + r.movements, 0)

    return NextResponse.json({
      ok: true,
      processed: results.length,
      total_new_movements: totalNew,
      results,
    })
  } catch (err) {
    console.error('[cron sac-sync] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
