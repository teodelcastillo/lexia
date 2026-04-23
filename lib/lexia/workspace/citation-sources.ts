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
  // --- Extended set (migration 054) ---
  {
    label: 'Ley de Concursos y Quiebras (LCQ, Ley 24.522)',
    pattern: /\b(lcq|ley\s*24[.\s]?522|ley\s+de\s+concursos\s+y\s+quiebras)\b/i,
    maxArticle: 294,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-24522-25379',
    kind: 'norma',
  },
  {
    label: 'Ley de Propiedad Intelectual (Ley 11.723)',
    pattern: /\bley\s*11[.\s]?723\b/i,
    maxArticle: 89,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-11723-42755',
    kind: 'norma',
  },
  {
    label: 'Ley de Protección Integral a las Mujeres (Ley 26.485)',
    pattern: /\bley\s*26[.\s]?485\b/i,
    maxArticle: 45,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-26485-152155',
    kind: 'norma',
  },
  {
    label: 'Ley de Protección de Datos Personales (Ley 25.326)',
    pattern: /\b(ley\s*25[.\s]?326|protecci[oó]n\s+de\s+datos\s+personales)\b/i,
    maxArticle: 49,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790',
    kind: 'norma',
  },
  {
    label: 'Código Aeronáutico (Ley 17.285)',
    pattern: /\b(c[oó]digo\s+aeron[aá]utico|ley\s*17[.\s]?285)\b/i,
    maxArticle: 239,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-17285-24751',
    kind: 'codigo',
  },
  {
    label: 'CPCC Mendoza (Ley 9.001)',
    pattern: /\b(cpcc\s+mendoza|ley\s*9[.\s]?001)\b/i,
    maxArticle: 397,
    url: 'https://www.jus.mendoza.gov.ar/documents/10184/0/Ley+9001/',
    kind: 'codigo',
  },
  {
    label: 'CPCC Buenos Aires (Ley 7.425)',
    pattern: /\b(cpcc\s+buenos\s+aires|cpcba|ley\s*7[.\s]?425)\b/i,
    maxArticle: 895,
    url: 'https://normas.gba.gob.ar/documentos/xXzLGIw.html',
    kind: 'codigo',
  },
  {
    label: 'CPCC Santa Fe (Ley 5.531)',
    pattern: /\b(cpcc\s+santa\s+fe|ley\s*5[.\s]?531)\b/i,
    maxArticle: 596,
    url: 'https://www.santafe.gov.ar/normativa/',
    kind: 'codigo',
  },
  {
    label: 'Ley de Propiedad Horizontal (Ley 13.512)',
    pattern: /\bley\s*13[.\s]?512\b/i,
    maxArticle: 20,
    url: 'https://servicios.infoleg.gob.ar/infolegInternet/anexos/40000-44999/43091/norma.htm',
    kind: 'norma',
  },
  {
    label: 'Ley de Riesgos del Trabajo (LRT, Ley 24.557)',
    pattern: /\b(lrt|ley\s*24[.\s]?557|ley\s+de\s+riesgos\s+del\s+trabajo)\b/i,
    maxArticle: 51,
    url: 'https://www.argentina.gob.ar/normativa/nacional/ley-24557-27971',
    kind: 'norma',
  },
]

// ---------------------------------------------------------------------------
// Known leading cases (CSJN). Hardcoded so that very canonical "Fallos T:P"
// citations can be verified deterministically without hitting SAIJ.
// ---------------------------------------------------------------------------

export interface KnownJurisprudence {
  label: string
  /** Match patterns; if ANY matches, the citation is considered verified. */
  patterns: RegExp[]
  court: string
  year: number
  volumePages?: string   // e.g. "340:1695"
  url: string
}

export const KNOWN_LEADING_CASES: KnownJurisprudence[] = [
  {
    label: 'Halabi, Ernesto c/ PEN (CSJN, 2009)',
    patterns: [/\bhalabi\b/i, /\bFallos\s*332:111\b/],
    court: 'CSJN',
    year: 2009,
    volumePages: '332:111',
    url: 'https://sjconsulta.csjn.gov.ar/sjconsulta/',
  },
  {
    label: 'Aquino, Isacio c/ Cargo Servicios (CSJN, 2004)',
    patterns: [/\baquino\b.*\bcargo\b/i, /\bFallos\s*327:3753\b/],
    court: 'CSJN',
    year: 2004,
    volumePages: '327:3753',
    url: 'https://sjconsulta.csjn.gov.ar/sjconsulta/',
  },
  {
    label: 'Vizzoti, Carlos c/ AMSA (CSJN, 2004)',
    patterns: [/\bvizzoti\b/i, /\bFallos\s*327:3677\b/],
    court: 'CSJN',
    year: 2004,
    volumePages: '327:3677',
    url: 'https://sjconsulta.csjn.gov.ar/sjconsulta/',
  },
  {
    label: 'Ercolano c/ Lanteri de Renshaw (CSJN, 1922)',
    patterns: [/\bercolano\b.*\blanteri\b/i, /\bFallos\s*136:161\b/],
    court: 'CSJN',
    year: 1922,
    volumePages: '136:161',
    url: 'https://sjconsulta.csjn.gov.ar/sjconsulta/',
  },
  {
    label: 'Mendoza, Beatriz c/ Estado Nacional (riachuelo, CSJN, 2008)',
    patterns: [/\bmendoza\b.*\bbeatriz\b/i, /\briachuelo\b/i, /\bFallos\s*331:1622\b/],
    court: 'CSJN',
    year: 2008,
    volumePages: '331:1622',
    url: 'https://sjconsulta.csjn.gov.ar/sjconsulta/',
  },
  {
    label: 'Arriola (CSJN, 2009)',
    patterns: [/\barriola\b/i, /\bFallos\s*332:1963\b/],
    court: 'CSJN',
    year: 2009,
    volumePages: '332:1963',
    url: 'https://sjconsulta.csjn.gov.ar/sjconsulta/',
  },
  {
    label: 'Siri, Angel (CSJN, 1957)',
    patterns: [/\bsiri\b.*\bangel\b/i, /\bFallos\s*239:459\b/],
    court: 'CSJN',
    year: 1957,
    volumePages: '239:459',
    url: 'https://sjconsulta.csjn.gov.ar/sjconsulta/',
  },
  {
    label: 'Kot (CSJN, 1958)',
    patterns: [/\bkot\b.*(samuel|s\.a)/i, /\bFallos\s*241:291\b/],
    court: 'CSJN',
    year: 1958,
    volumePages: '241:291',
    url: 'https://sjconsulta.csjn.gov.ar/sjconsulta/',
  },
  {
    label: 'Ekmekdjian c/ Sofovich (CSJN, 1992)',
    patterns: [/\bekmekdjian\b/i, /\bsofovich\b/i, /\bFallos\s*315:1492\b/],
    court: 'CSJN',
    year: 1992,
    volumePages: '315:1492',
    url: 'https://sjconsulta.csjn.gov.ar/sjconsulta/',
  },
  {
    label: 'Bazterrica (CSJN, 1986)',
    patterns: [/\bbazterrica\b/i, /\bFallos\s*308:1392\b/],
    court: 'CSJN',
    year: 1986,
    volumePages: '308:1392',
    url: 'https://sjconsulta.csjn.gov.ar/sjconsulta/',
  },
]

export type JurisVerdict =
  | { kind: 'verified'; label: string; url: string; source: 'dataset' }
  | { kind: 'unknown' }

/**
 * Try to match a jurisprudence label against the hardcoded leading cases.
 * Only returns `verified` for perfect hits; otherwise leaves it to the
 * SAIJ cache / LLM judge downstream.
 */
export function matchKnownJurisprudence(label: string): JurisVerdict {
  const trimmed = label.trim()
  for (const c of KNOWN_LEADING_CASES) {
    for (const p of c.patterns) {
      if (p.test(trimmed)) {
        return { kind: 'verified', label: c.label, url: c.url, source: 'dataset' }
      }
    }
  }
  return { kind: 'unknown' }
}

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
