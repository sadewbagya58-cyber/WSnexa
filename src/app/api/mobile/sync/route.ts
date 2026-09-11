import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { createWaiterOrderAction, CreateWaiterOrderInput } from '@/server/actions/waiter-order';

// Invariant: Operations that MUST NEVER be accepted via offline sync queue
const FORBIDDEN_SYNC_ACTIONS = new Set([
  'payment',
  'process_payment',
  'refund',
  'settlement',
  'close_register',
  'subscription_upgrade',
  'subscription_checkout',
  'cancel_order',
  'cancel_item',
  'invite_staff',
  'modify_rbac',
  'publish_venue',
]);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    // Resolve Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // No-op for API route
        },
      },
    });

    // Determine user
    let user = null;
    if (bearerToken) {
      const { data, error } = await supabase.auth.getUser(bearerToken);
      if (!error && data.user) {
        user = data.user;
      }
    }

    if (!user) {
      const { data } = await supabase.auth.getUser();
      user = data.user;
    }

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const body = await request.json();
    const {
      operation_id,
      entity_type,
      entity_id,
      action,
      payload,
      branch_id,
      business_id,
    } = body;

    if (!operation_id || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required sync fields (operation_id, action).' },
        { status: 400 }
      );
    }

    // 1. Invariant enforcement: Reject forbidden offline operations
    const normalizedAction = action.toLowerCase().trim();
    if (FORBIDDEN_SYNC_ACTIONS.has(normalizedAction)) {
      return NextResponse.json(
        {
          success: false,
          error: `Action "${action}" is strictly online-only and cannot be synchronized via offline queue.`,
        },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // 2. Tenant & Branch Isolation Check
    const { data: membership } = await admin
      .from('business_memberships')
      .select('role, membership_status')
      .eq('user_id', user.id)
      .eq('business_id', business_id)
      .eq('membership_status', 'active')
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { success: false, error: 'Tenant isolation violation: user does not belong to this business.' },
        { status: 403 }
      );
    }

    // 3. Idempotency Check: Verify if operation_id was already executed
    const { data: existingAudit } = await admin
      .from('audit_logs')
      .select('id, action, created_at')
      .eq('business_id', business_id)
      .eq('action', `mobile_sync:${action}`)
      .contains('metadata', { operation_id })
      .maybeSingle();

    if (existingAudit) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Mutation was previously synchronized and applied.',
        operation_id,
        processed_at: existingAudit.created_at,
      });
    }

    // 4. Authoritative Server Dispatch
    let dispatchResult: { success: boolean; message?: string; data?: unknown } = {
      success: true,
    };

    if (normalizedAction === 'submit_waiter_order' || normalizedAction === 'create_order') {
      const orderInput = payload as CreateWaiterOrderInput;
      dispatchResult = await createWaiterOrderAction(orderInput);
    } else if (normalizedAction === 'update_table_status' || entity_type === 'table_status') {
      const { status } = payload as { status: string };
      const { error: updateErr } = await admin
        .from('dining_tables')
        .update({
          status: status || 'available',
          updated_at: new Date().toISOString(),
        })
        .eq('id', entity_id)
        .eq('business_id', business_id)
        .eq('branch_id', branch_id);

      if (updateErr) {
        dispatchResult = { success: false, message: updateErr.message };
      }
    } else if (normalizedAction === 'record_inventory_count' || entity_type === 'inventory_count') {
      // Record count note in audit
      dispatchResult = { success: true, data: { recorded: true } };
    } else {
      // Generic accepted operational event
      dispatchResult = { success: true, data: { action, entity_id } };
    }

    if (!dispatchResult.success) {
      return NextResponse.json(
        { success: false, error: dispatchResult.message || 'Operation failed on server.' },
        { status: 400 }
      );
    }

    // 5. Record Idempotency Audit Log
    await admin.from('audit_logs').insert({
      business_id,
      user_id: user.id,
      action: `mobile_sync:${action}`,
      entity_type: entity_type || 'operational',
      entity_id: entity_id || operation_id,
      metadata: {
        operation_id,
        branch_id,
        client_timestamp: body.client_timestamp,
        sync_received_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      operation_id,
      data: dispatchResult.data,
      synced_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    console.error('[API /api/mobile/sync] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error.' },
      { status: 500 }
    );
  }
}
