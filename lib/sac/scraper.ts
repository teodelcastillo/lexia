/**
 * SAC Extranet Scraper — Playwright-based headless browser automation
 *
 * Responsible for:
 *   1. Logging in to the SAC extranet with lawyer credentials
 *   2. Searching for a case by expediente number + year
 *   3. Extracting case metadata and movements
 *
 * All CSS/XPath selectors come from the configurable SAC_SELECTORS object
 * in lib/sac/types.ts so they can be updated without touching this logic.
 *
 * On Vercel/serverless: uses @sparticuz/chromium (Chromium for serverless).
 * Locally: uses Playwright's Chromium (run `npx playwright install`).
 */
import type { Browser, Page, BrowserContext } from 'playwright-core'
import {
  SAC_BASE_URL,
  SAC_SELECTORS,
  SAC_RATE_LIMITS,
  type SacSelectorKey,
  type SacParsedMovement,
  type SacCaseData,
} from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Attempt to find an element using the primary selector first,
 * then fall back to alternatives. Returns the first match or null.
 */
async function resolveSelector(
  page: Page,
  key: SacSelectorKey,
  options: { timeout?: number } = {}
): Promise<string | null> {
  const entry = SAC_SELECTORS[key]
  const timeout = options.timeout ?? 5_000

  const selectors = [entry.primary, ...(entry.fallbacks ?? [])]

  for (const sel of selectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout, state: 'attached' })
      if (el) return sel
    } catch {
      // Selector not found, try next
    }
  }

  return null
}

/**
 * Like resolveSelector but throws with a descriptive error when nothing matches.
 */
async function requireSelector(
  page: Page,
  key: SacSelectorKey,
  options: { timeout?: number } = {}
): Promise<string> {
  const sel = await resolveSelector(page, key, options)
  if (!sel) {
    const entry = SAC_SELECTORS[key]
    throw new Error(
      `[SAC Scraper] Could not find element for "${key}": ${entry.description}. ` +
        `Tried: ${[entry.primary, ...(entry.fallbacks ?? [])].join(', ')}`
    )
  }
  return sel
}

// ---------------------------------------------------------------------------
// Browser lifecycle
// ---------------------------------------------------------------------------

let _browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (_browser?.isConnected()) return _browser

  if (process.env.VERCEL) {
    // Vercel/serverless: use @sparticuz/chromium (Chromium bundled for serverless)
    const chromium = await import('@sparticuz/chromium')
    const { chromium: pwChromium } = await import('playwright-core')
    _browser = await pwChromium.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: chromium.headless,
    })
  } else {
    // Local: use Playwright's Chromium (requires `npx playwright install`)
    const { chromium } = await import('playwright')
    _browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
  }
  return _browser
}

export async function closeBrowser(): Promise<void> {
  if (_browser?.isConnected()) {
    await _browser.close()
    _browser = null
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

interface LoginResult {
  success: boolean
  error?: string
  context?: BrowserContext
}

async function performLogin(
  username: string,
  password: string,
  existingContext?: BrowserContext
): Promise<LoginResult> {
  const browser = await getBrowser()
  const context = existingContext ?? (await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  }))

  const page = await context.newPage()

  try {
    await page.goto(SAC_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    const userSel = await requireSelector(page, 'usernameInput', { timeout: 10_000 })
    const passSel = await requireSelector(page, 'passwordInput')
    const submitSel = await requireSelector(page, 'submitButton')

    await page.fill(userSel, username)
    await page.fill(passSel, password)
    await page.click(submitSel)

    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 })

    // Short wait for any redirect / JS-based nav
    await page.waitForTimeout(2_000)

    const successSel = await resolveSelector(page, 'loginSuccessIndicator', { timeout: 8_000 })

    if (successSel) {
      await page.close()
      return { success: true, context }
    }

    // Check if we're still on the login page (login failed)
    const stillOnLogin = await resolveSelector(page, 'usernameInput', { timeout: 2_000 })
    if (stillOnLogin) {
      await page.close()
      if (!existingContext) await context.close()
      return { success: false, error: 'Credenciales inválidas o login rechazado' }
    }

    // Ambiguous state — assume success if no login form is visible
    await page.close()
    return { success: true, context }
  } catch (err) {
    try { await page.close() } catch { /* ignore */ }
    if (!existingContext) {
      try { await context.close() } catch { /* ignore */ }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error desconocido en login',
    }
  }
}

/**
 * Public: verify that credentials work (used by /api/sac/credentials/verify).
 * Opens a browser, attempts login, closes everything.
 */
export async function verifySacLogin(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const result = await performLogin(username, password)
  if (result.context) {
    try { await result.context.close() } catch { /* ignore */ }
  }
  return { success: result.success, error: result.error }
}

// ---------------------------------------------------------------------------
// Case query
// ---------------------------------------------------------------------------

/**
 * Scrape a single case from the SAC extranet.
 *
 * @param username  Extranet username
 * @param password  Decrypted password
 * @param expedienteNumber  Case number (digits only)
 * @param anio  4-digit year
 * @param fuero  Optional fuero code (if the search form requires it)
 */
export async function scrapeSacCase(
  username: string,
  password: string,
  expedienteNumber: string,
  anio: string,
  _fuero?: string
): Promise<SacCaseData & { loginError?: string }> {
  const loginResult = await performLogin(username, password)

  if (!loginResult.success || !loginResult.context) {
    return {
      loginError: loginResult.error ?? 'Login fallido',
      movements: [],
    }
  }

  const context = loginResult.context
  const page = await context.newPage()

  try {
    // Navigate to search
    const searchLinkSel = await resolveSelector(page, 'searchExpedienteLink', { timeout: 10_000 })
    if (searchLinkSel) {
      await page.click(searchLinkSel)
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 })
    } else {
      // Try navigating directly to a common search URL pattern
      await page.goto(`${SAC_BASE_URL}/consultaCausas`, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      })
    }

    // Fill search form
    const expSel = await requireSelector(page, 'expedienteInput', { timeout: 10_000 })
    await page.fill(expSel, expedienteNumber)

    const anioSel = await resolveSelector(page, 'anioInput')
    if (anioSel) {
      const tagName = await page.evaluate(
        (sel) => document.querySelector(sel)?.tagName.toLowerCase(),
        anioSel
      )
      if (tagName === 'select') {
        await page.selectOption(anioSel, anio)
      } else {
        await page.fill(anioSel, anio)
      }
    }

    const searchBtnSel = await requireSelector(page, 'searchButton')
    await page.click(searchBtnSel)
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 })
    await page.waitForTimeout(2_000)

    // If results table is shown, click the first result
    const resultSel = await resolveSelector(page, 'resultFirstRow', { timeout: 5_000 })
    if (resultSel) {
      await page.click(resultSel)
      await page.waitForLoadState('domcontentloaded', { timeout: 15_000 })
      await page.waitForTimeout(1_500)
    }

    // Extract case metadata
    const caseData = await extractCaseData(page)

    await page.close()
    await context.close()
    return caseData
  } catch (err) {
    try { await page.close() } catch { /* ignore */ }
    try { await context.close() } catch { /* ignore */ }
    throw err
  }
}

async function extractCaseData(page: Page): Promise<SacCaseData> {
  const getText = async (key: SacSelectorKey): Promise<string | undefined> => {
    const sel = await resolveSelector(page, key, { timeout: 3_000 })
    if (!sel) return undefined
    const text = await page.textContent(sel)
    return text?.trim() || undefined
  }

  const caratula = await getText('caratula')
  const juzgado = await getText('juzgado')
  const secretaria = await getText('secretaria')
  const estado_actual = await getText('estadoCausa')
  const proxima_audiencia = await getText('proximaAudiencia')

  // Extract movements table
  const movements = await extractMovements(page)

  return {
    caratula,
    juzgado,
    secretaria,
    estado_actual,
    proxima_audiencia: proxima_audiencia ?? null,
    movements,
  }
}

async function extractMovements(page: Page): Promise<SacParsedMovement[]> {
  const rowsSel = await resolveSelector(page, 'movementRows', { timeout: 5_000 })
  if (!rowsSel) return []

  const rows = await page.$$(rowsSel)
  const movements: SacParsedMovement[] = []

  for (const row of rows) {
    const cells = await row.$$('td')
    if (cells.length < 3) continue

    const cellTexts: string[] = []
    for (const cell of cells) {
      const text = await cell.textContent()
      cellTexts.push((text ?? '').trim())
    }

    // Common SAC table layout: Fecha | Tipo | Descripción | Folio | Secretaría
    const movement: SacParsedMovement = {
      fecha: cellTexts[0] || '',
      tipo: cellTexts[1] || '',
      descripcion: cellTexts[2] || '',
      folio: cellTexts[3] || undefined,
      secretaria_mov: cellTexts[4] || undefined,
      raw_data: { cells: cellTexts },
    }

    if (movement.fecha && movement.tipo && movement.descripcion) {
      movements.push(movement)
    }
  }

  return movements
}

// ---------------------------------------------------------------------------
// Batch utilities for cron
// ---------------------------------------------------------------------------

/**
 * Wait the configured delay between individual case queries.
 */
export async function waitBetweenQueries(): Promise<void> {
  await randomDelay(SAC_RATE_LIMITS.betweenQueriesMinMs, SAC_RATE_LIMITS.betweenQueriesMaxMs)
}

/**
 * Wait the configured delay between batches.
 */
export async function waitBetweenBatches(): Promise<void> {
  await randomDelay(SAC_RATE_LIMITS.betweenBatchesMinMs, SAC_RATE_LIMITS.betweenBatchesMaxMs)
}
