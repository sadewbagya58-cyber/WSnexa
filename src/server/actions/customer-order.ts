'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { CustomerOrderService } from '@/server/services/customer-order.service';
import { ActionResponse } from './auth';

import { CLAIM_INTENT_COOKIE, ClaimIntentData } from '@/lib/constants/customer-order';

/**
 * Server action to claim an anonymous order for the current logged-in customer.
 */
export async function claimOrderAction(
  orderId: string,
  accessToken: string
): Promise<ActionResponse<{ orderId: string; alreadyClaimed?: boolean }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: 'Please log in or create an account to save this order to your account.',
    };
  }

  const result = await CustomerOrderService.claimOrder(user.id, orderId, accessToken);

  if (!result.success) {
    return {
      success: false,
      message: result.message,
    };
  }

  revalidatePath('/customer');
  revalidatePath('/customer/orders');
  if (result.orderId) {
    revalidatePath(`/customer/orders/${result.orderId}`);
  }

  return {
    success: true,
    message: result.message,
    data: {
      orderId: result.orderId || orderId,
      alreadyClaimed: result.alreadyClaimed,
    },
  };
}

/**
 * Stores a pending order claim intent in a secure HTTP-only cookie before auth redirect.
 */
export async function storeClaimIntentAction(
  orderId: string,
  accessToken: string,
  returnUrl: string
): Promise<ActionResponse> {
  if (!orderId || !accessToken) {
    return { success: false, message: 'Invalid claim parameters.' };
  }

  const cookieStore = await cookies();
  const payload: ClaimIntentData = {
    orderId,
    accessToken,
    returnUrl: returnUrl || `/customer/orders/${orderId}`,
    createdAt: Date.now(),
  };

  cookieStore.set(CLAIM_INTENT_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 30, // 30 minutes
    path: '/',
  });

  return { success: true, message: 'Claim intent stored.' };
}

/**
 * Executes pending claim intent cookie after successful user login/registration.
 */
export async function executePendingClaimIntentAction(): Promise<{
  executed: boolean;
  claimed?: boolean;
  orderId?: string;
  returnUrl?: string;
  message?: string;
}> {
  const cookieStore = await cookies();
  const intentCookie = cookieStore.get(CLAIM_INTENT_COOKIE);

  if (!intentCookie || !intentCookie.value) {
    return { executed: false };
  }

  let data: ClaimIntentData;
  try {
    data = JSON.parse(intentCookie.value);
  } catch {
    cookieStore.delete(CLAIM_INTENT_COOKIE);
    return { executed: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { executed: false };
  }

  const claimRes = await CustomerOrderService.claimOrder(
    user.id,
    data.orderId,
    data.accessToken
  );

  // Clear cookie regardless of result
  cookieStore.delete(CLAIM_INTENT_COOKIE);

  if (claimRes.success) {
    revalidatePath('/customer');
    revalidatePath('/customer/orders');
    return {
      executed: true,
      claimed: true,
      orderId: claimRes.orderId || data.orderId,
      returnUrl: `/customer/orders/${claimRes.orderId || data.orderId}`,
      message: claimRes.message,
    };
  }

  return {
    executed: true,
    claimed: false,
    message: claimRes.message,
  };
}
