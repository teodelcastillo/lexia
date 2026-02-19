'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Bell, 
  CheckCheck, 
  Clock, 
  FileText, 
  Users, 
  Briefcase, 
  Calendar, 
  Loader2,
  Filter,
  Inbox
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  category: 'activity' | 'work'
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  case_id?: string
  task_id?: string
  deadline_id?: string
  document_id?: string
  metadata?: { google_calendar_event_id?: string }
  triggered_by_profile?: {
    id: string
    first_name: string
    last_name: string
    avatar_url?: string
  }
  case?: {
    id: string
    case_number: string
    title: string
  }
}

/**
 * Get icon for notification type
 */
function getNotificationIcon(type: string) {
  switch (type) {
    case 'task_assigned':
    case 'task_completed':
    case 'task_overdue':
      return CheckCheck
    case 'deadline_approaching':
    case 'deadline_overdue':
    case 'deadline_created':
    case 'task_approaching':
    case 'calendar_event_approaching':
      return Calendar
    case 'document_uploaded':
    case 'document_deleted':
      return FileText
    case 'case_created':
    case 'case_updated':
    case 'case_assigned':
      return Briefcase
    case 'user_created':
    case 'user_login':
      return Users
    default:
      return Bell
  }
}

/**
 * Format relative time
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `Hace ${diffMins} minutos`
  if (diffHours < 24) return `Hace ${diffHours} horas`
  if (diffDays < 7) return `Hace ${diffDays} días`
  return date.toLocaleDateString('es-AR', { 
    day: 'numeric', 
    month: 'long',
    year: diffDays > 365 ? 'numeric' : undefined 
  })
}

/**
 * Full page notifications view
 */
export function NotificationsView() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [counts, setCounts] = useState({ total: 0, activity: 0, work: 0 })
  const [activeTab, setActiveTab] = useState<'all' | 'work' | 'activity'>('all')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const category = activeTab === 'all' ? '' : activeTab
      const unread = filter === 'unread' ? '&unread=true' : ''
      const url = `/api/notifications?limit=100${category ? `&category=${category}` : ''}${unread}`
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setCounts(data.counts || { total: 0, activity: 0, work: 0 })
      }
    } catch (error) {
      console.error('[v0] Error fetching notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, filter])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkAllRead = async () => {
    try {
      const category = activeTab === 'all' ? undefined : activeTab
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true, category }),
      })
      fetchNotifications()
    } catch (error) {
      console.error('[v0] Error marking notifications as read:', error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notification.id] }),
      })
      fetchNotifications()
    }

    if (notification.case_id) {
      router.push(`/casos/${notification.case_id}`)
    } else if (notification.task_id) {
      router.push(`/tareas`)
    } else if (notification.deadline_id) {
      router.push(`/eventos`)
    } else if (notification.metadata?.google_calendar_event_id) {
      router.push(`/calendario`)
    }
  }

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true
    return n.category === activeTab
  })

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = new Date(notification.created_at)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    let key: string
    if (date.toDateString() === today.toDateString()) {
      key = 'Hoy'
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Ayer'
    } else {
      key = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
    }
    
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(notification)
    return groups
  }, {} as Record<string, Notification[]>)

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sin leer</CardTitle>
            <Inbox className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.total}</div>
            <p className="text-xs text-muted-foreground">notificaciones pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Trabajo</CardTitle>
            <Briefcase className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.work}</div>
            <p className="text-xs text-muted-foreground">tareas y vencimientos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Actividad</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.activity}</div>
            <p className="text-xs text-muted-foreground">registro de actividad</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList>
                <TabsTrigger value="all">
                  Todas
                  {counts.total > 0 && (
                    <Badge variant="secondary" className="ml-1.5">{counts.total}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="work">
                  Trabajo
                  {counts.work > 0 && (
                    <Badge variant="destructive" className="ml-1.5">{counts.work}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="activity">
                  Actividad
                  {counts.activity > 0 && (
                    <Badge variant="secondary" className="ml-1.5">{counts.activity}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="unread">Sin leer</SelectItem>
                </SelectContent>
              </Select>

              {counts.total > 0 && (
                <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Marcar leídas
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : Object.keys(groupedNotifications).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold">No hay notificaciones</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {filter === 'unread' 
                  ? 'No tienes notificaciones sin leer' 
                  : 'Aún no tienes notificaciones'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedNotifications).map(([date, notifications]) => (
                <div key={date}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">{date}</h3>
                  <div className="space-y-2">
                    {notifications.map((notification) => {
                      const Icon = getNotificationIcon(notification.type)
                      const isWork = notification.category === 'work'

                      return (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={cn(
                            "w-full flex items-start gap-4 p-4 text-left rounded-lg border transition-colors hover:bg-muted/50",
                            !notification.is_read && "bg-primary/5 border-primary/20"
                          )}
                        >
                          <div className={cn(
                            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                            isWork ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <p className={cn(
                                  "text-sm",
                                  !notification.is_read && "font-semibold"
                                )}>
                                  {notification.title}
                                </p>
                                {!notification.is_read && (
                                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatRelativeTime(notification.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {notification.message}
                            </p>
                            {notification.case && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Briefcase className="h-3 w-3" />
                                <span>{notification.case.case_number} - {notification.case.title}</span>
                              </div>
                            )}
                            {notification.triggered_by_profile && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                <span>
                                  {notification.triggered_by_profile.first_name} {notification.triggered_by_profile.last_name}
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
