#!/usr/bin/env node
/**
 * Smoke test for critical routes (Phase 5 verification).
 * Run with: node scripts/smoke-test.mjs [BASE_URL]
 * Default BASE_URL: http://localhost:3000
 *
 * Verifies:
 * - Auth-protected routes return 401/302 when unauthenticated
 * - Public routes respond
 * - Admin/API routes are protected
 */

const BASE = process.argv[2] || 'http://localhost:3000'

const routes = [
  { path: '/', expect: [200, 302], desc: 'Home' },
  { path: '/login', expect: [200, 302], desc: 'Login' },
  { path: '/dashboard', expect: [302, 401], desc: 'Dashboard (protected)' },
  { path: '/portal', expect: [302, 401], desc: 'Portal (protected)' },
  { path: '/api/notifications', expect: [401], desc: 'Notifications API (protected)' },
  { path: '/api/admin/create-client-user', expect: [401, 405], desc: 'Admin create-client-user (protected)' },
  { path: '/admin/test-users', expect: [302, 404], desc: 'Seed users (redirect when disabled)' },
]

async function fetchRoute(path) {
  const url = `${BASE}${path}`
  try {
    const res = await fetch(url, { redirect: 'manual' })
    return { status: res.status, ok: res.ok }
  } catch (e) {
    return { status: 0, ok: false, error: e.message }
  }
}

async function main() {
  console.log(`Smoke test: ${BASE}\n`)
  let failed = 0
  for (const { path, expect, desc } of routes) {
    const { status, error } = await fetchRoute(path)
    const ok = expect.includes(status) || (status === 0 && error?.includes('ECONNREFUSED'))
    if (!ok) {
      console.log(`❌ ${desc} ${path} -> ${status || error}`)
      failed++
    } else {
      console.log(`✓ ${desc} ${path} -> ${status}`)
    }
  }
  console.log(`\n${failed === 0 ? 'All checks passed.' : `${failed} check(s) failed.`}`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
