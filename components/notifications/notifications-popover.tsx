'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, Clock, FileText, Users, Briefcase, Calendar, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  task?: {
    id: string
    title: string
  }
  deadline?: {
    id: string
    title: string
    due_date: string
  }
}

interface NotificationCounts {
  total: number
  activity: number
  work: number
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
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

/**
 * Single notification item
 */
function NotificationItem({ 
  notification, 
  onClick 
}: { 
  notification: Notification
  onClick: () => void 
}) {
  const Icon = getNotificationIcon(notification.type)
  const isWork = notification.category === 'work'

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 p-3 text-left rounded-md transition-colors hover:bg-muted/50",
        !notification.is_read && "bg-primary/5"
      )}
    >
      <div className={cn(
        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        isWork ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn(
            "text-sm truncate",
            !notification.is_read && "font-semibold"
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatRelativeTime(notification.created_at)}</span>
          {notification.case && (
            <>
              <span>·</span>
              <span className="truncate">{notification.case.case_number}</span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

/**
 * Main notifications popover component
 */
export function NotificationsPopover() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [counts, setCounts] = useState<NotificationCounts>({ total: 0, activity: 0, work: 0 })
  const [activeTab, setActiveTab] = useState<'all' | 'work' | 'activity'>('all')

  /**
   * Fetch notifications from API
   */
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const category = activeTab === 'all' ? '' : activeTab
      const url = `/api/notifications?limit=30${category ? `&category=${category}` : ''}`
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
  }, [activeTab])

  // Fetch on open or tab change
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/notifications?limit=1')
        if (response.ok) {
          const data = await response.json()
          setCounts(data.counts || { total: 0, activity: 0, work: 0 })
        }
      } catch {
        // Silently fail
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  /**
   * Mark all as read
   */
  const handleMarkAllRead = async () => {
    try {
      const category = activeTab === 'all' ? undefined : activeTab
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true, category }),
      })
      
      // Refresh notifications
      fetchNotifications()
    } catch (error) {
      console.error('[v0] Error marking notifications as read:', error)
    }
  }

  /**
   * Handle notification click
   */
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: [notification.id] }),
      })
    }

    setIsOpen(false)

    // Navigate to relevant page
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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {counts.total > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -right-1 -top-1 h-5 min-w-5 justify-center p-0 text-[10px]"
            >
              {counts.total > 99 ? '99+' : counts.total}
            </Badge>
          )}
          <span className="sr-only">Ver notificaciones</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] p-0">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h4 className="font-semibold">Notificaciones</h4>
          {counts.total > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Marcar leídas
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger 
              value="all" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Todas
              {counts.total > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                  {counts.total}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="work" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Trabajo
              {counts.work > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5 px-1.5">
                  {counts.work}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="activity" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
            >
              Actividad
              {counts.activity > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                  {counts.activity}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="m-0">
            <ScrollArea className="h-[350px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Bell className="h-10 w-10 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No hay notificaciones
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="border-t border-border p-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full text-xs"
            onClick={() => {
              setIsOpen(false)
              router.push('/notificaciones')
            }}
          >
            Ver todas las notificaciones
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
