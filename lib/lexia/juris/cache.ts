/**
 * Jurisprudence cache layer.
 *
 * Sits between callers (API routes, LLM tools, verify-citation) and the live
 * SAIJ client. First hits the `juris_cache` Supabase table; if it does not
 * have enough fresh results, falls back to SAIJ live and persists new rows.
 *
 * All writes use the admin (service role) client because the `juris_cache`
 * table has only SELECT granted to authenticated users (see
 * scripts/053_juris_cache.sql). The data is public, so there is no RLS
 * information leak concern.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { searchSaij, getSaijById } from './saij-client'
import type { SaijResult, SaijSearchParams } from './saij-client'

export interface JurisDoc {
  id: string                    // internal UUID
  source: 'saij' | 'infoleg' | 'csjn' | 'manual'
  externalId: string
  kind: 'fallo' | 'sumario' | 'dictamen' | 'doctrina' | 'norma'
  title: string
  court: string | null
  jurisdiction: string | null
  decisionDate: string | null   // YYYY-MM-DD
  summary: string | null
  fullText: string | null
  url: string
  keyTerms: string[]
  fetchedAt: string
}

export interface SearchOrFetchResult {
  results: JurisDoc[]
  source: 'cache' | 'live' | 'mixed'
  degraded: boolean
  error?: string
}

interface DBRow {
  id: string
  source: JurisDoc['source']
  external_id: string
  kind: JurisDoc['kind']
  title: string
  court: string | null
  jurisdiction: string | null
  decision_date: string | null
  summary: string | null
  full_text: string | null
  url: string
  key_terms: string[] | null
  fetched_at: string
  ttl_days: number
}

function rowToDoc(row: DBRow): JurisDoc {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    kind: row.kind,
    title: row.title,
    court: row.court,
    jurisdiction: row.jurisdiction,
    decisionDate: row.decision_date,
    summary: row.summary,
    fullText: row.full_text,
    url: row.url,
    keyTerms: row.key_terms ?? [],
    fetchedAt: row.fetched_at,
  }
}

function saijToInsert(r: SaijResult) {
  return {
    source: 'saij' as const,
    external_id: r.externalId,
    kind: r.kind,
    title: r.title,
    court: r.court,
    jurisdiction: r.jurisdiction,
    decision_date: r.decisionDate,
    summary: r.summary,
    url: r.url,
    key_terms: extractKeyTerms(r.title, r.summary),
    raw: r.raw as Record<string, unknown>,
    fetched_at: new Date().toISOString(),
  }
}

function extractKeyTerms(title: string, summary: string | null): string[] {
  const text = `${title} ${summary ?? ''}`.toLowerCase()
  // Cheap term extraction: words >= 5 chars, unique, max 20.
  const stopwords = new Set([
    'contra', 'sobre', 'hacia', 'desde', 'entre', 'segun', 'segundo', 'despues',
    'antes', 'donde', 'cuando', 'porque', 'aunque', 'mediante', 'excepto',
    'durante', 'respecto', 'conforme', 'expediente', 'resuelve', 'sentencia',
  ])
  const seen = new Set<string>()
  const out: string[] = []
  const words = text.match(/[a-záéíóúñ]{5,}/gi) ?? []
  for (const raw of words) {
    const w = raw.toLowerCase()
    if (stopwords.has(w) || seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= 20) break
  }
  return out
}

// -----------------------------------------------------------------------------
// Cache queries
// -----------------------------------------------------------------------------

const DEFAULT_LIMIT = 5
const FRESH_THRESHOLD = 5       // if fewer fresh hits than this, hit SAIJ

export async function searchOrFetch(params: {
  query: string
  tipo?: SaijSearchParams['tipo']
  jurisdiction?: string | null
  court?: string | null
  dateFrom?: string | null      // YYYY-MM-DD
  dateTo?: string | null
  limit?: number
}): Promise<SearchOrFetchResult> {
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), 20)
  const query = params.query.trim()
  if (!query) {
    return { results: [], source: 'cache', degraded: false }
  }

  const db = createAdminClient()

  // 1. Try cache first.
  const cacheHits = await queryCache(db, {
    query,
    jurisdiction: params.jurisdiction ?? null,
    court: params.court ?? null,
    dateFrom: params.dateFrom ?? null,
    dateTo: params.dateTo ?? null,
    limit,
  })

  if (cacheHits.length >= FRESH_THRESHOLD) {
    return { results: cacheHits, source: 'cache', degraded: false }
  }

  // 2. Hit SAIJ live for the delta.
  const live = await searchSaij({
    q: query,
    tipo: params.tipo ?? 'fallo',
    jurisdiccion: params.jurisdiction ?? undefined,
    tribunal: params.court ?? undefined,
    fechaDesde: params.dateFrom ? isoToDmy(params.dateFrom) : undefined,
    fechaHasta: params.dateTo ? isoToDmy(params.dateTo) : undefined,
    page: 0,
    pageSize: Math.max(limit, FRESH_THRESHOLD),
  })

  if (live.degraded) {
    return {
      results: cacheHits,
      source: 'cache',
      degraded: true,
      error: live.error,
    }
  }

  // 3. Persist new results.
  const persisted: JurisDoc[] = []
  if (live.results.length > 0) {
    const rows = live.results.map(saijToInsert)
    const { data, error } = await db
      .from('juris_cache')
      .upsert(rows, { onConflict: 'source,external_id', ignoreDuplicates: false })
      .select('*')
    if (!error && data) {
      for (const row of data as DBRow[]) persisted.push(rowToDoc(row))
    }
  }

  // 4. Merge + dedupe, keep limit.
  const byKey = new Map<string, JurisDoc>()
  for (const doc of [...cacheHits, ...persisted]) {
    const key = `${doc.source}:${doc.externalId}`
    if (!byKey.has(key)) byKey.set(key, doc)
  }
  const merged = Array.from(byKey.values()).slice(0, limit)

  const source: SearchOrFetchResult['source'] =
    cacheHits.length > 0 && persisted.length > 0
      ? 'mixed'
      : persisted.length > 0
      ? 'live'
      : 'cache'

  return { results: merged, source, degraded: false }
}

async function queryCache(
  db: ReturnType<typeof createAdminClient>,
  params: {
    query: string
    jurisdiction: string | null
    court: string | null
    dateFrom: string | null
    dateTo: string | null
    limit: number
  }
): Promise<JurisDoc[]> {
  // Match against title (trigram) and summary. We rely on ILIKE because
  // supabase-js does not expose pg_trgm similarity operators directly; the
  // GIN trgm index still speeds up ILIKE queries.
  const like = `%${params.query.replace(/[%_]/g, '')}%`

  let builder = db
    .from('juris_cache')
    .select('*')
    .or(`title.ilike.${like},summary.ilike.${like}`)
    .order('decision_date', { ascending: false, nullsFirst: false })
    .limit(params.limit)

  if (params.jurisdiction) builder = builder.eq('jurisdiction', params.jurisdiction)
  if (params.court) builder = builder.ilike('court', `%${params.court}%`)
  if (params.dateFrom) builder = builder.gte('decision_date', params.dateFrom)
  if (params.dateTo) builder = builder.lte('decision_date', params.dateTo)

  const { data, error } = await builder
  if (error || !data) return []

  const now = Date.now()
  const fresh = (data as DBRow[]).filter((row) => {
    const age = now - new Date(row.fetched_at).getTime()
    const ttlMs = row.ttl_days * 24 * 60 * 60 * 1000
    return age < ttlMs
  })
  return fresh.map(rowToDoc)
}

export async function getByExternalId(
  source: JurisDoc['source'],
  externalId: string
): Promise<JurisDoc | null> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('juris_cache')
    .select('*')
    .eq('source', source)
    .eq('external_id', externalId)
    .maybeSingle()
  if (error || !data) {
    if (source === 'saij') {
      const live = await getSaijById(externalId)
      if (!live) return null
      const { data: upserted } = await db
        .from('juris_cache')
        .upsert(saijToInsert(live), { onConflict: 'source,external_id' })
        .select('*')
        .maybeSingle()
      return upserted ? rowToDoc(upserted as DBRow) : null
    }
    return null
  }
  return rowToDoc(data as DBRow)
}

export async function bookmarkForCase(params: {
  caseId: string
  jurisId: string
  userId: string
  notes?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const db = createAdminClient()
  const { error } = await db
    .from('juris_case_links')
    .insert({
      case_id: params.caseId,
      juris_id: params.jurisId,
      created_by: params.userId,
      notes: params.notes ?? null,
    })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------

function isoToDmy(iso: string): string {
  // 'YYYY-MM-DD' -> 'DD/MM/YYYY'
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}
