-- Migration: 20260812020000_phase21_2_table_area_uniqueness.sql
-- Description: Replace branch-wide table number & code unique constraints with Area-Scoped Partial Unique Indexes
-- Audit & Safety: 100% additive and safe for existing tables. Preserves legacy unassigned tables uniqueness.

-- 1. Drop old branch-scoped unique indexes
DROP INDEX IF EXISTS public.idx_unique_active_table_number;
DROP INDEX IF EXISTS public.idx_unique_active_table_code;

-- 2. Create Area-Scoped Unique Indexes for tables with service_area_id IS NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_table_number_area
  ON public.dining_tables (branch_id, service_area_id, table_number)
  WHERE deleted_at IS NULL AND table_number IS NOT NULL AND service_area_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_table_code_area
  ON public.dining_tables (branch_id, service_area_id, code)
  WHERE deleted_at IS NULL AND service_area_id IS NOT NULL;

-- 3. Create Fallback Unique Indexes for legacy unassigned tables where service_area_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_table_number_null_area
  ON public.dining_tables (branch_id, table_number)
  WHERE deleted_at IS NULL AND table_number IS NOT NULL AND service_area_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_table_code_null_area
  ON public.dining_tables (branch_id, code)
  WHERE deleted_at IS NULL AND service_area_id IS NULL;
