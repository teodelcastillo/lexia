/**
 * Curated dataset of canonical Argentine legal sources + normalization for
 * citation verification. Used before calling an LLM judge so that very
 * well-known norms get a deterministic "verified" verdict (with source URL)
 * and the LLM is reserved for the ambiguous long tail.
 *
 * This is intentionally small and conservative. Adding a source here should
 * require human review. Never mark something as verified unless you are
 * confident.
 */

export interface KnownNorm {
  /** Human label that will be shown to the user when matched. */
  label: string
  /** Regex that, if it matches the citation, triggers this entry. */
  pattern: RegExp
  /** Max article number (inclusive) supported by this norm; undefined = any. */
  maxArticle?: number
  /** Canonical source URL (InfoLEG preferred). */
  url: string
  kind: 'norma' | 'codigo'
}

const ARTICLE_REGEX = /\bart(?:\.|ículo)?\s*(\d{1,5})/i

/** Extract `123` from "CCyCN art. 123" if present. */
export function extractArticleNumber(label: string): number | null {
  const m = label.match(ARTICLE_REGEX)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Canonical dataset. Patterns are intentionally strict: we prefer to miss
 * matches than to verify something wrong.
 */
export const KNOWN_NORMS: KnownNorm[] = [
  {
    label: 'Código Civil y Comercial de la Nación (CCyCN)',
    pattern: /\b(ccycn|c\.?c\.?y\.?c\.?n\.?|c[oó]digo\s+civil\s+y\s+comercial)\b/i,
    maxArticle: 2671,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975',
    kind: 'codigo',
  },
  {
    label: 'Constitución Nacional (CN)',
    pattern: /\b(constituci[oó]n\s+nacional|^cn\b|\bc\.?\s?n\.?\b)/i,
    maxArticle: 129,
    url: 'https://www.argentina.gob.ar/constitucion-nacional',
    kind: 'norma',
  },
  {
    label: 'Ley de Contrato de Trabajo (LCT, Ley 20.744)',
    pattern: /\b(lct|ley\s*20[.\s]?744|ley\s+de\s+contrato\s+de\s+trabajo)\b/i,
    maxArticle: 280,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-20744-25552',
    kind: 'norma',
  },
  {
    label: 'Ley de Defensa del Consumidor (Ley 24.240)',
    pattern: /\b(ley\s*24[.\s]?240|defensa\s+del\s+consumidor)\b/i,
    maxArticle: 66,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-24240-638',
    kind: 'norma',
  },
  {
    label: 'Ley 27.401 (Responsabilidad penal empresarial)',
    pattern: /\bley\s*27[.\s]?401\b/i,
    maxArticle: 38,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-27401-296846',
    kind: 'norma',
  },
  {
    label: 'CPCCN (Código Procesal Civil y Comercial de la Nación)',
    pattern: /\b(cpccn|c\.?p\.?c\.?c\.?n\.?|c[oó]digo\s+procesal\s+civil\s+y\s+comercial\s+de\s+la\s+naci[oó]n)\b/i,
    maxArticle: 820,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-17454-16547',
    kind: 'codigo',
  },
  {
    label: 'Código Penal de la Nación (CPN)',
    pattern: /\b(c[oó]digo\s+penal|\bc\.?p\.?\b(?!c))/i,
    maxArticle: 306,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-11179-16546',
    kind: 'codigo',
  },
  {
    label: 'CPCC Córdoba (Ley 8.465)',
    pattern: /\b(cpcc(?:\s+c[oó]rdoba)?|ley\s*8[.\s]?465|c[oó]digo\s+procesal\s+civil\s+y\s+comercial\s+de\s+c[oó]rdoba)\b/i,
    maxArticle: 900,
    url: 'https://www.justiciacordoba.gob.ar/JusticiaCordoba/files/LEY%208465.pdf',
    kind: 'codigo',
  },
]

export type NormVerdict =
  | { kind: 'verified'; label: string; url: string }
  | { kind: 'invalid'; reason: string }
  | { kind: 'unknown' }

/**
 * Try to match a citation label against the curated dataset.
 * - If it matches and the article number is in range → verified
 * - If it matches but the article number exceeds the known max → invalid
 *   (strong hallucination signal)
 * - Else → unknown (let the LLM judge decide)
 */
export function matchKnownNorm(label: string): NormVerdict {
  const trimmed = label.trim()
  for (const entry of KNOWN_NORMS) {
    if (!entry.pattern.test(trimmed)) continue
    const article = extractArticleNumber(trimmed)
    if (article != null && entry.maxArticle != null && article > entry.maxArticle) {
      return {
        kind: 'invalid',
        reason: `"${entry.label}" solo llega al art. ${entry.maxArticle}; el art. ${article} no existe.`,
      }
    }
    return {
      kind: 'verified',
      label: article != null ? `${entry.label} — art. ${article}` : entry.label,
      url: entry.url,
    }
  }
  return { kind: 'unknown' }
}
