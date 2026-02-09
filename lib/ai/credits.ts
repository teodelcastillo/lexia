/**
 * Lexia AI - Credits by intent and plan limits
 *
 * Maps each LexiaIntent to a credit cost and defines plan credit limits.
 * Used for usage tracking and enforcement (when enabled).
 */

import type { LexiaIntent } from './types'

// ============================================
// Credits per intent (action type)
// ============================================

export const CREDITS_BY_INTENT: Record<LexiaIntent, number> = {
  general_chat: 0.5,
  case_query: 0.5,
  unknown: 0.5,
  procedural_query: 0.5,
  document_summary: 1,
  document_drafting: 2,
  legal_analysis: 3,
}

const DEFAULT_CREDITS = 1

/**
 * Returns the credit cost for a given intent.
 */
export function getCreditsForIntent(intent: LexiaIntent): number {
  return CREDITS_BY_INTENT[intent] ?? DEFAULT_CREDITS
}

// ============================================
// Plan limits (credits per month)
// ============================================

export const PLAN_CREDITS: Record<string, number> = {
  individual: 300,
  professional: 600,
  estudio: 1000,
}

const DEFAULT_PLAN_CREDITS = 300

/**
 * Returns the credit limit per month for a plan slug.
 * Unknown slug defaults to individual (300).
 */
export function getPlanCreditsLimit(planSlug: string): number {
  return PLAN_CREDITS[planSlug] ?? DEFAULT_PLAN_CREDITS
}
