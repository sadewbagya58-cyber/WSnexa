-- Migration: 20260806090000_create_order_schema.sql
-- Description: Phase 10 Order Database Schema, RLS, Branch Order Counters & Atomic create_guest_order RPC

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_status AS ENUM ('unpaid', 'paid', 'refunded', 'partially_refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'qr_pay', 'pay_at_counter', 'online');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Branch Order Counters Table
CREATE TABLE IF NOT EXISTS public.branch_order_counters (
    branch_id UUID PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
    last_order_number INT NOT NULL DEFAULT 1000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.dining_tables(id) ON DELETE SET NULL,
    order_number INT NOT NULL,
    order_number_formatted TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    status public.order_status NOT NULL DEFAULT 'pending',
    payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
    payment_method public.payment_method NOT NULL DEFAULT 'pay_at_counter',
    guest_name TEXT,
    guest_phone TEXT,
    guest_notes TEXT,
    subtotal_cents INT NOT NULL CHECK (subtotal_cents >= 0),
    tax_cents INT NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
    service_charge_cents INT NOT NULL DEFAULT 0 CHECK (service_charge_cents >= 0),
    total_cents INT NOT NULL CHECK (total_cents >= 0),
    currency TEXT NOT NULL DEFAULT 'LKR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Unique index for idempotency per branch
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_branch_idempotency 
    ON public.orders (branch_id, idempotency_key);

-- Operational indexes
CREATE INDEX IF NOT EXISTS idx_orders_business_branch_status 
    ON public.orders (business_id, branch_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_table_id 
    ON public.orders (table_id);

CREATE INDEX IF NOT EXISTS idx_orders_created_at 
    ON public.orders (created_at DESC);

-- 4. Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id),
    item_name_snapshot TEXT NOT NULL,
    unit_price_cents_snapshot INT NOT NULL CHECK (unit_price_cents_snapshot >= 0),
    quantity INT NOT NULL CHECK (quantity >= 1 AND quantity <= 99),
    line_subtotal_cents INT NOT NULL CHECK (line_subtotal_cents >= 0),
    special_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
    ON public.order_items (order_id);

-- 5. Order Item Modifiers Table
CREATE TABLE IF NOT EXISTS public.order_item_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
    modifier_group_id UUID NOT NULL REFERENCES public.modifier_groups(id),
    modifier_option_id UUID NOT NULL REFERENCES public.modifier_options(id),
    group_name_snapshot TEXT NOT NULL,
    option_name_snapshot TEXT NOT NULL,
    additional_price_cents_snapshot INT NOT NULL CHECK (additional_price_cents_snapshot >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_order_item_id 
    ON public.order_item_modifiers (order_item_id);

-- 6. Order Status History Table
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status public.order_status,
    new_status public.order_status NOT NULL,
    changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id 
    ON public.order_status_history (order_id);

-- 7. Enable RLS
ALTER TABLE public.branch_order_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
-- Authenticated Business Owners & Staff can view orders for their business & active branch
DROP POLICY IF EXISTS "Staff view branch orders" ON public.orders;
CREATE POLICY "Staff view branch orders" ON public.orders
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = public.orders.business_id
              AND bm.is_active = true
              AND (
                  bm.role = 'business_owner'
                  OR bm.branch_id IS NULL
                  OR bm.branch_id = public.orders.branch_id
              )
        )
    );

-- Staff update order status
DROP POLICY IF EXISTS "Staff update branch orders" ON public.orders;
CREATE POLICY "Staff update branch orders" ON public.orders
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = public.orders.business_id
              AND bm.is_active = true
              AND (
                  bm.role IN ('business_owner', 'branch_manager', 'cashier', 'kitchen_staff', 'waiter')
                  AND (bm.branch_id IS NULL OR bm.branch_id = public.orders.branch_id)
              )
        )
    );

-- Order items RLS
DROP POLICY IF EXISTS "Staff view order items" ON public.order_items;
CREATE POLICY "Staff view order items" ON public.order_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_memberships bm
            WHERE bm.user_id = auth.uid()
              AND bm.business_id = public.order_items.business_id
              AND bm.is_active = true
              AND (bm.branch_id IS NULL OR bm.branch_id = public.order_items.branch_id)
        )
    );

-- Order item modifiers RLS
DROP POLICY IF EXISTS "Staff view order item modifiers" ON public.order_item_modifiers;
CREATE POLICY "Staff view order item modifiers" ON public.order_item_modifiers
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.order_items oi
            JOIN public.business_memberships bm ON bm.business_id = oi.business_id
            WHERE oi.id = public.order_item_modifiers.order_item_id
              AND bm.user_id = auth.uid()
              AND bm.is_active = true
              AND (bm.branch_id IS NULL OR bm.branch_id = oi.branch_id)
        )
    );

-- Order status history RLS
DROP POLICY IF EXISTS "Staff view order status history" ON public.order_status_history;
CREATE POLICY "Staff view order status history" ON public.order_status_history
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            JOIN public.business_memberships bm ON bm.business_id = o.business_id
            WHERE o.id = public.order_status_history.order_id
              AND bm.user_id = auth.uid()
              AND bm.is_active = true
              AND (bm.branch_id IS NULL OR bm.branch_id = o.branch_id)
        )
    );

-- 9. Atomic PostgreSQL RPC for Guest Order Creation
CREATE OR REPLACE FUNCTION public.create_guest_order(
    p_raw_qr_token TEXT,
    p_table_id UUID,
    p_input_pin TEXT,
    p_guest_name TEXT,
    p_guest_phone TEXT,
    p_guest_notes TEXT,
    p_idempotency_key TEXT,
    p_cart_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_token_hash TEXT;
    v_qr RECORD;
    v_branch RECORD;
    v_business RECORD;
    v_table RECORD;
    v_existing_order RECORD;
    v_order_num INT;
    v_order_num_formatted TEXT;
    v_new_order_id UUID;
    v_subtotal_cents INT := 0;
    v_tax_cents INT := 0;
    v_service_charge_cents INT := 0;
    v_total_cents INT := 0;
    v_item_elem JSONB;
    v_mod_elem JSONB;
    v_menu_item RECORD;
    v_mod_group RECORD;
    v_mod_opt RECORD;
    v_item_unit_price INT;
    v_item_qty INT;
    v_line_subtotal INT;
    v_new_order_item_id UUID;
    v_items_result JSONB := '[]'::jsonb;
BEGIN
    -- Validation 1: Token Hash Computation
    IF p_raw_qr_token IS NULL OR length(trim(p_raw_qr_token)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_QR_TOKEN');
    END IF;

    v_token_hash := encode(digest(p_raw_qr_token, 'sha256'), 'hex');

    -- Validation 2: Fetch and Validate Active Branch QR
    SELECT * INTO v_qr
    FROM public.branch_qr_codes
    WHERE token_hash = v_token_hash
      AND is_active = true
      AND revoked_at IS NULL;

    IF v_qr.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_OR_REVOKED_QR');
    END IF;

    -- Fetch Branch & Business
    SELECT * INTO v_branch FROM public.branches WHERE id = v_qr.branch_id AND status = 'active' AND deleted_at IS NULL;
    IF v_branch.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'BRANCH_UNAVAILABLE');
    END IF;

    SELECT * INTO v_business FROM public.businesses WHERE id = v_qr.business_id;
    IF v_business.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'BUSINESS_UNAVAILABLE');
    END IF;

    -- Validation 3: Check Idempotency Protection
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        SELECT * INTO v_existing_order
        FROM public.orders
        WHERE branch_id = v_branch.id AND idempotency_key = p_idempotency_key;

        IF v_existing_order.id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'is_duplicate', true,
                'order_id', v_existing_order.id,
                'order_number_formatted', v_existing_order.order_number_formatted,
                'status', v_existing_order.status,
                'total_cents', v_existing_order.total_cents
            );
        END IF;
    END IF;

    -- Validation 4: Table Selection & Table PIN Revalidation
    IF v_branch.require_table_selection = true THEN
        IF p_table_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'TABLE_REQUIRED');
        END IF;

        SELECT * INTO v_table
        FROM public.dining_tables
        WHERE id = p_table_id
          AND business_id = v_business.id
          AND branch_id = v_branch.id
          AND is_active = true
          AND deleted_at IS NULL;

        IF v_table.id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'INVALID_OR_ARCHIVED_TABLE');
        END IF;

        IF v_branch.require_table_pin = true THEN
            IF p_input_pin IS NULL OR length(trim(p_input_pin)) = 0 THEN
                RETURN jsonb_build_object('success', false, 'error', 'PIN_REQUIRED');
            END IF;

            IF v_table.table_pin_hash IS NULL OR v_table.table_pin_hash != encode(digest(trim(p_input_pin), 'sha256'), 'hex') THEN
                RETURN jsonb_build_object('success', false, 'error', 'INVALID_TABLE_PIN');
            END IF;
        END IF;
    END IF;

    -- Validation 5: Validate Cart Payload Non-Empty
    IF p_cart_items IS NULL OR jsonb_array_length(p_cart_items) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'EMPTY_CART');
    END IF;

    -- Step 6: Atomic Order Number Generation per Branch
    INSERT INTO public.branch_order_counters (branch_id, last_order_number)
    VALUES (v_branch.id, 1001)
    ON CONFLICT (branch_id) DO UPDATE
    SET last_order_number = branch_order_counters.last_order_number + 1,
        updated_at = NOW()
    RETURNING last_order_number INTO v_order_num;

    v_order_num_formatted := '#' || COALESCE(v_branch.code, 'ORD') || '-' || v_order_num::TEXT;

    -- Step 7: Create Base Order Header
    INSERT INTO public.orders (
        business_id,
        branch_id,
        table_id,
        order_number,
        order_number_formatted,
        idempotency_key,
        status,
        payment_status,
        payment_method,
        guest_name,
        guest_phone,
        guest_notes,
        subtotal_cents,
        total_cents,
        currency
    ) VALUES (
        v_business.id,
        v_branch.id,
        p_table_id,
        v_order_num,
        v_order_num_formatted,
        COALESCE(p_idempotency_key, gen_random_uuid()::text),
        'pending',
        'unpaid',
        'pay_at_counter',
        nullif(trim(p_guest_name), ''),
        nullif(trim(p_guest_phone), ''),
        nullif(trim(p_guest_notes), ''),
        0,
        0,
        COALESCE(v_branch.currency, v_business.default_currency, 'LKR')
    )
    RETURNING id INTO v_new_order_id;

    -- Step 8: Loop through cart items and revalidate prices & availability against DB
    FOR v_item_elem IN SELECT * FROM jsonb_array_elements(p_cart_items)
    LOOP
        v_item_qty := (v_item_elem->>'quantity')::INT;
        IF v_item_qty < 1 OR v_item_qty > 99 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY';
        END IF;

        -- Fetch menu item directly from DB
        SELECT * INTO v_menu_item
        FROM public.menu_items
        WHERE id = (v_item_elem->>'menuItemId')::UUID
          AND business_id = v_business.id
          AND branch_id = v_branch.id
          AND is_active = true
          AND deleted_at IS NULL;

        IF v_menu_item.id IS NULL THEN
            RAISE EXCEPTION 'ITEM_NOT_FOUND_OR_INACTIVE: %', (v_item_elem->>'menuItemId');
        END IF;

        IF v_menu_item.availability_status != 'available' THEN
            RAISE EXCEPTION 'ITEM_OUT_OF_STOCK: %', v_menu_item.name;
        END IF;

        v_item_unit_price := v_menu_item.price_cents;

        -- Insert order item snapshot
        INSERT INTO public.order_items (
            order_id,
            business_id,
            branch_id,
            menu_item_id,
            item_name_snapshot,
            unit_price_cents_snapshot,
            quantity,
            line_subtotal_cents,
            special_instructions
        ) VALUES (
            v_new_order_id,
            v_business.id,
            v_branch.id,
            v_menu_item.id,
            v_menu_item.name,
            v_item_unit_price,
            v_item_qty,
            0, -- Will calculate with modifiers
            nullif(trim(v_item_elem->>'specialInstructions'), '')
        )
        RETURNING id INTO v_new_order_item_id;

        v_line_subtotal := v_item_unit_price;

        -- Revalidate selected modifiers if present
        IF v_item_elem->'selectedModifiers' IS NOT NULL AND jsonb_array_length(v_item_elem->'selectedModifiers') > 0 THEN
            FOR v_mod_elem IN SELECT * FROM jsonb_array_elements(v_item_elem->'selectedModifiers')
            LOOP
                SELECT * INTO v_mod_opt
                FROM public.modifier_options
                WHERE id = (v_mod_elem->>'optionId')::UUID
                  AND business_id = v_business.id
                  AND branch_id = v_branch.id
                  AND is_active = true
                  AND deleted_at IS NULL;

                IF v_mod_opt.id IS NULL THEN
                    RAISE EXCEPTION 'MODIFIER_OPTION_UNAVAILABLE: %', (v_mod_elem->>'optionId');
                END IF;

                SELECT * INTO v_mod_group
                FROM public.modifier_groups
                WHERE id = v_mod_opt.modifier_group_id
                  AND business_id = v_business.id
                  AND branch_id = v_branch.id
                  AND is_active = true
                  AND deleted_at IS NULL;

                IF v_mod_group.id IS NULL THEN
                    RAISE EXCEPTION 'MODIFIER_GROUP_UNAVAILABLE: %', v_mod_opt.modifier_group_id;
                END IF;

                -- Record modifier snapshot
                INSERT INTO public.order_item_modifiers (
                    order_item_id,
                    modifier_group_id,
                    modifier_option_id,
                    group_name_snapshot,
                    option_name_snapshot,
                    additional_price_cents_snapshot
                ) VALUES (
                    v_new_order_item_id,
                    v_mod_group.id,
                    v_mod_opt.id,
                    v_mod_group.name,
                    v_mod_opt.name,
                    v_mod_opt.additional_price_cents
                );

                v_line_subtotal := v_line_subtotal + v_mod_opt.additional_price_cents;
            END LOOP;
        END IF;

        -- Finalize line subtotal
        v_line_subtotal := v_line_subtotal * v_item_qty;

        UPDATE public.order_items
        SET line_subtotal_cents = v_line_subtotal
        WHERE id = v_new_order_item_id;

        v_subtotal_cents := v_subtotal_cents + v_line_subtotal;
    END LOOP;

    -- Calculate Totals
    v_total_cents := v_subtotal_cents + v_tax_cents + v_service_charge_cents;

    -- Update Order Header Totals
    UPDATE public.orders
    SET subtotal_cents = v_subtotal_cents,
        total_cents = v_total_cents
    WHERE id = v_new_order_id;

    -- Create Initial Status History Record
    INSERT INTO public.order_status_history (
        order_id,
        previous_status,
        new_status,
        notes
    ) VALUES (
        v_new_order_id,
        NULL,
        'pending',
        'Order created by guest via Branch QR'
    );

    -- Create Audit Log
    INSERT INTO public.audit_logs (
        business_id,
        action,
        target_type,
        target_id,
        payload
    ) VALUES (
        v_business.id,
        'order.created',
        'order',
        v_new_order_id,
        jsonb_build_object(
            'order_number', v_order_num_formatted,
            'branch_id', v_branch.id,
            'table_id', p_table_id,
            'total_cents', v_total_cents
        )
    );

    -- Return Order JSON Payload
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_new_order_id,
        'order_number', v_order_num,
        'order_number_formatted', v_order_num_formatted,
        'status', 'pending',
        'subtotal_cents', v_subtotal_cents,
        'total_cents', v_total_cents,
        'currency', COALESCE(v_branch.currency, v_business.default_currency, 'LKR')
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

-- Grant EXECUTE on create_guest_order to anon & authenticated
GRANT EXECUTE ON FUNCTION public.create_guest_order TO anon, authenticated, service_role;
