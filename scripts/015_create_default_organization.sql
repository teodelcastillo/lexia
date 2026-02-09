-- =============================================================================
-- Migration 015: Create Default Organization
-- =============================================================================
-- Creates a default organization and assigns all existing users to it
-- Run this AFTER creating users/profiles
-- =============================================================================

BEGIN;

-- Create default organization
INSERT INTO public.organizations (
  id,
  name,
  slug,
  legal_name,
  subscription_tier,
  subscription_status,
  is_active,
  created_at
)
VALUES (
  gen_random_uuid(),
  'Estudio Legal Principal',
  'default',
  'Estudio Legal Principal',
  'trial',
  'active',
  true,
  NOW()
)
ON CONFLICT (slug) DO NOTHING
RETURNING id;

-- Update all existing profiles to belong to default organization
-- Only update profiles that don't have an organization_id yet
UPDATE public.profiles
SET organization_id = (
  SELECT id FROM public.organizations WHERE slug = 'default' LIMIT 1
)
WHERE organization_id IS NULL;

-- Make organization_id NOT NULL in profiles (after migration)
-- Uncomment this line after verifying all profiles have organization_id:
-- ALTER TABLE public.profiles ALTER COLUMN organization_id SET NOT NULL;

COMMIT;
