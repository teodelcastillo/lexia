/**
 * SAC HTTP Scraper — reemplaza la versión Playwright con fetch + cookies.
 *
 * El SAC de Córdoba es ASP.NET WebForms: usa __VIEWSTATE / __EVENTVALIDATION
 * como campos ocultos en formularios POST clásicos. No necesita JavaScript.
 *
 * Flujo:
 *  1. GET login page → extrae ViewState + field names + cookies
 *  2. POST credenciales → autentica, sigue redirect, guarda cookies de sesión
 *  3. Navega al buscador → POST búsqueda por expediente
 *  4. Parsea movimientos de la tabla resultado
 */

import type { SacCaseData, SacParsedMovement } from './types'

export const SAC_BASE_URL =
  process.env.SAC_BASE_URL || 'https://www.justiciacordoba.gob.ar/justiciacordoba/extranet.aspx'

// ---------------------------------------------------------------------------
// Cookie jar mínimo
// ---------------------------------------------------------------------------

interface CookieJar {
  cookies: Record<string, string>
  fromSetCookie(headers: Headers): void
  asHeader(): string
}

function createCookieJar(): CookieJar {
  const cookies: Record<string, string> = {}

  return {
    cookies,
    fromSetCookie(headers: Headers) {
      headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'set-cookie') return
        const parts = value.split(';')[0].trim()
        const eq = parts.indexOf('=')
        if (eq === -1) return
        const name = parts.slice(0, eq).trim()
        const val = parts.slice(eq + 1).trim()
        cookies[name] = val
      })
    },
    asHeader() {
      return Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')
    },
  }
}

// ---------------------------------------------------------------------------
// HTML parsing helpers
// ---------------------------------------------------------------------------

/** Extrae el valor de un input hidden por name */
function extractHidden(html: string, name: string): string | null {
  const re = new RegExp(
    `<input[^>]+name=["']${escapeRegex(name)}["'][^>]+value=["']([^"']*)["']`,
    'i'
  )
  const m = html.match(re) ?? html.match(
    new RegExp(
      `<input[^>]+value=["']([^"']*)["'][^>]+name=["']${escapeRegex(name)}["']`,
      'i'
    )
  )
  return m ? m[1] : null
}

/** Extrae el atributo `action` del primer formulario */
function extractFormAction(html: string, baseUrl: string): string {
  const m = html.match(/<form[^>]+action=["']([^"']*)["']/i)
  if (!m) return baseUrl
  const action = m[1]
  if (action.startsWith('http')) return action
  const url = new URL(baseUrl)
  return action.startsWith('/')
    ? `${url.protocol}//${url.host}${action}`
    : `${url.protocol}//${url.host}${url.pathname.replace(/[^/]*$/, '')}${action}`
}

/** Extrae el name del input de usuario detectando por label o posición */
function detectFieldName(html: string, hints: string[]): string | null {
  for (const hint of hints) {
    const re = new RegExp(
      `<input[^>]+name=["']([^"']*)["'][^>]+(?:id|name|placeholder)=["'][^"']*${escapeRegex(hint)}[^"']*["']`,
      'i'
    )
    const m = html.match(re)
    if (m) return m[1]
    // también buscar el name directamente
    const re2 = new RegExp(`<input[^>]+name=["']([^"']*${escapeRegex(hint)}[^"']*)["']`, 'i')
    const m2 = html.match(re2)
    if (m2) return m2[1]
  }
  return null
}

/**
 * Extrae filas de una tabla HTML.
 * Devuelve arrays de celdas (texto plano por celda).
 */
function extractTableRows(html: string, tableHint?: string): string[][] {
  // Buscar la tabla relevante
  let tableHtml = html
  if (tableHint) {
    const re = new RegExp(
      `<table[^>]*(?:id|class)=["'][^"']*${escapeRegex(tableHint)}[^"']*["'][^>]*>([\\s\\S]*?)</table>`,
      'i'
    )
    const m = html.match(re)
    if (m) tableHtml = m[0]
  }

  const rows: string[][] = []
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRe.exec(tableHtml)) !== null) {
    const cells: string[] = []
    const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]).trim())
    }
    if (cells.length > 0) rows.push(cells)
  }
  return rows
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------------------------------------------------------------------------
// Tipos de resultado
// ---------------------------------------------------------------------------

export interface HttpLoginResult {
  success: boolean
  error?: string
  jar?: CookieJar
  postLoginHtml?: string
}

export interface SacDiagnosticStep {
  step: string
  ok: boolean
  detail?: string
  htmlSnippet?: string
  /** Campos detectados en la página de login */
  detectedFields?: Record<string, string | null>
}

export interface SacDiagnosticResult {
  steps: SacDiagnosticStep[]
  error?: string
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function httpLogin(
  username: string,
  password: string
): Promise<HttpLoginResult> {
  const jar = createCookieJar()

  // 1. GET la página de login
  let loginHtml: string
  let loginUrl = SAC_BASE_URL
  try {
    const res = await fetch(SAC_BASE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      redirect: 'follow',
    })
    jar.fromSetCookie(res.headers)
    loginHtml = await res.text()
    loginUrl = res.url // puede haber redirect
  } catch (err) {
    return { success: false, error: `No se pudo cargar la página del SAC: ${err}` }
  }

  // 2. Extraer campos ASP.NET
  const viewState = extractHidden(loginHtml, '__VIEWSTATE')
  const eventValidation = extractHidden(loginHtml, '__EVENTVALIDATION')
  const viewStateGen = extractHidden(loginHtml, '__VIEWSTATEGENERATOR')
  const formAction = extractFormAction(loginHtml, loginUrl)

  // Detectar nombres de campos de usuario/contraseña
  const userFieldName =
    detectFieldName(loginHtml, ['usuario', 'Usuario', 'user', 'User', 'login', 'Login']) ??
    'ctl00$ContentPlaceHolder1$txtUsuario'
  const passFieldName =
    detectFieldName(loginHtml, ['clave', 'Clave', 'password', 'Password', 'contrasena']) ??
    'ctl00$ContentPlaceHolder1$txtClave'
  const submitFieldName =
    detectFieldName(loginHtml, ['btnIngresar', 'submit', 'Ingresar', 'btnLogin']) ??
    'ctl00$ContentPlaceHolder1$btnIngresar'

  // 3. POST login
  const body = new URLSearchParams()
  if (viewState) body.set('__VIEWSTATE', viewState)
  if (eventValidation) body.set('__EVENTVALIDATION', eventValidation)
  if (viewStateGen) body.set('__VIEWSTATEGENERATOR', viewStateGen)
  body.set(userFieldName, username)
  body.set(passFieldName, password)
  body.set(submitFieldName, 'Ingresar')
  body.set('__EVENTTARGET', '')
  body.set('__EVENTARGUMENT', '')

  let postHtml: string
  let postUrl: string
  try {
    const res = await fetch(formAction, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Referer: loginUrl,
        Cookie: jar.asHeader(),
      },
      body: body.toString(),
      redirect: 'follow',
    })
    jar.fromSetCookie(res.headers)
    postHtml = await res.text()
    postUrl = res.url
  } catch (err) {
    return { success: false, error: `Error en el POST de login: ${err}` }
  }

  // 4. Detectar éxito: si la URL cambió y no hay campo de usuario en la respuesta
  const stillOnLogin =
    postHtml.match(/type=["']password["']/i) ||
    postHtml.match(/txtClave|txtUsuario|name=["'].*[Cc]lave.*["']/i)

  if (stillOnLogin) {
    // Buscar mensaje de error en la página
    const errMsg = postHtml.match(
      /<span[^>]*class=["'][^"']*error[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
    )
    const detail = errMsg ? stripTags(errMsg[1]) : 'Credenciales incorrectas o CAPTCHA'
    return { success: false, error: detail, postLoginHtml: postHtml }
  }

  return { success: true, jar, postLoginHtml: postHtml }
}

// ---------------------------------------------------------------------------
// Diagnóstico (sin y con credenciales)
// ---------------------------------------------------------------------------

export async function diagnoseSacConnectionHttp(): Promise<SacDiagnosticResult> {
  const steps: SacDiagnosticStep[] = []

  let html = ''
  try {
    const res = await fetch(SAC_BASE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      redirect: 'follow',
    })
    html = await res.text()
    steps.push({
      step: 'Cargar página de login SAC',
      ok: true,
      detail: `HTTP ${res.status} — URL final: ${res.url}`,
      htmlSnippet: html.slice(0, 4096),
    })
  } catch (err) {
    steps.push({
      step: 'Cargar página de login SAC',
      ok: false,
      detail: String(err),
    })
    return { steps, error: 'No se pudo alcanzar el SAC' }
  }

  // Campos detectados
  const viewState = extractHidden(html, '__VIEWSTATE')
  const eventValidation = extractHidden(html, '__EVENTVALIDATION')
  const userField = detectFieldName(html, ['usuario', 'user', 'login'])
  const passField = detectFieldName(html, ['clave', 'password', 'contrasena'])
  const submitField = detectFieldName(html, ['btnIngresar', 'submit', 'Ingresar'])
  const formAction = extractFormAction(html, SAC_BASE_URL)

  const detectedFields: Record<string, string | null> = {
    '__VIEWSTATE': viewState ? `${viewState.slice(0, 40)}...` : null,
    '__EVENTVALIDATION': eventValidation ? `${eventValidation.slice(0, 40)}...` : null,
    'Campo usuario': userField,
    'Campo contraseña': passField,
    'Botón submit': submitField,
    'Form action': formAction,
  }

  const hasForm = !!(viewState || userField || passField)
  steps.push({
    step: 'Detectar formulario de login ASP.NET',
    ok: hasForm,
    detail: hasForm
      ? 'Formulario detectado correctamente'
      : 'No se encontraron campos de formulario — la página puede requerir JavaScript o el URL cambió',
    detectedFields,
    htmlSnippet: html.slice(0, 4096),
  })

  return { steps }
}

export async function debugSacLoginHttp(
  username: string,
  password: string
): Promise<SacDiagnosticResult> {
  const steps: SacDiagnosticStep[] = []

  // Paso 1: cargar página
  let html = ''
  try {
    const res = await fetch(SAC_BASE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      redirect: 'follow',
    })
    html = await res.text()
    steps.push({
      step: 'Cargar página de login SAC',
      ok: true,
      detail: `HTTP ${res.status}`,
      htmlSnippet: html.slice(0, 4096),
    })
  } catch (err) {
    steps.push({ step: 'Cargar página de login SAC', ok: false, detail: String(err) })
    return { steps, error: 'No se pudo alcanzar el SAC' }
  }

  // Paso 2: detectar formulario
  const viewState = extractHidden(html, '__VIEWSTATE')
  const userField = detectFieldName(html, ['usuario', 'user', 'login'])
  const passField = detectFieldName(html, ['clave', 'password', 'contrasena'])
  steps.push({
    step: 'Detectar formulario ASP.NET',
    ok: !!(viewState && (userField || passField)),
    detail: `__VIEWSTATE: ${viewState ? 'encontrado' : 'NO encontrado'} | usuario: ${userField ?? 'no encontrado'} | contraseña: ${passField ?? 'no encontrado'}`,
    detectedFields: {
      '__VIEWSTATE': viewState ? 'encontrado' : null,
      'Campo usuario': userField,
      'Campo contraseña': passField,
    },
  })

  // Paso 3: intento de login
  const result = await httpLogin(username, password)
  steps.push({
    step: 'Intentar login con credenciales',
    ok: result.success,
    detail: result.success ? 'Login exitoso' : (result.error ?? 'Login fallido'),
    htmlSnippet: result.postLoginHtml?.slice(0, 4096),
  })

  if (result.success) {
    // Paso 4: si el login funcionó, buscar links del menú principal
    const menuLinks: string[] = []
    const linkRe = /<a[^>]+href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
    let m: RegExpExecArray | null
    while ((m = linkRe.exec(result.postLoginHtml ?? '')) !== null) {
      const text = stripTags(m[2]).trim()
      if (text.length > 1 && text.length < 60) menuLinks.push(`${text} → ${m[1]}`)
    }
    steps.push({
      step: 'Detectar menú post-login',
      ok: menuLinks.length > 0,
      detail: menuLinks.length > 0
        ? `${menuLinks.length} links encontrados`
        : 'No se detectaron links de navegación',
      detectedFields: Object.fromEntries(menuLinks.slice(0, 10).map((l, i) => [`Link ${i + 1}`, l])),
    })
  }

  return { steps }
}

// ---------------------------------------------------------------------------
// Scraping de caso
// ---------------------------------------------------------------------------

export async function httpScrapeSacCase(
  username: string,
  password: string,
  expedienteNumber: string,
  anio: string,
  _fuero?: string
): Promise<SacCaseData & { loginError?: string }> {
  // 1. Login
  const loginResult = await httpLogin(username, password)
  if (!loginResult.success || !loginResult.jar) {
    return { loginError: loginResult.error ?? 'Login fallido', movements: [] }
  }

  const jar = loginResult.jar
  let currentHtml = loginResult.postLoginHtml ?? ''

  // 2. Navegar al buscador de expedientes
  // Intentamos detectar el link de búsqueda en el menú post-login
  const searchUrl = detectSearchUrl(currentHtml)

  if (searchUrl) {
    try {
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Cookie: jar.asHeader(),
        },
        redirect: 'follow',
      })
      jar.fromSetCookie(res.headers)
      currentHtml = await res.text()
    } catch {
      // Si no podemos navegar al buscador, intentamos directamente
    }
  }

  // 3. POST búsqueda por expediente
  const viewState = extractHidden(currentHtml, '__VIEWSTATE')
  const eventValidation = extractHidden(currentHtml, '__EVENTVALIDATION')
  const viewStateGen = extractHidden(currentHtml, '__VIEWSTATEGENERATOR')
  const searchFormAction = extractFormAction(currentHtml, searchUrl ?? SAC_BASE_URL)

  // Detectar nombres de campos del buscador
  const expFieldName =
    detectFieldName(currentHtml, ['nroExpediente', 'expediente', 'numero', 'nro']) ??
    'ctl00$ContentPlaceHolder1$txtNroExpediente'
  const anioFieldName =
    detectFieldName(currentHtml, ['anio', 'año', 'year']) ??
    'ctl00$ContentPlaceHolder1$txtAnio'
  const searchBtnName =
    detectFieldName(currentHtml, ['btnBuscar', 'buscar', 'Buscar', 'search']) ??
    'ctl00$ContentPlaceHolder1$btnBuscar'

  const searchBody = new URLSearchParams()
  if (viewState) searchBody.set('__VIEWSTATE', viewState)
  if (eventValidation) searchBody.set('__EVENTVALIDATION', eventValidation)
  if (viewStateGen) searchBody.set('__VIEWSTATEGENERATOR', viewStateGen)
  searchBody.set('__EVENTTARGET', '')
  searchBody.set('__EVENTARGUMENT', '')
  searchBody.set(expFieldName, expedienteNumber)
  searchBody.set(anioFieldName, anio)
  searchBody.set(searchBtnName, 'Buscar')

  let resultsHtml: string
  try {
    const res = await fetch(searchFormAction, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        Cookie: jar.asHeader(),
      },
      body: searchBody.toString(),
      redirect: 'follow',
    })
    jar.fromSetCookie(res.headers)
    resultsHtml = await res.text()
  } catch (err) {
    return { loginError: `Error en búsqueda: ${err}`, movements: [] }
  }

  // 4. Parsear caso y movimientos
  return parseCasePage(resultsHtml)
}

function detectSearchUrl(html: string): string | null {
  const patterns = [
    /href=["']([^"']*(?:expediente|consulta|busca|causa)[^"']*)["']/gi,
    /href=["']([^"']*extranet[^"']*)["']/gi,
  ]
  for (const re of patterns) {
    const m = re.exec(html)
    if (!m) continue
    const href = m[1]
    if (href.startsWith('http')) return href
    const base = new URL(SAC_BASE_URL)
    return href.startsWith('/') ? `${base.protocol}//${base.host}${href}` : href
  }
  return null
}

function parseCasePage(html: string): SacCaseData {
  // Extraer metadatos del caso
  const caratula = extractLabeledField(html, ['Carátula', 'Caratula', 'caratula'])
  const juzgado = extractLabeledField(html, ['Juzgado', 'juzgado', 'Tribunal'])
  const secretaria = extractLabeledField(html, ['Secretaría', 'Secretaria', 'secretaria'])
  const estado_actual = extractLabeledField(html, ['Estado', 'estado', 'Situación'])
  const proxima_audiencia = extractLabeledField(html, ['Audiencia', 'audiencia', 'Próxima audiencia'])

  // Extraer tabla de movimientos
  const rows = extractTableRows(html, 'movimiento')
  const movements: SacParsedMovement[] = []

  for (const cells of rows) {
    if (cells.length < 3) continue
    // Saltar header rows
    if (/fecha|tipo|descripci/i.test(cells[0])) continue
    movements.push({
      fecha: cells[0] ?? '',
      tipo: cells[1] ?? '',
      descripcion: cells[2] ?? '',
      folio: cells[3],
      secretaria_mov: cells[4],
      raw_data: { cells },
    })
  }

  return { caratula, juzgado, secretaria, estado_actual, proxima_audiencia, movements }
}

/**
 * Busca el valor de un campo por su label en el HTML.
 * Cubre: <td>Label</td><td>Valor</td>, <span id="...">Valor</span> y similares.
 */
function extractLabeledField(html: string, labels: string[]): string | undefined {
  for (const label of labels) {
    // Patrón: <td>Label</td><td>Valor</td>
    const tdRe = new RegExp(
      `<td[^>]*>[^<]*${escapeRegex(label)}[^<]*<\\/td>\\s*<td[^>]*>([^<]+)<\\/td>`,
      'i'
    )
    const m1 = html.match(tdRe)
    if (m1) return stripTags(m1[1]).trim()

    // Patrón: id/class contiene el label hint y span/div siguiente
    const spanRe = new RegExp(
      `<(?:span|div|td)[^>]*id=["'][^"']*${escapeRegex(label.toLowerCase().replace(/[áéíóú]/g, '.'))}[^"']*["'][^>]*>([^<]+)<`,
      'i'
    )
    const m2 = html.match(spanRe)
    if (m2) return stripTags(m2[1]).trim()
  }
  return undefined
}

/** Verifica credenciales con httpLogin (reemplaza verifySacLogin de Playwright) */
export async function httpVerifySacLogin(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const result = await httpLogin(username, password)
  return { success: result.success, error: result.error }
}

// ---------------------------------------------------------------------------
// Rate limiting (mantiene el mismo comportamiento que el cron anterior)
// ---------------------------------------------------------------------------

import { SAC_RATE_LIMITS } from './types'

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function waitBetweenQueries(): Promise<void> {
  await randomDelay(SAC_RATE_LIMITS.betweenQueriesMinMs, SAC_RATE_LIMITS.betweenQueriesMaxMs)
}

export async function waitBetweenBatches(): Promise<void> {
  await randomDelay(SAC_RATE_LIMITS.betweenBatchesMinMs, SAC_RATE_LIMITS.betweenBatchesMaxMs)
}
