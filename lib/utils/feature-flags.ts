/**
 * Feature flags for security-sensitive functionality.
 * Used for staged rollout and containment in production.
 */

/**
 * Seed users page/action is only enabled when explicitly allowed.
 * Set SEED_USERS_ENABLED=true in .env.local for development only.
 * Never enable in production.
 */
export function isSeedUsersEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false
  }
  return process.env.SEED_USERS_ENABLED === 'true'
}

/**
 * View-as-client (admin preview) is restricted until org isolation is verified.
 * Set VIEW_AS_ENABLED=true to allow. Disabled by default in production.
 */
export function isViewAsEnabled(): boolean {
  return process.env.VIEW_AS_ENABLED === 'true'
}
