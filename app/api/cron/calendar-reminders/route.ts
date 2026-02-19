/**
 * Cron: Calendar Reminders
 *
 * Creates notifications for upcoming deadlines, tasks, and Google Calendar events.
 * Called by Vercel Cron (daily) or manually with CRON_SECRET.
 *
 * Security: Requires Authorization: Bearer <CRON_SECRET>
 */
import { NextResponse } from 'next/server'
import { runCalendarRemindersJob } from '@/lib/services/calendar-reminders'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  const token = authHeader?.replace(/^Bearer\s+/i, '')

  if (!expected || token !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { created } = await runCalendarRemindersJob()
    return NextResponse.json({ ok: true, created })
  } catch (err) {
    console.error('[cron] calendar-reminders error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
