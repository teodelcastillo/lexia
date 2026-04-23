/**
 * Estratega — jurisprudence search backed by SAIJ (real, cached).
 *
 * Previously this module asked an LLM to "generate plausible fallos", which
 * is exactly the hallucination surface we want to remove. It now delegates
 * to lib/lexia/juris which hits the SAIJ cache and falls back to the live
 * SAIJ portal, so every fallo returned has a real id-infojus and URL.
 *
 * The public shape is preserved so strategic-analyzer.ts does not need to
 * change.
 */

import { searchOrFetch } from '@/lib/lexia/juris'
import type { AnalyzeParams, Jurisprudence } from './types'

export interface JurisprudenceSearchResult {
  results: Jurisprudence[]
  tokensUsed: number
  source: 'cache' | 'live' | 'mixed'
  degraded: boolean
}

function buildQuery(params: AnalyzeParams): string {
  // Pick the most signal-rich tokens from case metadata.
  const bits: string[] = []
  if (params.caseType) bits.push(params.caseType)
  if (params.description) {
    // First 120 chars of description, stripped.
    bits.push(params.description.slice(0, 120))
  }
  return bits.join(' ').replace(/\s+/g, ' ').trim() || 'jurisprudencia'
}

export async function searchJurisprudence(
  params: AnalyzeParams
): Promise<JurisprudenceSearchResult> {
  const query = buildQuery(params)
  const res = await searchOrFetch({
    query,
    tipo: 'fallo',
    jurisdiction: params.jurisdiction ?? null,
    court: params.courtName ?? null,
    limit: 5,
  })

  const results: Jurisprudence[] = res.results.map((doc) => ({
    title: doc.title,
    court: doc.court ?? 'Tribunal no informado',
    date: doc.decisionDate ?? '',
    summary: doc.summary ?? '',
    relevance: buildRelevance(doc.title, params),
    keyArguments:
      (doc.keyTerms ?? []).slice(0, 5).map((t) => t.replace(/^\w/, (c) => c.toUpperCase())),
    url: doc.url,
    indemnizationAmount: null,
  }))

  return {
    results,
    tokensUsed: 0, // No tokens consumed: SAIJ call is deterministic.
    source: res.source,
    degraded: res.degraded,
  }
}

function buildRelevance(title: string, params: AnalyzeParams): string {
  const type = params.caseType ?? 'el caso'
  return `Fallo vinculado a la materia "${type}". Revisar aplicabilidad: "${title.slice(0, 140)}".`
}
