/**
 * Supabase Browser Client
 * 
 * Creates a Supabase client for use in client-side components.
 * Uses the singleton pattern to prevent multiple client instances.
 */
import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client configured for browser-side usage.
 * This client is used in React components marked with 'use client'.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
