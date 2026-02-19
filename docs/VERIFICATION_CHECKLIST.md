# Phase 5: Verification Checklist (Hardening Crítico)

Use this checklist before and after each deployment stage.

## Pre-deploy

- [ ] `SEED_USERS_ENABLED` is **not** set (or `false`) in production
- [ ] `VIEW_AS_ENABLED` is set only when org isolation has been verified
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set for admin operations
- [ ] Run smoke test: `node scripts/smoke-test.mjs https://your-app.vercel.app`

## Manual tests by role

### admin_general

- [ ] Can create team members (invitation flow)
- [ ] Can create client users (with valid company in same org)
- [ ] Can list clients filtered by organization
- [ ] View-as only shows clients from same organization
- [ ] Cannot access clients from other organizations via view-as

### case_leader / lawyer_executive

- [ ] Cannot create users (no admin actions)
- [ ] Cannot use view-as
- [ ] Can access assigned cases and portal data

### client

- [ ] Cannot access admin routes
- [ ] Cannot access other clients' data
- [ ] Portal shows only own data

## Negative authorization tests

- [ ] **Cross-tenant**: Admin of org A cannot view-as client from org B (manually set cookie `view_as_client=<org_b_client_id>` and verify no data leak)
- [ ] **Privilege escalation**: Client cannot call `/api/admin/create-client-user`
- [ ] **Cookie manipulation**: Invalid or cross-org `view_as_client` cookie is ignored

## Critical routes smoke test

```bash
node scripts/smoke-test.mjs http://localhost:3000
```

- [ ] Auth routes return 401/302 when unauthenticated
- [ ] Admin API returns 401 when unauthenticated
- [ ] Seed users page redirects when disabled (production)

## Post-deploy

- [ ] Review logs for auth/admin errors
- [ ] Verify no `auth.admin.*` calls from anon client (only service_role)
- [ ] Confirm build passes without `ignoreBuildErrors`
