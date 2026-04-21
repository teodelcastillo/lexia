import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationsView } from '@/components/notifications/notifications-view'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata = {
  title: 'Notificaciones | Sistema Legal',
  description: 'Centro de notificaciones',
}

async function validateAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  return user
}

export default async function NotificacionesPage() {
  await validateAccess()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Notificaciones
        </h1>
        <p className="text-sm text-muted-foreground">
          Centro de notificaciones y actividad
        </p>
      </div>
      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsView />
      </Suspense>
    </div>
  )
}

function NotificationsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  )
}
