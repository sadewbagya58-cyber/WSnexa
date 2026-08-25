-- Description: Phase 35 Step 4 Closure Migration — Outbox, Decline Metadata, RLS Hardening

-- 1. Add declined_at and decline_reason columns to public.reservations
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ NULL;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS decline_reason TEXT NULL;

-- 2. Create provider-neutral reservation_notification_outbox table
CREATE TABLE IF NOT EXISTS public.reservation_notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  reservation_id UUID NULL REFERENCES public.reservations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  recipient_name TEXT NULL,
  recipient_email TEXT NULL,
  recipient_phone TEXT NULL,
  consent_promotional BOOLEAN NOT NULL DEFAULT false,
  channel_eligibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED')),
  processed_at TIMESTAMPTZ NULL,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for notification outbox
CREATE INDEX IF NOT EXISTS idx_res_notif_outbox_bus_branch ON public.reservation_notification_outbox(business_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_res_notif_outbox_res_id ON public.reservation_notification_outbox(reservation_id);
CREATE INDEX IF NOT EXISTS idx_res_notif_outbox_created_at ON public.reservation_notification_outbox(created_at);

-- 3. Security & RLS Policies (Server-Authoritative Pattern)
ALTER TABLE public.reservation_notification_outbox ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reservation_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.reservation_notification_outbox TO service_role;
