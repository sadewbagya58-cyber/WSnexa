-- Migration: 20260818040000_phase29_permissions_catalog.sql
-- Description: Phase 29 Step 1 — Organization & People Permissions Catalog

-- 1. Seed Permissions Catalog with Phase 29 Keys
INSERT INTO public.permissions (key, name, description, category, risk_level) VALUES
  ('organization.view', 'View Organization Structure', 'View departments, units, job titles, and positions', 'Organization & Structure', 'low'),
  ('organization.manage', 'Manage Organization Structure', 'Create, edit, or archive departments, units, job titles, and hierarchy levels', 'Organization & Structure', 'high'),
  ('people.view', 'View People & Assignments', 'View staff organizational assignments and reporting structures', 'People & Positions', 'low'),
  ('people.manage', 'Manage Staff Assignments', 'Assign staff to departments, units, job titles, and positions', 'People & Positions', 'high'),
  ('positions.manage', 'Manage Organizational Positions', 'Create, edit, or archive positions and headcount limits', 'People & Positions', 'medium')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  risk_level = EXCLUDED.risk_level;

-- 2. Grant permissions to built-in branch_manager role template
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('branch_manager', 'organization.view'),
  ('branch_manager', 'organization.manage'),
  ('branch_manager', 'people.view'),
  ('branch_manager', 'people.manage'),
  ('branch_manager', 'positions.manage')
ON CONFLICT DO NOTHING;
