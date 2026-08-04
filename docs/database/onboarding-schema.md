# WSNexa — Onboarding & Operating Hours Database Schema

> **Version:** 1.0.0 (Phase 4)  

---

## 1. Tables

### `public.branch_operating_hours`
- `id` (UUID, Primary Key)
- `branch_id` (UUID, Foreign Key -> `public.branches.id` ON DELETE CASCADE)
- `day_of_week` (SMALLINT, 0=Sun..6=Sat, CHECK BETWEEN 0 AND 6)
- `is_closed` (BOOLEAN, DEFAULT FALSE)
- `opens_at` (TIME, DEFAULT '08:00:00')
- `closes_at` (TIME, DEFAULT '22:00:00')
- `created_at`, `updated_at`
- **Constraint:** `UNIQUE(branch_id, day_of_week)`

### `public.onboarding_drafts`
- `id` (UUID, Primary Key)
- `user_id` (UUID, UNIQUE, Foreign Key -> `auth.users.id` ON DELETE CASCADE)
- `current_step` (TEXT, DEFAULT 'business')
- `payload` (JSONB, DEFAULT '{}')
- `created_at`, `updated_at`, `expires_at`

### Extended `public.businesses` Columns
- `description` (TEXT)
- `logo_url` (TEXT)
- `email` (TEXT)
- `phone` (TEXT)
- `website` (TEXT)
