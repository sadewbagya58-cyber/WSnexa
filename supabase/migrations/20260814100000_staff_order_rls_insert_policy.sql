-- Phase 25.4 — Staff Waiter Order RLS Insert Policies
-- Ensures public.orders, public.order_items, and public.order_item_modifiers
-- have explicit staff INSERT RLS policies while keeping multi-tenant branch isolation enforced.

-- 1. Staff INSERT policy on public.orders
DROP POLICY IF EXISTS "Staff insert orders" ON public.orders;
CREATE POLICY "Staff insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    public.auth_has_branch_access(branch_id)
    AND created_by_user_id = auth.uid()
  );

-- 2. Staff INSERT policy on public.order_items
DROP POLICY IF EXISTS "Staff insert order items" ON public.order_items;
CREATE POLICY "Staff insert order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND public.auth_has_branch_access(o.branch_id)
    )
  );

-- 3. Staff INSERT policy on public.order_item_modifiers
DROP POLICY IF EXISTS "Staff insert order item modifiers" ON public.order_item_modifiers;
CREATE POLICY "Staff insert order item modifiers"
  ON public.order_item_modifiers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.id = order_item_modifiers.order_item_id
        AND public.auth_has_branch_access(o.branch_id)
    )
  );
