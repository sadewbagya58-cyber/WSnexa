import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { ResourceScope, ResolveResourceScopeOptions } from '@/types/authorization.types';
import { AuthorizationContextError } from './errors';

/**
 * Resolves the trusted organizational scope targets of a domain resource from database relationships.
 *
 * Golden Rule:
 * The client is NEVER trusted for resource ownership, tenant boundary, or branch association.
 * Organizational targets (businessId, branchId, departmentId, organizationUnitId, serviceAreaId, ownerUserId)
 * are derived exclusively by querying the database.
 */
export async function resolveResourceScope(
  options: ResolveResourceScopeOptions
): Promise<ResourceScope> {
  const { resourceType, resourceId, expectedBusinessId } = options;

  if (!resourceId) {
    throw new AuthorizationContextError('RESOURCE_NOT_FOUND', 'Missing resource ID for scope resolution.');
  }

  const admin = createAdminClient();

  let scope: ResourceScope | null = null;

  switch (resourceType) {
    case 'order': {
      const { data, error } = await admin
        .from('orders')
        .select('id, business_id, branch_id, table_id, customer_user_id')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Order not found: ${resourceId}`);
      }

      let serviceAreaId: string | null = null;
      if (data.table_id) {
        const { data: tableData } = await admin
          .from('dining_tables')
          .select('service_area_id')
          .eq('id', data.table_id)
          .maybeSingle();
        serviceAreaId = tableData?.service_area_id || null;
      }

      scope = {
        resourceType: 'order',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId,
        ownerUserId: data.customer_user_id || null,
      };
      break;
    }

    case 'inventory_item': {
      const { data, error } = await admin
        .from('inventory_items')
        .select('id, business_id')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Inventory item not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'inventory_item',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: null,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      };
      break;
    }

    case 'inventory_location': {
      const { data, error } = await admin
        .from('inventory_storage_locations')
        .select('id, business_id, branch_id')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Inventory location not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'inventory_location',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      };
      break;
    }

    case 'inventory_count': {
      const { data, error } = await admin
        .from('inventory_stock_counts')
        .select('id, business_id, branch_id, created_by')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Inventory count not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'inventory_count',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: data.created_by || null,
      };
      break;
    }

    case 'inventory_transaction': {
      const { data, error } = await admin
        .from('inventory_stock_transfers')
        .select('id, business_id, source_branch_id, destination_branch_id, created_by')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Inventory transaction not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'inventory_transaction',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.source_branch_id || data.destination_branch_id || null,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: data.created_by || null,
      };
      break;
    }

    case 'purchase_order': {
      const { data, error } = await admin
        .from('inventory_purchase_orders')
        .select('id, business_id, branch_id, created_by')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Purchase order not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'purchase_order',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id || null,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: data.created_by || null,
      };
      break;
    }



    case 'business_membership': {
      const { data, error } = await admin
        .from('business_memberships')
        .select('id, business_id, user_id')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Business membership not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'business_membership',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: null,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: data.user_id,
      };
      break;
    }

    case 'staff_assignment': {
      const { data, error } = await admin
        .from('staff_assignments')
        .select('id, business_id, branch_id, department_id, unit_id, business_membership_id, business_memberships(user_id)')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Staff assignment not found: ${resourceId}`);
      }

      const membership = data.business_memberships as unknown as { user_id?: string | null } | null;

      scope = {
        resourceType: 'staff_assignment',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id || null,
        departmentId: data.department_id || null,
        organizationUnitId: data.unit_id || null,
        serviceAreaId: null,
        ownerUserId: membership?.user_id || null,
      };
      break;
    }

    case 'dining_table': {
      const { data, error } = await admin
        .from('dining_tables')
        .select('id, business_id, branch_id, service_area_id')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Dining table not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'dining_table',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: data.service_area_id || null,
        ownerUserId: null,
      };
      break;
    }

    case 'service_area': {
      const { data, error } = await admin
        .from('service_areas')
        .select('id, business_id, branch_id')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Service area not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'service_area',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: data.id,
        ownerUserId: null,
      };
      break;
    }

    case 'recipe': {
      const { data, error } = await admin
        .from('inventory_recipes')
        .select('id, business_id, branch_id, created_by')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Recipe not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'recipe',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id || null,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: data.created_by || null,
      };
      break;
    }

    case 'modifier_group': {
      const { data, error } = await admin
        .from('modifier_groups')
        .select('id, business_id, branch_id')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Modifier group not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'modifier_group',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id || null,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      };
      break;
    }

    case 'menu_item': {
      const { data, error } = await admin
        .from('menu_items')
        .select('id, business_id, branch_id')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Menu item not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'menu_item',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id || null,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      };
      break;
    }

    case 'branch': {
      const { data, error } = await admin
        .from('branches')
        .select('id, business_id')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Branch not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'branch',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.id,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      };
      break;
    }

    case 'department': {
      const { data, error } = await admin
        .from('organization_departments')
        .select('id, business_id, branch_id')
        .eq('id', resourceId)
        .is('archived_at', null)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Department not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'department',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id || null,
        departmentId: data.id,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      };
      break;
    }

    case 'organization_unit': {
      const { data, error } = await admin
        .from('organization_units')
        .select('id, business_id, branch_id, department_id')
        .eq('id', resourceId)
        .is('archived_at', null)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Organization unit not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'organization_unit',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id || null,
        departmentId: data.department_id || null,
        organizationUnitId: data.id,
        serviceAreaId: null,
        ownerUserId: null,
      };
      break;
    }

    case 'supplier': {
      const { data, error } = await admin
        .from('inventory_suppliers')
        .select('id, business_id')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Supplier not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'supplier',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: null,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: null,
      };
      break;
    }

    case 'payment': {
      const { data, error } = await admin
        .from('payments')
        .select('id, business_id, branch_id, received_by')
        .eq('id', resourceId)
        .maybeSingle();

      if (error || !data) {
        throw new AuthorizationContextError('RESOURCE_NOT_FOUND', `Payment record not found: ${resourceId}`);
      }

      scope = {
        resourceType: 'payment',
        resourceId: data.id,
        businessId: data.business_id,
        branchId: data.branch_id || null,
        departmentId: null,
        organizationUnitId: null,
        serviceAreaId: null,
        ownerUserId: data.received_by || null,
      };
      break;
    }

    default:
      throw new AuthorizationContextError('INVALID_RESOURCE_TYPE', `Unsupported resource type: ${resourceType}`);
  }

  if (expectedBusinessId && scope.businessId !== expectedBusinessId) {
    throw new AuthorizationContextError(
      'TENANT_MISMATCH',
      `Resource ${resourceType}:${resourceId} belongs to another business tenant.`,
      { expectedBusinessId, actualBusinessId: scope.businessId }
    );
  }

  return scope;
}
