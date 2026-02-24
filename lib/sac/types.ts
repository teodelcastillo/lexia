import type { SacMovement as DBSacMovement } from '@/lib/types/database'

// =============================================================================
// SAC (Sistema de Administración de Causas) — Poder Judicial de Córdoba
// =============================================================================

/**
 * Base URL for the SAC extranet. Replace with the actual URL once confirmed.
 * Can also be overridden via SAC_BASE_URL environment variable.
 */
export const SAC_BASE_URL =
  process.env.SAC_BASE_URL || 'https://extranet.justiciacordoba.gob.ar'

// =============================================================================
// Fuero options for Córdoba courts
// =============================================================================

export const SAC_FUERO_OPTIONS = [
  { value: 'civil_comercial', label: 'Civil y Comercial' },
  { value: 'laboral', label: 'Laboral' },
  { value: 'familia', label: 'Familia' },
  { value: 'penal', label: 'Penal' },
  { value: 'contencioso_administrativo', label: 'Contencioso Administrativo' },
  { value: 'concursos_quiebras', label: 'Concursos y Quiebras' },
  { value: 'ejecucion_fiscal', label: 'Ejecución Fiscal' },
  { value: 'documentos_y_locaciones', label: 'Documentos y Locaciones' },
  { value: 'otro', label: 'Otro' },
] as const

export type SacFuero = (typeof SAC_FUERO_OPTIONS)[number]['value']

// =============================================================================
// Selector configuration
// =============================================================================

export interface SelectorEntry {
  /** Primary CSS/XPath selector to try first */
  primary: string
  /** Fallback selectors to try if primary fails */
  fallbacks?: string[]
  /** Description of the target HTML element */
  description: string
}

/**
 * Configurable selectors for the SAC extranet scraper.
 * These MUST be adjusted when the actual HTML structure is available.
 * Each selector describes what element it targets so maintainers
 * can update them when the extranet layout changes.
 */
export const SAC_SELECTORS = {
  // --- Login page ---
  loginForm: {
    primary: 'form#loginForm',
    fallbacks: ['form[action*="login"]', 'form.login-form'],
    description: 'Main login form container',
  },
  usernameInput: {
    primary: 'input#username',
    fallbacks: ['input[name="username"]', 'input[name="usuario"]', 'input[type="text"]'],
    description: 'Username/email input on login page',
  },
  passwordInput: {
    primary: 'input#password',
    fallbacks: ['input[name="password"]', 'input[name="clave"]', 'input[type="password"]'],
    description: 'Password input on login page',
  },
  submitButton: {
    primary: 'button[type="submit"]',
    fallbacks: ['input[type="submit"]', 'button.btn-login', '#btnIngresar'],
    description: 'Login form submit button',
  },
  loginSuccessIndicator: {
    primary: '.user-welcome',
    fallbacks: ['.navbar-user', '#menuPrincipal', 'a[href*="logout"]', '.dashboard-container'],
    description: 'Element present only when logged in (welcome text or logout link)',
  },

  // --- Search page ---
  searchExpedienteLink: {
    primary: 'a[href*="expediente"]',
    fallbacks: ['a[href*="consulta"]', '#menuConsultaCausas', 'a:has-text("Consulta")'],
    description: 'Navigation link to the case/expediente search page',
  },
  expedienteInput: {
    primary: 'input#nroExpediente',
    fallbacks: ['input[name="nroExpediente"]', 'input[name="expediente"]', 'input#numero'],
    description: 'Expediente number input field',
  },
  anioInput: {
    primary: 'input#anio',
    fallbacks: ['input[name="anio"]', 'select#anio', 'input[name="año"]'],
    description: 'Year (año) input or select field',
  },
  fueroSelect: {
    primary: 'select#fuero',
    fallbacks: ['select[name="fuero"]', '#cmbFuero'],
    description: 'Fuero dropdown/select',
  },
  searchButton: {
    primary: 'button#btnBuscar',
    fallbacks: ['button[type="submit"]', 'input[value="Buscar"]', 'button:has-text("Buscar")'],
    description: 'Search/submit button on the expediente search form',
  },

  // --- Results page ---
  resultTable: {
    primary: 'table.resultado-busqueda',
    fallbacks: ['table#tblResultados', '.table-responsive table', 'table.table'],
    description: 'Table listing search results (when multiple matches)',
  },
  resultFirstRow: {
    primary: 'table.resultado-busqueda tbody tr:first-child a',
    fallbacks: ['table#tblResultados tbody tr:first-child a', '.table tbody tr:first-child a'],
    description: 'First result row link to open the case detail',
  },

  // --- Case detail page ---
  caratula: {
    primary: '#caratula',
    fallbacks: ['.caratula-text', 'span[data-field="caratula"]', 'td:has-text("Carátula") + td'],
    description: 'Case title/caratula text',
  },
  juzgado: {
    primary: '#juzgado',
    fallbacks: ['.juzgado-text', 'span[data-field="juzgado"]', 'td:has-text("Juzgado") + td'],
    description: 'Court/juzgado name',
  },
  secretaria: {
    primary: '#secretaria',
    fallbacks: ['.secretaria-text', 'td:has-text("Secretaría") + td'],
    description: 'Secretaría name',
  },
  estadoCausa: {
    primary: '#estado',
    fallbacks: ['.estado-causa', 'td:has-text("Estado") + td', 'span.badge-estado'],
    description: 'Current case status text',
  },
  movementsTable: {
    primary: 'table#tblMovimientos',
    fallbacks: ['table.movimientos', '.table-movimientos table', '#tablaActuaciones'],
    description: 'Table containing judicial movements/actuaciones',
  },
  movementRows: {
    primary: 'table#tblMovimientos tbody tr',
    fallbacks: ['table.movimientos tbody tr', '#tablaActuaciones tbody tr'],
    description: 'Individual movement rows within the movements table',
  },
  proximaAudiencia: {
    primary: '#proximaAudiencia',
    fallbacks: ['.proxima-audiencia', 'td:has-text("Audiencia") + td'],
    description: 'Next hearing/audiencia date if displayed',
  },
} as const satisfies Record<string, SelectorEntry>

export type SacSelectorKey = keyof typeof SAC_SELECTORS

// =============================================================================
// Rate limiting configuration
// =============================================================================

export const SAC_RATE_LIMITS = {
  /** Milliseconds to wait between individual case queries (random in range) */
  betweenQueriesMinMs: 8_000,
  betweenQueriesMaxMs: 15_000,
  /** Milliseconds to wait between batches of 10 cases (random in range) */
  betweenBatchesMinMs: 60_000,
  betweenBatchesMaxMs: 120_000,
  /** Maximum cases to process in a single cron execution */
  maxCasesPerRun: 50,
  /** Number of cases per batch before the longer pause */
  batchSize: 10,
} as const

// =============================================================================
// Domain types
// =============================================================================

export interface SacCredentialsInfo {
  hasCredentials: boolean
  extranet_username?: string
  last_successful_login?: string | null
  is_active?: boolean
  consecutive_failures?: number
}

export interface SacParsedMovement {
  fecha: string
  tipo: string
  descripcion: string
  folio?: string
  secretaria_mov?: string
  raw_data?: Record<string, unknown>
}

export interface SacCaseData {
  caratula?: string
  juzgado?: string
  secretaria?: string
  estado_actual?: string
  proxima_audiencia?: string | null
  movements: SacParsedMovement[]
}

export interface SacSyncResult {
  status: 'success' | 'error' | 'auth_failed' | 'no_changes' | 'skipped'
  movements_found: number
  new_movements_inserted: number
  error_message?: string
  duration_ms: number
  case_data?: SacCaseData
}

export interface SacLinkPayload {
  sac_expediente_number: string
  sac_anio: string
  sac_fuero: string
  sac_responsible_lawyer_id: string
}

export interface DeadlineSuggestion {
  detected: boolean
  pattern_matched?: string
  suggested_date?: string
  description?: string
  source_movement_description: string
}

export { type DBSacMovement as SacMovementRow }
