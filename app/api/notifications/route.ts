import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/notifications
 * Fetches notifications for the current user, optionally filtered by category
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  
  const category = searchParams.get('category') // 'activity' | 'work' | null (all)
  const unreadOnly = searchParams.get('unread') === 'true'
  const limit = parseInt(searchParams.get('limit') || '20')
  
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

  if (category) {
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

  const body = await request.json()
  const { notificationIds, markAll, category } = body

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
