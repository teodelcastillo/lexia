/**
 * Next.js Proxy (Next.js 16+)
 *
 * Handles authentication session updates for all routes. This is the single
 * entry point for session refresh: every request (except static assets) runs
 * through proxy() → updateSession(). The session truth is established here
 * (and in server layouts via createClient); client-side AuthProvider is seeded
 * with that server snapshot and only reflects it (see lib/hooks/use-auth.ts).
 *
 * Flows verified:
 * - Internal login → updateSession refreshes session → redirect to /dashboard →
 *   dashboard layout gets user/profile and passes to AuthProvider.
 * - Client login → redirect to /portal → portal layout uses same session.
 * - Admin "view as client" (/portal?as=USER_ID) → view_as_client cookie set
 *   in updateSession; when admin leaves /portal the cookie is cleared so
 *   dashboard context is not affected.
 */
import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
