/**
 * Lexia AI - Usage and quota (plans, periods, recording)
 *
 * Server-side only. Uses Supabase client with authenticated user (JWT)
 * so record_lexia_usage RPC can use auth.uid().
 */

import { getPlanCreditsLimit } from './credits'

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

export interface UserLexiaPlan {
  slug: string
  creditsPerMonth: number
}

export interface PeriodUsage {
  credits_used: number
  tokens_used: number
}

export interface CreditsRemaining {
  allowed: boolean
  remaining: number
  limit: number
}

const DEFAULT_PLAN: UserLexiaPlan = { slug: 'individual', creditsPerMonth: 300 }

function getPeriodStart(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

/**
 * Returns the user's Lexia plan (slug and credits per month).
 * If lexia_plan_id is null, returns default individual plan.
 */
export async function getUserLexiaPlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserLexiaPlan> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('lexia_plan_id')
    .eq('id', userId)
    .single()

  if (!profile?.lexia_plan_id) {
    return DEFAULT_PLAN
  }

  const { data: plan } = await supabase
    .from('lexia_plans')
    .select('slug, credits_per_month')
    .eq('id', profile.lexia_plan_id)
    .single()

  if (!plan) {
    return DEFAULT_PLAN
  }

  return {
    slug: plan.slug as string,
    creditsPerMonth: (plan.credits_per_month as number) ?? 300,
  }
}

/**
 * Returns aggregated usage for the current calendar month for the user.
 */
export async function getCurrentPeriodUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<PeriodUsage> {
  const periodStart = getPeriodStart()

  const { data } = await supabase
    .from('lexia_usage_periods')
    .select('credits_used, tokens_used')
    .eq('user_id', userId)
    .eq('period_start', periodStart)
    .single()

  if (!data) {
    return { credits_used: 0, tokens_used: 0 }
  }

  return {
    credits_used: Number(data.credits_used ?? 0),
    tokens_used: Number(data.tokens_used ?? 0),
  }
}

/**
 * Checks if the user has credits remaining this period and returns allowed, remaining, limit.
 */
export async function checkCreditsRemaining(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreditsRemaining> {
  const [plan, usage] = await Promise.all([
    getUserLexiaPlan(supabase, userId),
    getCurrentPeriodUsage(supabase, userId),
  ])

  const limit = plan.creditsPerMonth
  const used = usage.credits_used
  const remaining = Math.max(0, limit - used)
  const allowed = remaining > 0

  return { allowed, remaining, limit }
}

/**
 * Records one Lexia request via RPC. Uses auth.uid() on the server,
 * so the supabase client must be the one with the user's JWT (e.g. from the API route).
 * Idempotent: duplicate trace_id is ignored by the DB function.
 */
export async function recordLexiaUsage(
  supabase: SupabaseClient,
  _userId: string,
  traceId: string,
  intent: string,
  creditsCharged: number,
  tokensUsed: number,
): Promise<void> {
  await supabase.rpc('record_lexia_usage', {
    p_trace_id: traceId,
    p_intent: intent,
    p_credits_charged: creditsCharged,
    p_tokens_used: tokensUsed,
  })
}
