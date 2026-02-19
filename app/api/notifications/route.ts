import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const GET_QUERY_SCHEMA = z.object({
  category: z.enum(['activity', 'work']).optional(),
  unread: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const PATCH_BODY_SCHEMA = z.object({
  markAll: z.boolean().optional(),
  category: z.enum(['activity', 'work']).optional(),
  notificationIds: z.array(z.string().uuid()).max(200).optional(),
})

/**
 * GET /api/notifications
 * Fetches notifications for the current user, optionally filtered by category
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const parsed = GET_QUERY_SCHEMA.safeParse({
    category: searchParams.get('category') ?? undefined,
    unread: searchParams.get('unread') ?? undefined,
    limit: searchParams.get('limit') ?? 20,
  })
  const { category, limit } = parsed.success
    ? parsed.data
    : { category: undefined, limit: 20 }
  const unreadOnly = searchParams.get('unread') === 'true'
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Build query
  let query = supabase
    .from('notifications')
    .select(`
      *,
      triggered_by_profile:profiles!notifications_triggered_by_fkey(id, first_name, last_name, avatar_url),
      case:cases(id, case_number, title),
      task:tasks(id, title),
      deadline:deadlines(id, title, due_date)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (category && (category === 'activity' || category === 'work')) {
    query = query.eq('category', category)
  }

  if (unreadOnly) {
    query = query.eq('is_read', false)
  }

  const { data: notifications, error } = await query

  if (error) {
    console.error('[v0] Error fetching notifications:', error)
    return NextResponse.json({ error: 'Error fetching notifications' }, { status: 500 })
  }

  // Get unread counts
  const { count: totalUnread } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  const { count: activityUnread } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('category', 'activity')
    .eq('is_read', false)

  const { count: workUnread } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('category', 'work')
    .eq('is_read', false)

  return NextResponse.json({
    notifications,
    counts: {
      total: totalUnread || 0,
      activity: activityUnread || 0,
      work: workUnread || 0,
    },
  })
}

/**
 * PATCH /api/notifications
 * Mark notifications as read
 */
export async function PATCH(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawBody = await request.json().catch(() => ({}))
  const parsed = PATCH_BODY_SCHEMA.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { notificationIds, markAll, category } = parsed.data

  if (markAll) {
    // Mark all notifications as read (optionally by category)
    let query = supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (category) {
      query = query.eq('category', category)
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: 'Error updating notifications' }, { status: 500 })
    }
  } else if (notificationIds && notificationIds.length > 0) {
    // Mark specific notifications as read
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .in('id', notificationIds)

    if (error) {
      return NextResponse.json({ error: 'Error updating notifications' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
