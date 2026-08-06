import { NextRequest, NextResponse } from 'next/server';
import { resolveActiveBusinessContext } from '@/server/tenant/resolver';
import { PaymentService } from '@/server/services/payment.service';

export async function GET(req: NextRequest) {
  const context = await resolveActiveBusinessContext();
  if (!context || !context.activeBranch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { role } = context.membership;
  if (!['business_owner', 'branch_manager', 'cashier'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requestedBranchId = req.nextUrl.searchParams.get('branchId');
  if (requestedBranchId && requestedBranchId !== context.activeBranch.id) {
    return NextResponse.json({ error: 'Branch mismatch' }, { status: 403 });
  }

  const orders = await PaymentService.getCashierOrders();
  return NextResponse.json({ orders });
}
