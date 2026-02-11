/**
 * Supabase Middleware Helper
 *
 * Handles session refresh and authentication redirects. Called by proxy.ts
 * on every request (see proxy.ts matcher). Refreshes the Supabase session
 * so cookies stay in sync; AuthProvider in the dashboard only reflects
 * this state and does not re-establish session on its own.
 *
 * view_as_client: Set only when an admin_general visits /portal?as=CLIENT_ID
 * (and CLIENT_ID is a client). Cleared when leaving /portal or when not on
 * a portal route, so returning to /dashboard never sees this cookie.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Updates the user session and handles route protection.
 * Redirects unauthenticated users away from protected routes.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Ensure Supabase env vars are set (avoids cryptic "Server Components render" in production)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[Supabase] Missing env vars: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Add them to .env.local. See https://supabase.com/dashboard/project/_/settings/api'
    )
    return new NextResponse(
      'Supabase configuration missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local',
      { status: 500 }
    )
  }

  // Create a new Supabase client on each request (important for Fluid compute)
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh the user session - this is critical for preventing random logouts
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Define protected route patterns - all dashboard routes
  const isProtectedRoute = pathname.startsWith('/dashboard') || 
                           pathname.startsWith('/casos') ||
                           pathname.startsWith('/clientes') ||
                           pathname.startsWith('/companias') ||
                           pathname.startsWith('/personas') ||
                           pathname.startsWith('/empresas') ||
                           pathname.startsWith('/tareas') ||
                           pathname.startsWith('/vencimientos') ||
                           pathname.startsWith('/documentos') ||
                           pathname.startsWith('/calendario') ||
                           pathname.startsWith('/notas') ||
                           pathname.startsWith('/lexia') ||
                           pathname.startsWith('/herramientas') ||
                           pathname.startsWith('/admin') ||
                           pathname.startsWith('/perfil') ||
                           pathname.startsWith('/notificaciones') ||
                           pathname.startsWith('/configuracion')
  
  // Define client portal route pattern
  const isClientPortalRoute = pathname.startsWith('/portal')
  
  // Define auth routes
  const isAuthRoute = pathname.startsWith('/auth')

  // "View as client" cookie: set when admin visits /portal?as=USER_ID, clear when leaving portal or no param
  if (isClientPortalRoute && user) {
    const viewAsParam = request.nextUrl.searchParams.get('as')
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('system_role')
      .eq('id', user.id)
      .single()

    if (viewAsParam && currentProfile?.system_role === 'admin_general') {
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('system_role')
        .eq('id', viewAsParam)
        .single()
      if (targetProfile?.system_role === 'client') {
        supabaseResponse.cookies.set('view_as_client', viewAsParam, {
          path: '/portal',
          maxAge: 60 * 60 * 24, // 24h
          sameSite: 'lax',
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
        })
      }
    } else {
      supabaseResponse.cookies.set('view_as_client', '', { path: '/portal', maxAge: 0 })
    }
  } else if (!isClientPortalRoute) {
    supabaseResponse.cookies.set('view_as_client', '', { path: '/portal', maxAge: 0 })
  }

  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Redirect unauthenticated users from client portal to portal login
  if (isClientPortalRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/portal-login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages to dashboard
  if (isAuthRoute && user) {
    // Check if user is a client (external user)
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role')
      .eq('id', user.id)
      .single()

    const url = request.nextUrl.clone()
    
    if (profile?.system_role === 'client') {
      url.pathname = '/portal'
    } else {
      url.pathname = '/dashboard'
    }
    
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
