import { NextRequest, NextResponse } from 'next/server';
import { can, resolveAuthorizationContext } from '@/server/auth';
import { PaymentService } from '@/server/services/payment.service';

export async function GET(req: NextRequest) {
  let authContext;
  try {
    authContext = await resolveAuthorizationContext();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!authContext || !authContext.activeBranchId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const branchResource = { type: 'branch' as const, id: authContext.activeBranchId };
  const canAccess =
    (await can({ context: authContext, permission: 'cashier.access', resource: branchResource })) ||
    (await can({ context: authContext, permission: 'orders.view', resource: branchResource }));

  if (!canAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requestedBranchId = req.nextUrl.searchParams.get('branchId');
  if (requestedBranchId && requestedBranchId !== authContext.activeBranchId) {
    return NextResponse.json({ error: 'Branch mismatch' }, { status: 403 });
  }

  const orders = await PaymentService.getCashierOrders();
  return NextResponse.json({ orders });
}
