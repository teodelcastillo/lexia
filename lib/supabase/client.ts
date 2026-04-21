/**
 * Supabase Browser Client
 *
 * Creates a Supabase client for use in client-side components.
 *
 * Robustness: client components also execute on the server during SSR /
 * static prerender. If env vars are missing at build time this would break
 * the whole build with a cryptic error. We instead fall back to a harmless
 * placeholder on the server (no real call is made during render because
 * methods are only invoked from event handlers). On the browser, a missing
 * env var throws a clear message pointing to .env.example.
 */
import { createBrowserClient } from '@supabase/ssr'

const SSR_PLACEHOLDER_URL = 'http://localhost:54321'
const SSR_PLACEHOLDER_KEY = 'placeholder-anon-key'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    if (typeof window === 'undefined') {
      // During SSR / static prerender without env vars, return a stub client.
      // Any real auth/db call would only run on the client after hydration.
      return createBrowserClient(SSR_PLACEHOLDER_URL, SSR_PLACEHOLDER_KEY)
    }
    throw new Error(
      '[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy .env.example to .env.local and fill in your Supabase project credentials.',
    )
  }

  return createBrowserClient(url, key)
}
