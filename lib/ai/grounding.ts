/**
 * Grounding utilities — central anti-hallucination layer.
 *
 * Given a list of citations produced by the AI (edit proposals, agent
 * steps, draft generations), classifies each against:
 *   1) Curated dataset of well-known norms + CSJN leading cases.
 *   2) SAIJ cache (real fallos fetched before).
 *   3) Heuristic sanity checks.
 *   4) LLM judge (fallback, skeptical).
 *
 * Produces an aggregated `grounding_status` that the server can use to
 * either block (strict mode) or surface a warning to the lawyer.
 */

import { matchKnownNorm, matchKnownJurisprudence } from '@/lib/lexia/workspace'
import { createAdminClient } from '@/lib/supabase/admin'

export interface Citation {
  label: string
  kind: 'norma' | 'jurisprudencia' | 'doctrina'
  quote?: string
}

export interface GroundedVerdict {
  index: number
  status: 'verified' | 'warning' | 'invalid'
  confidence: number
  explanation: string
  sourceType: 'dataset' | 'saij_cache' | 'heuristic' | 'llm_judge' | 'unresolved'
  source?: string
  suggestedLabel?: string
}

export type GroundingStatus = 'grounded' | 'partial' | 'ungrounded' | 'unknown'

export interface GroundingReport {
  verdicts: GroundedVerdict[]
  status: GroundingStatus
  /** True iff options.strict was set and the report had any invalid verdict. */
  violatesStrict: boolean
}

export interface GroundingOptions {
  /**
   * When true, any 'invalid' verdict makes `violatesStrict: true` so the
   * caller can reject the operation.
   */
  strict?: boolean
  /** URL base of the Next.js app; used to call /api/lexia/verify-citation. */
  baseUrl?: string
  /** Auth cookie header to forward to the verify endpoint. */
  cookieHeader?: string
}

/**
 * Verify citations against the ground-truth sources available.
 * This function is server-only.
 */
export async function ensureGroundedCitations(
  citations: Citation[],
  options: GroundingOptions = {}
): Promise<GroundingReport> {
  if (citations.length === 0) {
    return { verdicts: [], status: 'grounded', violatesStrict: false }
  }

  const verdicts: GroundedVerdict[] = new Array(citations.length)
  const needsJudge: Array<{ i: number; c: Citation }> = []

  const db = createAdminClient()

  for (let i = 0; i < citations.length; i++) {
    const c = citations[i]

    // 1. Dataset: norms
    if (c.kind === 'norma') {
      const hit = matchKnownNorm(c.label)
      if (hit.kind === 'verified') {
        verdicts[i] = {
          index: i,
          status: 'verified',
          confidence: 0.95,
          explanation: 'Normativa reconocida en el dataset curado.',
          sourceType: 'dataset',
          suggestedLabel: hit.label,
          source: hit.url,
        }
        continue
      }
      if (hit.kind === 'invalid') {
        verdicts[i] = {
          index: i,
          status: 'invalid',
          confidence: 0.9,
          explanation: hit.reason,
          sourceType: 'dataset',
        }
        continue
      }
    }

    // 2. Dataset: leading cases
    if (c.kind === 'jurisprudencia') {
      const hit = matchKnownJurisprudence(c.label)
      if (hit.kind === 'verified') {
        verdicts[i] = {
          index: i,
          status: 'verified',
          confidence: 0.88,
          explanation: 'Leading case reconocido en dataset curado.',
          sourceType: 'dataset',
          suggestedLabel: hit.label,
          source: hit.url,
        }
        continue
      }

      // 3. SAIJ cache
      const cacheHit = await hitJurisCache(db, c.label)
      if (cacheHit) {
        verdicts[i] = {
          index: i,
          status: 'verified',
          confidence: 0.85,
          explanation: `Fallo en cache SAIJ (id-infojus ${cacheHit.external_id}).`,
          sourceType: 'saij_cache',
          suggestedLabel: cacheHit.title,
          source: cacheHit.url,
        }
        continue
      }
    }

    needsJudge.push({ i, c })
  }

  // 4. LLM judge for the ambiguous long tail.
  if (needsJudge.length > 0 && options.baseUrl) {
    try {
      const res = await fetch(`${options.baseUrl}/api/lexia/verify-citation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options.cookieHeader ? { cookie: options.cookieHeader } : {}),
        },
        body: JSON.stringify({
          citations: needsJudge.map(({ c }) => ({
            label: c.label,
            kind: c.kind,
            quote: c.quote,
          })),
        }),
      })
      if (res.ok) {
        const data = (await res.json()) as {
          verdicts: Array<{
            index: number
            status: 'verified' | 'warning' | 'invalid'
            confidence: number
            explanation: string
            suggestedLabel?: string
            source?: string
            sourceType?: 'dataset' | 'saij_cache' | 'heuristic' | 'llm_judge'
          }>
        }
        for (const v of data.verdicts ?? []) {
          const origIndex = needsJudge[v.index]?.i
          if (origIndex == null) continue
          verdicts[origIndex] = {
            index: origIndex,
            status: v.status,
            confidence: v.confidence,
            explanation: v.explanation,
            sourceType: v.sourceType ?? 'llm_judge',
            suggestedLabel: v.suggestedLabel,
            source: v.source,
          }
        }
      }
    } catch (err) {
      console.error('[grounding] verify-citation failed:', err)
    }
  }

  // Fill any remaining gaps (judge unreachable or missing) as unresolved warnings.
  for (let i = 0; i < citations.length; i++) {
    if (!verdicts[i]) {
      verdicts[i] = {
        index: i,
        status: 'warning',
        confidence: 0.2,
        explanation:
          'Cita sin verificar automaticamente; revisar manualmente antes de aceptar.',
        sourceType: 'unresolved',
      }
    }
  }

  const status = aggregateGroundingStatus(verdicts)
  const violatesStrict = Boolean(options.strict) && status === 'ungrounded'
  return { verdicts, status, violatesStrict }
}

/** Exported for unit tests; same rules as the aggregated report `status` field. */
export function aggregateGroundingStatus(verdicts: GroundedVerdict[]): GroundingStatus {
  if (verdicts.length === 0) return 'grounded'
  let hasInvalid = false
  let hasWarning = false
  let hasVerified = false
  for (const v of verdicts) {
    if (v.status === 'invalid') hasInvalid = true
    else if (v.status === 'warning') hasWarning = true
    else if (v.status === 'verified') hasVerified = true
  }
  if (hasInvalid) return 'ungrounded'
  if (hasWarning) return 'partial'
  if (hasVerified) return 'grounded'
  return 'unknown'
}

// -----------------------------------------------------------------------------
// SAIJ cache lookup (server-only, admin client)
// -----------------------------------------------------------------------------

interface JurisCacheRow {
  external_id: string
  title: string
  url: string
}

async function hitJurisCache(
  db: ReturnType<typeof createAdminClient>,
  label: string
): Promise<JurisCacheRow | null> {
  const trimmed = label.trim()
  const idMatch = trimmed.match(
    /\b(FA\d{6,}|SU\d{6,}|id-infojus[:\s]+([A-Z0-9_-]+))\b/i
  )
  if (idMatch) {
    const ext = idMatch[2] ?? idMatch[1]
    const { data } = await db
      .from('juris_cache')
      .select('external_id,title,url')
      .eq('external_id', ext)
      .maybeSingle()
    if (data) return data as JurisCacheRow
  }
  const key = trimmed.slice(0, 80).replace(/[%_]/g, '')
  if (key.length < 6) return null
  const { data } = await db
    .from('juris_cache')
    .select('external_id,title,url')
    .ilike('title', `%${key}%`)
    .limit(1)
    .maybeSingle()
  return (data as JurisCacheRow) ?? null
}
