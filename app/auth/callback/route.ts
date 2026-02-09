/**
 * Auth Callback Route
 * 
 * Handles OAuth callbacks and email confirmations from Supabase.
 * Required for email verification flow to work correctly.
 */
import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  
  console.log('[v0] Auth callback received:', { code: !!code, next })

  if (code) {
    const supabase = await createClient()
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      console.log('[v0] Session created successfully')
      
      // Get user info to determine redirect
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Check user's role to redirect appropriately
        const { data: profile } = await supabase
          .from('profiles')
          .select('system_role')
          .eq('id', user.id)
          .single()
        
        console.log('[v0] User profile:', { userId: user.id, role: profile?.system_role })
        
        // Redirect based on role
        if (profile?.system_role === 'client') {
          return NextResponse.redirect(`${origin}/portal`)
        } else {
          return NextResponse.redirect(`${origin}${next}`)
        }
      }
    } else {
      console.error('[v0] Auth callback error:', error.message)
    }
  }

  // If there's an error or no code, redirect to login with error
  const errorUrl = new URL('/auth/login', origin)
  errorUrl.searchParams.set('error', 'auth_callback_failed')
  return NextResponse.redirect(errorUrl)
}
