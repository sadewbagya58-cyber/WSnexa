'use server';

import { revalidatePath } from 'next/cache';
import { WaiterService, WaiterRequestRecord } from '@/server/services/waiter.service';
import { SubmitCustomerAssistanceInput, WaiterRequestStatus } from '@/lib/validation/waiter';
import { ActionResponse } from './auth';

/**
 * Customer Assistance Request Submission Server Action.
 */
export async function submitCustomerAssistanceAction(
  input: SubmitCustomerAssistanceInput
): Promise<ActionResponse<{ requestId: string; tableName: string; requestType: string }>> {
  const result = await WaiterService.submitCustomerAssistance(input);

  if (!result.success || !result.data) {
    return {
      success: false,
      message: result.message || 'Failed to send assistance request.',
    };
  }

  revalidatePath(`/m/${input.rawQrToken}`);
  return {
    success: true,
    message: 'Assistance request sent to branch staff!',
    data: result.data,
  };
}

/**
 * Staff Waiter Request Status Update Server Action.
 */
export async function updateWaiterRequestStatusAction(
  requestId: string,
  status: WaiterRequestStatus
): Promise<ActionResponse> {
  const result = await WaiterService.updateWaiterRequestStatus(requestId, status);

  if (!result.success) {
    return {
      success: false,
      message: result.message || 'Failed to update request status.',
    };
  }

  return {
    success: true,
    message: result.message || `Request updated to ${status}.`,
  };
}

/**
 * Retrieves authoritative active waiter assistance requests with canonical actor identities.
 */
export async function getBranchWaiterRequestsAction(
  branchIdInput?: string
): Promise<{ success: boolean; requests: WaiterRequestRecord[]; message?: string }> {
  try {
    const requests = await WaiterService.getBranchWaiterRequests(branchIdInput);
    return { success: true, requests };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve waiter requests.';
    return { success: false, requests: [], message: msg };
  }
}
