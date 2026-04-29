-- ============================================================
-- Add address-related fields to organizations table
-- ============================================================
-- Adds postal_code, city, and is_demo columns to organizations
-- These are needed for proper organization address management
-- and demo mode support
-- ============================================================

-- Add postal_code column
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Add city column
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS city TEXT;

-- Add is_demo flag for demo organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- Add demo_last_reset timestamp for tracking demo data resets
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS demo_last_reset TIMESTAMP WITH TIME ZONE;

-- Create index for demo organizations (useful for queries)
CREATE INDEX IF NOT EXISTS idx_organizations_is_demo ON public.organizations(is_demo);

-- Verification
SELECT 'SUCCESS - Added postal_code, city, is_demo, and demo_last_reset columns to organizations table' as result;
