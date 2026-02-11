/**
 * Supabase Middleware Helper
 * 
 * Handles session refresh and authentication redirects.
 * Protects routes based on user authentication and role.
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

  // Create a new Supabase client on each request (important for Fluid compute)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
