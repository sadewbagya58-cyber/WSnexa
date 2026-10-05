-- Migration: 20261005100000_sync_missing_permission_seed.sql
-- Description: Sync missing audit.view permission seed to match canonical catalog

INSERT INTO public.permissions (id, key, name, description, category, risk_level)
VALUES (
  'a0000000-0000-0000-0000-000000000157',
  'audit.view',
  'View Audit Logs',
  'View system, security, and operational audit logs',
  'Organization & Structure',
  'medium'
)
ON CONFLICT (id) DO NOTHING;
