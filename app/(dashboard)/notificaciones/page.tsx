import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
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
    <>
      <DashboardHeader
        title="Notificaciones"
        description="Centro de notificaciones y actividad"
      />
      <main className="flex-1 p-6">
        <Suspense fallback={<NotificationsSkeleton />}>
          <NotificationsView />
        </Suspense>
      </main>
    </>
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
