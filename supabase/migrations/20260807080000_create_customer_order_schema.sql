-- Migration: 20260807080000_create_customer_order_schema.sql
-- Description: Phase 16 Additive Customer Order Association, Indexing & Customer RLS Policies
-- Audit & Safety: Fully additive, non-breaking for anonymous guest orders (customer_user_id defaults to NULL).

-- 1. Add customer_user_id column to orders table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'customer_user_id'
  ) THEN
    ALTER TABLE public.orders
      ADD COLUMN customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Create index for fast customer order history queries
CREATE INDEX IF NOT EXISTS idx_orders_customer_user_created 
  ON public.orders (customer_user_id, created_at DESC) 
  WHERE customer_user_id IS NOT NULL;

-- 3. Customer RLS Policies

-- Customer Select Orders Policy: Logged-in customer can read orders associated with their auth.uid()
DROP POLICY IF EXISTS "Customer select claimed orders" ON public.orders;
CREATE POLICY "Customer select claimed orders"
  ON public.orders FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = customer_user_id);

-- Customer Select Order Items Policy: Logged-in customer can read order items for their claimed orders
DROP POLICY IF EXISTS "Customer select claimed order items" ON public.order_items;
CREATE POLICY "Customer select claimed order items"
  ON public.order_items FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_user_id = auth.uid()
    )
  );

-- Customer Select Order Item Modifiers Policy: Logged-in customer can read modifiers for their claimed order items
DROP POLICY IF EXISTS "Customer select claimed order item modifiers" ON public.order_item_modifiers;
CREATE POLICY "Customer select claimed order item modifiers"
  ON public.order_item_modifiers FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_modifiers.order_item_id
        AND o.customer_user_id = auth.uid()
    )
  );

-- Customer Select Order Status History Policy: Logged-in customer can read status history for their claimed orders
DROP POLICY IF EXISTS "Customer select claimed order status history" ON public.order_status_history;
CREATE POLICY "Customer select claimed order status history"
  ON public.order_status_history FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_status_history.order_id
        AND o.customer_user_id = auth.uid()
    )
  );

-- Customer Select Payments Policy: Logged-in customer can read payments/receipts for their claimed orders
DROP POLICY IF EXISTS "Customer select claimed payments" ON public.payments;
CREATE POLICY "Customer select claimed payments"
  ON public.payments FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND o.customer_user_id = auth.uid()
    )
  );
