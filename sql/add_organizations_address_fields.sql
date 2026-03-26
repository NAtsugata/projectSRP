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

-- Create index for demo organizations (useful for queries)
CREATE INDEX IF NOT EXISTS idx_organizations_is_demo ON public.organizations(is_demo);

-- Verification
SELECT 'SUCCESS - Added postal_code, city, and is_demo columns to organizations table' as result;
