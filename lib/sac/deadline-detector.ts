/**
 * SAC Deadline Detector
 *
 * Analyzes movement descriptions from the SAC extranet to detect
 * possible legal deadlines (plazos) that should be tracked in Lexia.
 *
 * This runs on the text content only — no HTML parsing needed.
 */
import { addDays, addBusinessDays, format, parse, isValid } from 'date-fns'
import type { DeadlineSuggestion } from './types'

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

interface DeadlinePattern {
  /** Regex to match against the movement description (case-insensitive) */
  regex: RegExp
  /** Human-readable name for this pattern */
  name: string
  /**
   * Given the regex match and the movement date, compute the suggested
   * deadline date. Return null if computation isn't possible.
   */
  computeDate: (match: RegExpMatchArray, movementDate: Date) => Date | null
  /** Whether the days extracted are business days (hábiles) */
  businessDays?: boolean
}

const DEADLINE_PATTERNS: DeadlinePattern[] = [
  {
    name: 'plazo_dias_habiles',
    regex: /(?:plazo|término)\s+de\s+(\d{1,3})\s*d[ií]as?\s*h[áa]biles?/i,
    computeDate: (match, movDate) => {
      const days = parseInt(match[1], 10)
      return isNaN(days) ? null : addBusinessDays(movDate, days)
    },
    businessDays: true,
  },
  {
    name: 'plazo_dias',
    regex: /(?:plazo|término)\s+de\s+(\d{1,3})\s*d[ií]as?(?!\s*h[áa]bil)/i,
    computeDate: (match, movDate) => {
      const days = parseInt(match[1], 10)
      return isNaN(days) ? null : addDays(movDate, days)
    },
  },
  {
    name: 'traslado_dias',
    regex: /traslado\s+(?:por\s+)?(\d{1,3})\s*d[ií]as?/i,
    computeDate: (match, movDate) => {
      const days = parseInt(match[1], 10)
      return isNaN(days) ? null : addBusinessDays(movDate, days)
    },
    businessDays: true,
  },
  {
    name: 'vista_dias',
    regex: /(?:c[oó]rrase?\s+)?vista\s+(?:por\s+)?(\d{1,3})\s*d[ií]as?/i,
    computeDate: (match, movDate) => {
      const days = parseInt(match[1], 10)
      return isNaN(days) ? null : addBusinessDays(movDate, days)
    },
    businessDays: true,
  },
  {
    name: 'presentar_dentro_de',
    regex: /presentar?\s+(?:dentro\s+de|en)\s+(\d{1,3})\s*d[ií]as?/i,
    computeDate: (match, movDate) => {
      const days = parseInt(match[1], 10)
      return isNaN(days) ? null : addBusinessDays(movDate, days)
    },
    businessDays: true,
  },
  {
    name: 'fecha_explicita_dd_mm_yyyy',
    regex: /(?:vencimiento|fecha\s+l[ií]mite|hasta\s+el)\s*:?\s*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/i,
    computeDate: (match) => {
      const day = match[1]
      const month = match[2]
      let year = match[3]
      if (year.length === 2) year = `20${year}`
      const parsed = parse(`${day}/${month}/${year}`, 'dd/MM/yyyy', new Date())
      return isValid(parsed) ? parsed : null
    },
  },
  {
    name: 'audiencia_fecha',
    regex: /audiencia\s+(?:para\s+el|fijada?\s+(?:para\s+)?el)\s+(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/i,
    computeDate: (match) => {
      const day = match[1]
      const month = match[2]
      let year = match[3]
      if (year.length === 2) year = `20${year}`
      const parsed = parse(`${day}/${month}/${year}`, 'dd/MM/yyyy', new Date())
      return isValid(parsed) ? parsed : null
    },
  },
  {
    name: 'apelacion',
    regex: /(?:apel(?:aci[oó]n|ar))\b/i,
    computeDate: (_, movDate) => addBusinessDays(movDate, 5),
    businessDays: true,
  },
  {
    name: 'sentencia_notificada',
    regex: /(?:notif[ií]quese\s+)?sentencia/i,
    computeDate: (_, movDate) => addBusinessDays(movDate, 5),
    businessDays: true,
  },
]

// Keywords that strongly suggest a deadline without a specific day count
const DEADLINE_KEYWORDS = [
  'vencimiento',
  'plazo',
  'término',
  'caducidad',
  'prescri',
  'perentori',
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze a movement's description to detect if it implies a legal deadline.
 *
 * @param descripcion  Full text of the movement description
 * @param tipo         Movement type (may provide additional context)
 * @param movementDate The date of the movement (used to compute offsets)
 * @returns A suggestion object indicating whether a deadline was detected
 */
export function detectDeadline(
  descripcion: string,
  tipo: string,
  movementDate: Date
): DeadlineSuggestion {
  const combined = `${tipo} ${descripcion}`

  for (const pattern of DEADLINE_PATTERNS) {
    const match = combined.match(pattern.regex)
    if (match) {
      const suggestedDate = pattern.computeDate(match, movementDate)
      return {
        detected: true,
        pattern_matched: pattern.name,
        suggested_date: suggestedDate ? format(suggestedDate, 'yyyy-MM-dd') : undefined,
        description: `Detectado: "${match[0]}"${pattern.businessDays ? ' (días hábiles)' : ''}`,
        source_movement_description: descripcion,
      }
    }
  }

  // Check for generic keywords even without a parseable day count
  const lowerCombined = combined.toLowerCase()
  for (const kw of DEADLINE_KEYWORDS) {
    if (lowerCombined.includes(kw)) {
      return {
        detected: true,
        pattern_matched: `keyword:${kw}`,
        description: `Texto contiene palabra clave: "${kw}". Revisar manualmente.`,
        source_movement_description: descripcion,
      }
    }
  }

  return {
    detected: false,
    source_movement_description: descripcion,
  }
}
