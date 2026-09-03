import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@/server/services/organization.service';

export const dynamic = 'force-dynamic';

/**
 * Validates request authorization for automated cron triggers.
 */
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // In production with CRON_SECRET configured, enforce bearer token or header
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    const xCronHeader = req.headers.get('x-cron-secret');
    const querySecret = req.nextUrl.searchParams.get('token');

    if (
      authHeader === `Bearer ${cronSecret}` ||
      xCronHeader === cronSecret ||
      querySecret === cronSecret
    ) {
      return true;
    }
    return false;
  }

  // If CRON_SECRET is not configured in local development, allow execution
  return process.env.NODE_ENV !== 'production';
}

async function handleReconciliation(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized. Invalid or missing CRON_SECRET authorization.' },
      { status: 401 }
    );
  }

  try {
    const businessId = req.nextUrl.searchParams.get('businessId') || undefined;
    const res = await OrganizationService.reconcileAssignmentLifecycle(businessId);

    return NextResponse.json({
      success: true,
      message: 'Staff assignment lifecycle reconciled successfully.',
      activatedCount: res.activated_count ?? 0,
      endedCount: res.ended_count ?? 0,
      businessId: businessId || 'all',
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lifecycle reconciliation failed.';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleReconciliation(req);
}

export async function POST(req: NextRequest) {
  return handleReconciliation(req);
}
