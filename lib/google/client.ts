/**
 * Google OAuth2 Client
 *
 * Handles OAuth flow and token management for Google APIs
 * (Calendar, Drive, Sheets, Docs).
 */
import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

const SCOPES = {
  calendar: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  drive: ['https://www.googleapis.com/auth/drive.file'],
  sheets: ['https://www.googleapis.com/auth/spreadsheets'],
  docs: ['https://www.googleapis.com/auth/documents'],
} as const

export type GoogleService = keyof typeof SCOPES

/**
 * Creates an OAuth2 client for Google APIs
 */
export function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Google OAuth config: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI'
    )
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/**
 * Generates the authorization URL for the given service
 */
export function getAuthUrl(
  oauth2Client: OAuth2Client,
  service: GoogleService,
  state: string
): string {
  const scopes = SCOPES[service]
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Force consent to get refresh_token
    scope: [...scopes], // mutable copy for API type (SCOPES is readonly)
    state,
    include_granted_scopes: true, // Incremental auth for future services
  })
}

/**
 * Exchanges authorization code for tokens
 */
export async function getTokensFromCode(
  oauth2Client: OAuth2Client,
  code: string
) {
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

/**
 * Creates an OAuth2 client with stored tokens (for API calls)
 */
export function createAuthenticatedClient(tokens: {
  access_token: string
  refresh_token?: string | null
  expiry_date?: number | null
}): OAuth2Client {
  const client = createOAuth2Client()
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  })
  return client
}

/**
 * Ensures tokens are valid, refreshing if expired.
 * Returns updated tokens (caller should persist to DB if refreshed).
 */
export async function ensureValidTokens(tokens: {
  access_token: string
  refresh_token?: string | null
  expiry_date?: number | null
}): Promise<{
  access_token: string
  refresh_token?: string | null
  expiry_date?: number | null
  wasRefreshed: boolean
}> {
  const client = createAuthenticatedClient(tokens)
  const needRefresh =
    !tokens.expiry_date ||
    tokens.expiry_date < Date.now() + 5 * 60 * 1000 // 5 min buffer
  if (needRefresh && tokens.refresh_token) {
    const { credentials } = await client.refreshAccessToken()
    return {
      access_token: credentials.access_token!,
      refresh_token: credentials.refresh_token ?? tokens.refresh_token,
      expiry_date: credentials.expiry_date ?? null,
      wasRefreshed: true,
    }
  }
  return {
    ...tokens,
    wasRefreshed: false,
  }
}
