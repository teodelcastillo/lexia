/**
 * SAIJ Client — live fetcher for Argentine jurisprudence / normativa.
 *
 * SAIJ (Sistema Argentino de Informacion Juridica) exposes a public search
 * portal at http://www.saij.gob.ar that does NOT have a documented REST JSON
 * API. The portal renders HTML with the result list embedded as JSON in a
 * script block.
 *
 * Strategy:
 *   1. Build a search URL against the portal.
 *   2. Fetch with a short timeout and a polite User-Agent.
 *   3. Extract the embedded result payload (JSON or structured HTML).
 *   4. Normalize into our SaijResult shape.
 *   5. Track failures with a tiny in-memory circuit breaker so we stop
 *      hammering SAIJ when it is degraded.
 *
 * Parsing is deliberately tolerant: any failure falls back to an empty
 * result set and sets `degraded: true` in the response.
 */

export interface SaijSearchParams {
  q: string
  /** 'fallo' | 'sumario' | 'legislacion' | 'dictamen' | 'todos' (default 'fallo') */
  tipo?: 'fallo' | 'sumario' | 'legislacion' | 'dictamen' | 'todos'
  jurisdiccion?: string
  tribunal?: string
  fechaDesde?: string // dd/mm/yyyy
  fechaHasta?: string // dd/mm/yyyy
  page?: number       // 0-based
  pageSize?: number   // default 10, max 25
}

export interface SaijResult {
  externalId: string
  kind: 'fallo' | 'sumario' | 'dictamen' | 'doctrina' | 'norma'
  title: string
  court: string | null
  jurisdiction: string | null
  decisionDate: string | null // YYYY-MM-DD
  summary: string | null
  url: string
  raw: Record<string, unknown>
}

export interface SaijSearchResponse {
  results: SaijResult[]
  degraded: boolean
  source: 'saij_live' | 'saij_failed'
  error?: string
}

// -----------------------------------------------------------------------------
// Circuit breaker (in-memory, per-process)
// -----------------------------------------------------------------------------

const BREAKER = {
  consecutiveFailures: 0,
  openedAt: 0 as number,
}

const BREAKER_THRESHOLD = 3
const BREAKER_COOLDOWN_MS = 5 * 60 * 1000 // 5 min

function isBreakerOpen(): boolean {
  if (BREAKER.consecutiveFailures < BREAKER_THRESHOLD) return false
  const now = Date.now()
  if (now - BREAKER.openedAt > BREAKER_COOLDOWN_MS) {
    // Half-open: allow one try
    BREAKER.consecutiveFailures = BREAKER_THRESHOLD - 1
    return false
  }
  return true
}

function recordSuccess() {
  BREAKER.consecutiveFailures = 0
  BREAKER.openedAt = 0
}

function recordFailure() {
  BREAKER.consecutiveFailures += 1
  if (BREAKER.consecutiveFailures === BREAKER_THRESHOLD) {
    BREAKER.openedAt = Date.now()
  }
}

// -----------------------------------------------------------------------------
// URL builder
// -----------------------------------------------------------------------------

const SAIJ_BASE = 'http://www.saij.gob.ar'

function buildSearchUrl(params: SaijSearchParams): string {
  const page = Math.max(0, params.page ?? 0)
  const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 25)
  const offset = page * pageSize

  const tipo = params.tipo ?? 'fallo'
  // SAIJ filter token. "Total" means all types; otherwise a specific one.
  const tipoFilter =
    tipo === 'todos'
      ? 'Total'
      : tipo === 'legislacion'
      ? 'Legislacion'
      : tipo === 'fallo'
      ? 'Fallos'
      : tipo === 'sumario'
      ? 'Sumarios'
      : 'Dictamenes'

  const q = encodeURIComponent(params.q.trim())
  const parts = [
    `o=${offset}`,
    `p=${pageSize}`,
    `f=${tipoFilter}`,
    `s=fecha-rango|DESCENDENTE`,
    `v=colapsada`,
    `t=${q}`,
  ]
  if (params.jurisdiccion) {
    parts.push(`j=${encodeURIComponent(params.jurisdiccion)}`)
  }
  if (params.tribunal) {
    parts.push(`tr=${encodeURIComponent(params.tribunal)}`)
  }
  if (params.fechaDesde) {
    parts.push(`fd=${encodeURIComponent(params.fechaDesde)}`)
  }
  if (params.fechaHasta) {
    parts.push(`fh=${encodeURIComponent(params.fechaHasta)}`)
  }
  // Ask SAIJ for JSON-ish response format. When r=1 their portal returns
  // structured data embedded in the HTML; we still parse defensively.
  parts.push(`r=1`)

  return `${SAIJ_BASE}/busqueda?${parts.join('&')}`
}

// -----------------------------------------------------------------------------
// Parser
// -----------------------------------------------------------------------------

/**
 * SAIJ embeds the search results as a JSON-like block inside the HTML.
 * Typical markers we look for (in order of preference):
 *   1) window.__INITIAL_STATE__ = { ... searchResults: [...] ... }
 *   2) <div class="result" data-id-infojus="..."> ... </div>
 *   3) A JSON array with id-infojus keys (tolerant regex scan).
 */
function extractJsonBlock(html: string): unknown[] | null {
  // Strategy 1: initial state
  const initialStateMatch = html.match(
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/
  )
  if (initialStateMatch) {
    try {
      const payload = JSON.parse(initialStateMatch[1]) as Record<string, unknown>
      const candidates: unknown[] = []
      walkForArrayOfResults(payload, candidates)
      if (candidates.length > 0) return candidates as unknown[]
    } catch {
      // fall through
    }
  }

  // Strategy 2: look for JSON objects with "id-infojus"
  const objects: unknown[] = []
  // Each SAIJ record is a JSON object with at least id-infojus and caratula.
  // We cheaply scan for id-infojus strings and attempt to parse the
  // containing object by bracket matching around the match.
  const idRegex = /"id-infojus"\s*:\s*"([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = idRegex.exec(html)) !== null) {
    const start = html.lastIndexOf('{', m.index)
    if (start < 0) continue
    const end = findMatchingBrace(html, start)
    if (end < 0) continue
    const raw = html.slice(start, end + 1)
    try {
      objects.push(JSON.parse(raw))
    } catch {
      // ignore malformed
    }
  }
  if (objects.length > 0) return objects

  return null
}

function walkForArrayOfResults(node: unknown, out: unknown[]): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>
        if ('id-infojus' in rec || 'idInfojus' in rec) out.push(rec)
        else walkForArrayOfResults(item, out)
      }
    }
    return
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    walkForArrayOfResults(value, out)
  }
}

function findMatchingBrace(s: string, open: number): number {
  let depth = 0
  let inString = false
  let escape = false
  for (let i = open; i < s.length; i++) {
    const ch = s[i]
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function pick(rec: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function normalizeDate(raw: string | null): string | null {
  if (!raw) return null
  // SAIJ dates can be "2024-03-15" or "15/03/2024" or "15 de marzo de 2024".
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) {
    const d = dmy[1].padStart(2, '0')
    const m = dmy[2].padStart(2, '0')
    return `${dmy[3]}-${m}-${d}`
  }
  return null
}

function toResult(rec: Record<string, unknown>, tipo: SaijSearchParams['tipo']): SaijResult | null {
  const externalId =
    pick(rec, ['id-infojus', 'idInfojus', 'id', 'uuid']) ?? null
  if (!externalId) return null

  const title =
    pick(rec, ['caratula', 'titulo', 'title', 'nombre']) ?? `SAIJ ${externalId}`
  const court = pick(rec, ['tribunal', 'organismo', 'court'])
  const jurisdiction = pick(rec, ['jurisdiccion', 'provincia'])
  const rawDate = pick(rec, ['fecha', 'fecha-fallo', 'fecha-sentencia', 'date'])
  const summary = pick(rec, ['sumario', 'resumen', 'summary', 'descripcion'])
  const urlPath =
    pick(rec, ['url', 'link']) ?? `/doc/${externalId}`
  const url = urlPath.startsWith('http') ? urlPath : `${SAIJ_BASE}${urlPath}`

  // Infer kind from tipo filter or record shape
  let kind: SaijResult['kind'] = 'fallo'
  if (tipo === 'legislacion') kind = 'norma'
  else if (tipo === 'sumario') kind = 'sumario'
  else if (tipo === 'dictamen') kind = 'dictamen'

  return {
    externalId,
    kind,
    title,
    court,
    jurisdiction,
    decisionDate: normalizeDate(rawDate),
    summary,
    url,
    raw: rec,
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 8000
const USER_AGENT = 'LexiaApp/1.0 (+https://lexia.legal)'

export async function searchSaij(
  params: SaijSearchParams
): Promise<SaijSearchResponse> {
  if (isBreakerOpen()) {
    return {
      results: [],
      degraded: true,
      source: 'saij_failed',
      error: 'SAIJ circuit breaker open (too many recent failures).',
    }
  }

  const url = buildSearchUrl(params)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/json',
        'User-Agent': USER_AGENT,
      },
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!res.ok) {
      recordFailure()
      return {
        results: [],
        degraded: true,
        source: 'saij_failed',
        error: `SAIJ responded ${res.status}`,
      }
    }

    const text = await res.text()
    const records = extractJsonBlock(text)

    if (!records || records.length === 0) {
      // Not necessarily a failure — may just be zero results.
      recordSuccess()
      return { results: [], degraded: false, source: 'saij_live' }
    }

    const results: SaijResult[] = []
    for (const rec of records) {
      if (rec && typeof rec === 'object') {
        const r = toResult(rec as Record<string, unknown>, params.tipo)
        if (r) results.push(r)
      }
    }

    recordSuccess()
    return { results, degraded: false, source: 'saij_live' }
  } catch (err) {
    clearTimeout(timer)
    recordFailure()
    const message = err instanceof Error ? err.message : String(err)
    return {
      results: [],
      degraded: true,
      source: 'saij_failed',
      error: `SAIJ fetch failed: ${message}`,
    }
  }
}

/** Fetch a single SAIJ document by id-infojus. Used when we have a cached
 *  citation and want to verify it still exists / get fresh metadata. */
export async function getSaijById(externalId: string): Promise<SaijResult | null> {
  const docUrl = `${SAIJ_BASE}/${encodeURIComponent(externalId)}?r=1`
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(docUrl, {
      method: 'GET',
      headers: { Accept: 'text/html,application/json', 'User-Agent': USER_AGENT },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      recordFailure()
      return null
    }
    const text = await res.text()
    const records = extractJsonBlock(text)
    if (!records || records.length === 0) {
      recordSuccess()
      return null
    }
    // Prefer the record matching our id exactly
    for (const r of records) {
      if (r && typeof r === 'object') {
        const rec = r as Record<string, unknown>
        const rid = pick(rec, ['id-infojus', 'idInfojus', 'id', 'uuid'])
        if (rid === externalId) {
          recordSuccess()
          return toResult(rec, 'fallo')
        }
      }
    }
    // Fallback: first parseable record
    const first = records[0] as Record<string, unknown>
    recordSuccess()
    return toResult(first, 'fallo')
  } catch {
    recordFailure()
    return null
  }
}
