'use server';

import { can, resolveAuthorizationContext } from '@/server/auth';
import { createAdminClient } from '@/lib/supabase/server';
import type { CRMActionStatus } from '@/lib/crm/crm-action.types';
import type { CustomerDirectoryQueryInput } from '@/lib/crm/crm-types';
import { CustomerActionService } from '@/server/crm/customer-action.service';
import { CustomerDirectoryService } from '@/server/crm/customer-directory.service';
import { CustomerNotesService } from '@/server/crm/customer-notes.service';
import { CustomerProfileService } from '@/server/crm/customer-profile.service';
import { CustomerTagService } from '@/server/crm/customer-tag.service';
import { CRMOverviewService } from '@/server/crm/crm-overview.service';

export async function getCRMOverviewServerAction(
  businessId: string,
  branchIds?: string[] | null
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.view' }))) {
    throw new Error('Forbidden: missing customers.view permission');
  }

  return CRMOverviewService.getCRMOverview({
    businessId,
    branchIds: branchIds || authContext.authorizedBranchIds,
  });
}

export async function listCustomerDirectoryServerAction(
  input: CustomerDirectoryQueryInput = {}
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext) throw new Error('Unauthorized session');
  return CustomerDirectoryService.searchCustomerDirectory(authContext, input);
}

export async function getUnifiedCustomerProfileServerAction(
  businessId: string,
  customerId: string
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  return CustomerProfileService.getUnifiedCustomerProfile(customerId, businessId, authContext);
}

export async function revealCustomerContactDetailsServerAction(
  businessId: string,
  customerId: string
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.contact_view' }))) {
    throw new Error('Forbidden: customers.contact_view permission is required to reveal full contact details.');
  }

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from('crm_customers')
    .select('email_normalized, phone_normalized')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .maybeSingle();

  if (!customer) throw new Error('Customer not found');

  return {
    email: customer.email_normalized || null,
    phone: customer.phone_normalized || null,
  };
}

export async function listCustomerNotesServerAction(
  businessId: string,
  crmCustomerId: string,
  branchIds?: string[] | null
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.view' }))) {
    throw new Error('Forbidden: missing customers.view permission');
  }

  return CustomerNotesService.listNotes({
    businessId,
    crmCustomerId,
    branchIds: branchIds || authContext.authorizedBranchIds,
  });
}

export async function addCustomerNoteServerAction(
  businessId: string,
  crmCustomerId: string,
  noteText: string,
  branchId?: string | null
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  return CustomerNotesService.addNote({
    businessId,
    crmCustomerId,
    branchId: branchId || null,
    noteText,
    actorUserId: authContext.userId,
  });
}

export async function deleteCustomerNoteServerAction(
  businessId: string,
  noteId: string
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  return CustomerNotesService.softDeleteNote({
    businessId,
    noteId,
    actorUserId: authContext.userId,
  });
}

export async function listCustomerTagsServerAction(businessId: string) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.view' }))) {
    throw new Error('Forbidden: missing customers.view permission');
  }

  return CustomerTagService.listTags(businessId);
}

export async function createCustomerTagServerAction(
  businessId: string,
  name: string,
  description?: string | null,
  colorHex?: string | null
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  return CustomerTagService.createTag({
    businessId,
    name,
    description,
    colorHex,
  });
}

export async function createAndAssignCustomerTagServerAction(
  businessId: string,
  crmCustomerId: string,
  name: string
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  const tag = await CustomerTagService.createTag({
    businessId,
    name,
  });

  await CustomerTagService.assignTag({
    businessId,
    crmCustomerId,
    tagId: tag.id,
    actorUserId: authContext.userId,
  });

  return tag;
}

export async function assignCustomerTagServerAction(
  businessId: string,
  crmCustomerId: string,
  tagId: string
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  return CustomerTagService.assignTag({
    businessId,
    crmCustomerId,
    tagId,
    actorUserId: authContext.userId,
  });
}

export async function removeCustomerTagServerAction(
  businessId: string,
  crmCustomerId: string,
  tagId: string
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  return CustomerTagService.removeTag({
    businessId,
    crmCustomerId,
    tagId,
  });
}

export async function listCRMActionsServerAction(
  businessId: string,
  branchIds?: string[] | null,
  statusFilter: CRMActionStatus | 'ACTIVE' | 'ALL' = 'ACTIVE'
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.view' }))) {
    throw new Error('Forbidden: missing customers.view permission');
  }

  const hasContactViewPermission = await can({
    context: authContext,
    permission: 'customers.contact_view',
  });

  return CustomerActionService.listActions({
    businessId,
    branchIds: branchIds || authContext.authorizedBranchIds,
    statusFilter,
    hasContactViewPermission,
  });
}

export async function assignCRMActionServerAction(
  businessId: string,
  actionId: string,
  assignedUserId: string
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  return CustomerActionService.assignAction({
    businessId,
    actionId,
    assignedUserId,
    actorUserId: authContext.userId,
  });
}

export async function getEligibleAssigneesServerAction(
  businessId: string,
  actionId?: string,
  branchId?: string | null
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.view' }))) {
    throw new Error('Forbidden: missing customers.view permission');
  }

  return CustomerActionService.getEligibleAssignees({
    businessId,
    actionId,
    branchId,
  });
}

export async function startCRMActionServerAction(
  businessId: string,
  actionId: string
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  return CustomerActionService.startAction({
    businessId,
    actionId,
    actorUserId: authContext.userId,
  });
}

export async function snoozeCRMActionServerAction(
  businessId: string,
  actionId: string,
  snoozedUntil: string
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  return CustomerActionService.snoozeAction({
    businessId,
    actionId,
    snoozedUntil,
    actorUserId: authContext.userId,
  });
}

export async function completeCRMActionServerAction(
  businessId: string,
  actionId: string
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  return CustomerActionService.completeAction({
    businessId,
    actionId,
    actorUserId: authContext.userId,
  });
}

export async function dismissCRMActionServerAction(
  businessId: string,
  actionId: string
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  return CustomerActionService.dismissAction({
    businessId,
    actionId,
    actorUserId: authContext.userId,
  });
}

export async function batchEvaluateCRMActionsServerAction(
  businessId: string,
  branchIds?: string[] | null
) {
  const authContext = await resolveAuthorizationContext();
  if (!authContext || authContext.businessId !== businessId) {
    throw new Error('Unauthorized business session');
  }

  if (!(await can({ context: authContext, permission: 'customers.manage' }))) {
    throw new Error('Forbidden: missing customers.manage permission');
  }

  return CustomerActionService.batchEvaluateActions({
    businessId,
    branchIds: branchIds || authContext.authorizedBranchIds,
    actorUserId: authContext.userId,
  });
}
