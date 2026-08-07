'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { generateTablePin, hashTablePin } from '@/lib/qr/security';
import { createSignedTableAccessProof } from '@/lib/qr/table-access-proof';
import {
  createServiceAreaSchema,
  updateServiceAreaSchema,
  createDiningTableSchema,
  updateDiningTableSchema,
  bulkCreateDiningTablesSchema,
  CreateServiceAreaInput,
  UpdateServiceAreaInput,
  CreateDiningTableInput,
  UpdateDiningTableInput,
  BulkCreateDiningTablesInput,
} from '@/lib/validation/table';
import { ActionResponse } from './auth';

import { PermissionService } from '@/server/services/permission.service';

/**
 * Creates a new service area for the active business & default branch.
 */
export async function createServiceAreaAction(
  formData: CreateServiceAreaInput
): Promise<ActionResponse<{ areaId: string }>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or branch context not found.' };
  }

  const canManage = await PermissionService.hasPermission(
    context.user.id,
    context.business.id,
    context.activeBranch.id,
    'tables.manage'
  );
  if (!canManage) {
    return { success: false, message: 'Forbidden. Missing required tables.manage permission.' };
  }

  const parsed = createServiceAreaSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, code, description, displayOrder, isActive } = parsed.data;
  const supabase = await createClient();

  const { data: area, error } = await supabase
    .from('service_areas')
    .insert({
      business_id: context.business.id,
      branch_id: context.activeBranch.id,
      name,
      code,
      description: description || null,
      display_order: displayOrder,
      is_active: isActive,
    })
    .select()
    .single();

  if (error || !area) {
    return { success: false, message: error?.message || 'Failed to create service area.' };
  }

  // Audit Log
  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'table.area_created',
    target_type: 'service_area',
    target_id: area.id,
    payload: { name, code, branch_id: context.activeBranch.id },
  });

  revalidatePath('/dashboard/tables');
  revalidatePath('/dashboard/tables/areas');
  return {
    success: true,
    message: 'Service area created successfully!',
    data: { areaId: area.id },
  };
}

/**
 * Updates an existing service area.
 */
export async function updateServiceAreaAction(
  formData: UpdateServiceAreaInput
): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) return { success: false, message: 'Unauthorized.' };

  const parsed = updateServiceAreaSchema.safeParse(formData);
  if (!parsed.success) return { success: false, message: 'Validation failed.' };

  const { id, ...rest } = parsed.data;
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (rest.name !== undefined) updateData.name = rest.name;
  if (rest.code !== undefined) updateData.code = rest.code;
  if (rest.description !== undefined) updateData.description = rest.description || null;
  if (rest.displayOrder !== undefined) updateData.display_order = rest.displayOrder;
  if (rest.isActive !== undefined) updateData.is_active = rest.isActive;

  const { error } = await supabase
    .from('service_areas')
    .update(updateData)
    .eq('id', id)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id);

  if (error) return { success: false, message: error.message };

  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'table.area_updated',
    target_type: 'service_area',
    target_id: id,
  });

  revalidatePath('/dashboard/tables');
  revalidatePath('/dashboard/tables/areas');
  return { success: true, message: 'Service area updated.' };
}

/**
 * Archives (soft deletes) a service area. Safely blocked by trigger if active tables exist.
 */
export async function archiveServiceAreaAction(areaId: string): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) return { success: false, message: 'Unauthorized.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('service_areas')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', areaId)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id);

  if (error) return { success: false, message: error.message };

  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'table.area_archived',
    target_type: 'service_area',
    target_id: areaId,
  });

  revalidatePath('/dashboard/tables');
  revalidatePath('/dashboard/tables/areas');
  return { success: true, message: 'Service area archived.' };
}

/**
 * Creates a single dining table under a active service area.
 */
export async function createDiningTableAction(
  formData: CreateDiningTableInput
): Promise<ActionResponse<{ tableId: string }>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or branch context not found.' };
  }

  const { role } = context.membership;
  if (role !== 'business_owner' && role !== 'branch_manager') {
    return { success: false, message: 'Forbidden. Owner or Branch Manager role required.' };
  }

  const parsed = createDiningTableSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { serviceAreaId, name, code, tableNumber, capacity, status, shape, displayOrder, isActive } =
    parsed.data;

  const supabase = await createClient();

  // Verify area belongs to active business & branch and is active
  const { data: area } = await supabase
    .from('service_areas')
    .select('id, deleted_at')
    .eq('id', serviceAreaId)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id)
    .single();

  if (!area || area.deleted_at !== null) {
    return { success: false, message: 'Invalid or archived service area.' };
  }

  const { data: table, error } = await supabase
    .from('dining_tables')
    .insert({
      business_id: context.business.id,
      branch_id: context.activeBranch.id,
      service_area_id: serviceAreaId,
      name,
      code,
      table_number: tableNumber || null,
      capacity,
      status,
      shape,
      display_order: displayOrder,
      is_active: isActive,
    })
    .select()
    .single();

  if (error || !table) {
    return { success: false, message: error?.message || 'Failed to create dining table.' };
  }

  // Audit Log
  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'table.created',
    target_type: 'dining_table',
    target_id: table.id,
    payload: { name, code, capacity, service_area_id: serviceAreaId },
  });

  revalidatePath('/dashboard/tables');
  return {
    success: true,
    message: 'Dining table created successfully!',
    data: { tableId: table.id },
  };
}

/**
 * Updates an existing dining table.
 */
export async function updateDiningTableAction(
  formData: UpdateDiningTableInput
): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) return { success: false, message: 'Unauthorized.' };

  const parsed = updateDiningTableSchema.safeParse(formData);
  if (!parsed.success) return { success: false, message: 'Validation failed.' };

  const { id, ...rest } = parsed.data;
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (rest.name !== undefined) updateData.name = rest.name;
  if (rest.code !== undefined) updateData.code = rest.code;
  if (rest.tableNumber !== undefined) updateData.table_number = rest.tableNumber || null;
  if (rest.capacity !== undefined) updateData.capacity = rest.capacity;
  if (rest.status !== undefined) updateData.status = rest.status;
  if (rest.shape !== undefined) updateData.shape = rest.shape;
  if (rest.serviceAreaId !== undefined) updateData.service_area_id = rest.serviceAreaId;
  if (rest.displayOrder !== undefined) updateData.display_order = rest.displayOrder;
  if (rest.isActive !== undefined) updateData.is_active = rest.isActive;

  const { error } = await supabase
    .from('dining_tables')
    .update(updateData)
    .eq('id', id)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id);

  if (error) return { success: false, message: error.message };

  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'table.updated',
    target_type: 'dining_table',
    target_id: id,
  });

  revalidatePath('/dashboard/tables');
  return { success: true, message: 'Dining table updated.' };
}

/**
 * Updates table status (e.g. available, occupied, reserved, cleaning, unavailable).
 */
export async function updateDiningTableStatusAction(
  tableId: string,
  status: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'unavailable'
): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) return { success: false, message: 'Unauthorized.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('dining_tables')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', tableId)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id);

  if (error) return { success: false, message: error.message };

  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'table.status_changed',
    target_type: 'dining_table',
    target_id: tableId,
    payload: { status },
  });

  revalidatePath('/dashboard/tables');
  return { success: true, message: `Table status updated to ${status}.` };
}

/**
 * Archives (soft deletes) a dining table.
 */
export async function archiveDiningTableAction(tableId: string): Promise<ActionResponse> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) return { success: false, message: 'Unauthorized.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('dining_tables')
    .update({ deleted_at: new Date().toISOString(), is_active: false, status: 'unavailable' })
    .eq('id', tableId)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id);

  if (error) return { success: false, message: error.message };

  await supabase.from('audit_logs').insert({
    business_id: context.business.id,
    action: 'table.archived',
    target_type: 'dining_table',
    target_id: tableId,
  });

  revalidatePath('/dashboard/tables');
  return { success: true, message: 'Dining table archived.' };
}

/**
 * Executes atomic bulk table creation via PostgreSQL RPC.
 */
export async function bulkCreateDiningTablesAction(
  formData: BulkCreateDiningTablesInput
): Promise<ActionResponse<{ count: number }>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or branch context not found.' };
  }

  const { role } = context.membership;
  if (role !== 'business_owner' && role !== 'branch_manager') {
    return { success: false, message: 'Forbidden. Owner or Branch Manager role required.' };
  }

  const parsed = bulkCreateDiningTablesSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: 'Validation failed.',
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { serviceAreaId, prefix, startNumber, count, capacity, shape } = parsed.data;
  const supabase = await createClient();

  const { data: rpcRes, error } = await supabase.rpc('bulk_create_dining_tables', {
    p_business_id: context.business.id,
    p_branch_id: context.activeBranch.id,
    p_service_area_id: serviceAreaId,
    p_prefix: prefix,
    p_start_number: startNumber,
    p_count: count,
    p_capacity: capacity,
    p_shape: shape,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  const res = rpcRes as { success: boolean; count: number; message: string };
  if (!res.success) {
    return { success: false, message: res.message || 'Bulk creation failed.' };
  }

  revalidatePath('/dashboard/tables');
  return {
    success: true,
    message: `${res.count} dining tables generated successfully!`,
    data: { count: res.count },
  };
}

/**
 * Generates a random Table PIN for a dining table.
 * Returns the plain PIN ONCE in memory for immediate display/copy/print sticker.
 */
export async function generateTablePinAction(tableId: string): Promise<ActionResponse<{ plainPin: string }>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized or branch context not found.' };
  }

  const { role } = context.membership;
  if (role !== 'business_owner' && role !== 'branch_manager') {
    return { success: false, message: 'Forbidden: Owner or Branch Manager role required.' };
  }

  const pinLength = context.activeBranch.table_pin_length || 4;
  const plainPin = generateTablePin(pinLength);
  const pinHash = hashTablePin(plainPin);

  const supabase = await createClient();

  const { error } = await supabase
    .from('dining_tables')
    .update({
      table_pin_hash: pinHash,
      table_pin_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tableId)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/dashboard/tables');
  return {
    success: true,
    message: 'Table PIN generated successfully!',
    data: { plainPin },
  };
}

/**
 * Sets a custom Table PIN for a dining table.
 */
export async function updateTablePinAction(
  tableId: string,
  customPin: string
): Promise<ActionResponse<{ plainPin: string }>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized.' };
  }

  const { role } = context.membership;
  if (role !== 'business_owner' && role !== 'branch_manager') {
    return { success: false, message: 'Forbidden: Owner or Branch Manager role required.' };
  }

  const pinLength = context.activeBranch.table_pin_length || 4;
  const trimmed = customPin.trim();

  if (!/^\d+$/.test(trimmed) || trimmed.length !== pinLength) {
    return { success: false, message: `PIN must contain exactly ${pinLength} digits.` };
  }

  const pinHash = hashTablePin(trimmed);
  const supabase = await createClient();

  const { error } = await supabase
    .from('dining_tables')
    .update({
      table_pin_hash: pinHash,
      table_pin_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tableId)
    .eq('business_id', context.business.id)
    .eq('branch_id', context.activeBranch.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/dashboard/tables');
  return {
    success: true,
    message: 'Table PIN updated successfully!',
    data: { plainPin: trimmed },
  };
}

/**
 * Bulk generates PINs for missing or all tables in the branch.
 */
export async function bulkGenerateBranchTablePinsAction(onlyMissing: boolean = true): Promise<ActionResponse<{ count: number }>> {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return { success: false, message: 'Unauthorized.' };
  }

  const { role } = context.membership;
  if (role !== 'business_owner' && role !== 'branch_manager') {
    return { success: false, message: 'Forbidden: Owner or Branch Manager role required.' };
  }

  const supabase = await createClient();
  const branchId = context.activeBranch.id;
  const pinLength = context.activeBranch.table_pin_length || 4;

  let query = supabase
    .from('dining_tables')
    .select('id, table_pin_hash')
    .eq('business_id', context.business.id)
    .eq('branch_id', branchId)
    .eq('is_active', true)
    .is('deleted_at', null);

  if (onlyMissing) {
    query = query.is('table_pin_hash', null);
  }

  const { data: tables, error: fetchErr } = await query;
  if (fetchErr || !tables) {
    return { success: false, message: fetchErr?.message || 'Failed to fetch tables' };
  }

  let count = 0;
  for (const table of tables) {
    const plainPin = generateTablePin(pinLength);
    const pinHash = hashTablePin(plainPin);

    await supabase
      .from('dining_tables')
      .update({
        table_pin_hash: pinHash,
        table_pin_updated_at: new Date().toISOString(),
      })
      .eq('id', table.id);

    count++;
  }

  revalidatePath('/dashboard/tables');
  revalidatePath('/dashboard/tables/qr');
  return {
    success: true,
    message: `Generated PINs for ${count} table(s).`,
    data: { count },
  };
}

/**
 * Validates table selection and PIN access during guest checkout.
 */
export async function verifyTableAccessAction(
  branchId: string,
  tableId: string,
  inputPin?: string
): Promise<
  ActionResponse<{
    table?: { id: string; name: string; code: string; table_number: number | null; capacity: number };
    signedTableAccessProof?: string;
    verifiedAt?: string;
    expiresAt?: string;
  }>
> {
  const supabase = await createClient();

  const pinHash = inputPin ? hashTablePin(inputPin.trim()) : null;

  const { data, error } = await supabase.rpc('verify_table_checkout_access', {
    p_branch_id: branchId,
    p_table_id: tableId,
    p_pin_hash: pinHash,
  });

  if (error || !data) {
    return { success: false, message: error?.message || 'Table verification failed.' };
  }

  const payload = data as {
    success: boolean;
    error?: string;
    table?: { id: string; name: string; code: string; table_number: number | null; capacity: number };
    bypass_table?: boolean;
  };

  if (!payload.success) {
    if (payload.error === 'INVALID_PIN') {
      return { success: false, message: 'Invalid Table PIN. Please check the 4-digit PIN on your table.' };
    }
    if (payload.error === 'PIN_NOT_CONFIGURED') {
      return { success: false, message: 'Table PIN is required but has not been set up yet. Please ask your server.' };
    }
    return { success: false, message: 'Selected dining table is unavailable or archived.' };
  }

  console.log('[verifyTableAccessAction] Request:', { branchId, tableId, inputPinProvided: Boolean(inputPin) });

  // Generate signed table access proof for secure order submission without persisting raw PIN
  const proofData = payload.table
    ? createSignedTableAccessProof(branchId, payload.table.id)
    : undefined;

  console.log('[verifyTableAccessAction] Generated Proof:', {
    tableId: payload.table?.id,
    branchId,
    proofGenerated: Boolean(proofData?.proof),
  });

  return {
    success: true,
    message: 'Table verified successfully.',
    data: {
      table: payload.table,
      signedTableAccessProof: proofData?.proof,
      verifiedAt: proofData?.verifiedAt,
      expiresAt: proofData?.expiresAt,
    },
  };
}
