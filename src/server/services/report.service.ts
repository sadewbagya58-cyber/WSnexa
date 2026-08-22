import { createAdminClient } from '@/lib/supabase/server';
import { ReportFilterInput, ReportPreset } from '@/lib/validation/report';

export interface SalesSummaryData {
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  pending_orders: number;
  gross_sales_cents: number;
  subtotal_cents: number;
  tax_cents: number;
  service_charge_cents: number;
  paid_revenue_cents: number;
  outstanding_balance_cents: number;
  refunded_cents: number;
  aov_cents: number;
  top_item_name: string;
  top_category_name: string;
  top_payment_method: string;
  avg_prep_seconds: number;
}

export interface TimeSeriesBucket {
  bucket: string;
  gross_sales_cents: number;
  orders_count: number;
  paid_revenue_cents: number;
}

export interface OrdersByHourBucket {
  hour: number;
  orders_count: number;
  revenue_cents: number;
}

export interface PaymentBreakdownItem {
  payment_method: string;
  total_cents: number;
  transaction_count: number;
  percentage: number;
}

export interface MenuItemPerformance {
  item_name: string;
  quantity_sold: number;
  total_revenue_cents: number;
  orders_count: number;
  avg_price_cents: number;
}

export interface ModifierPerformance {
  group_name: string;
  option_name: string;
  selections_count: number;
  additional_revenue_cents: number;
}

export interface KitchenPerformance {
  avg_confirmation_seconds: number;
  avg_preparation_seconds: number;
  avg_ready_seconds: number;
  longest_preparation_seconds: number;
}

export interface TablePerformance {
  table_id: string;
  table_name: string;
  table_code: string;
  orders_count: number;
  total_revenue_cents: number;
  avg_order_value_cents: number;
}

export interface BranchComparisonItem {
  branch_id: string;
  branch_name: string;
  branch_code: string;
  orders_count: number;
  gross_sales_cents: number;
  paid_revenue_cents: number;
  avg_order_value_cents: number;
}

export interface CompleteAnalyticsPayload {
  summary: SalesSummaryData;
  timeSeries: TimeSeriesBucket[];
  ordersByHour: OrdersByHourBucket[];
  payments: PaymentBreakdownItem[];
  menuItems: MenuItemPerformance[];
  modifiers: ModifierPerformance[];
  kitchen: KitchenPerformance;
  tables: TablePerformance[];
  branchComparison?: BranchComparisonItem[];
  currency: string;
  branchName: string;
  businessName: string;
  dateRangeLabel: string;
}

export class ReportService {
  /**
   * Resolves ISO start and end timestamps based on preset or custom date strings.
   */
  static resolveDateBounds(preset: ReportPreset, customStart?: string | null, customEnd?: string | null) {
    const now = new Date();

    if (preset === 'custom' && customStart && customEnd) {
      return {
        startDate: new Date(customStart).toISOString(),
        endDate: new Date(customEnd).toISOString(),
        label: 'Custom Range',
      };
    }

    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    let label = 'Today';

    switch (preset) {
      case 'yesterday': {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: yEnd.toISOString(), label: 'Yesterday' };
      }
      case '7d': {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        label = 'Last 7 Days';
        break;
      }
      case '30d': {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        label = 'Last 30 Days';
        break;
      }
      case 'this_month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        label = 'This Month';
        break;
      }
      case 'last_month': {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: lmEnd.toISOString(), label: 'Last Month' };
      }
      case 'today':
      default:
        break;
    }

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label,
    };
  }

  /**
   * Fetches full analytics report payload for active branch and role.
   */
  static async getAnalyticsPayload(input: ReportFilterInput): Promise<{
    success: boolean;
    message?: string;
    data?: CompleteAnalyticsPayload;
  }> {
    const { can, resolveAuthorizationContext } = await import('@/server/auth');
    let authContext;
    try {
      authContext = await resolveAuthorizationContext();
    } catch {
      return { success: false, message: 'Unauthorized or invalid session.' };
    }

    if (!authContext || !authContext.businessId) {
      return { success: false, message: 'Unauthorized or active business context missing.' };
    }

    const targetBranchId = input.branchId || authContext.activeBranchId;
    if (!targetBranchId) {
      return { success: false, message: 'Branch context required for analytics.' };
    }

    const branchResource = { type: 'branch' as const, id: targetBranchId };

    const canViewReports =
      (await can({ context: authContext, permission: 'reports.view', resource: branchResource })) ||
      (await can({ context: authContext, permission: 'reports.financial.view', resource: branchResource }));

    if (!canViewReports) {
      return { success: false, message: 'Forbidden. Reporting permissions required.' };
    }

    const bounds = this.resolveDateBounds(input.preset, input.startDate, input.endDate);
    const admin = createAdminClient();

    // 1. Fetch Sales Summary
    const { data: summaryData } = await admin.rpc('get_branch_sales_summary', {
      p_branch_id: targetBranchId,
      p_start_date: bounds.startDate,
      p_end_date: bounds.endDate,
    });

    // 2. Fetch Time Series
    const { data: timeSeriesData } = await admin.rpc('get_revenue_time_series', {
      p_branch_id: targetBranchId,
      p_start_date: bounds.startDate,
      p_end_date: bounds.endDate,
      p_interval: input.interval || 'day',
    });

    // 3. Fetch Orders By Hour
    const { data: ordersByHourData } = await admin.rpc('get_orders_by_hour', {
      p_branch_id: targetBranchId,
      p_start_date: bounds.startDate,
      p_end_date: bounds.endDate,
    });

    // 4. Fetch Payment Breakdown
    const { data: paymentData } = await admin.rpc('get_payment_analytics', {
      p_branch_id: targetBranchId,
      p_start_date: bounds.startDate,
      p_end_date: bounds.endDate,
    });

    // 5. Fetch Menu Performance
    const { data: menuData } = await admin.rpc('get_menu_analytics', {
      p_branch_id: targetBranchId,
      p_start_date: bounds.startDate,
      p_end_date: bounds.endDate,
      p_limit: input.limit || 10,
    });

    // 6. Fetch Modifier Performance
    const { data: modifierData } = await admin.rpc('get_modifier_analytics', {
      p_branch_id: targetBranchId,
      p_start_date: bounds.startDate,
      p_end_date: bounds.endDate,
      p_limit: input.limit || 10,
    });

    // 7. Fetch Kitchen Analytics
    const { data: kitchenData } = await admin.rpc('get_kitchen_analytics', {
      p_branch_id: targetBranchId,
      p_start_date: bounds.startDate,
      p_end_date: bounds.endDate,
    });

    // 8. Fetch Table Analytics
    const { data: tableData } = await admin.rpc('get_table_analytics', {
      p_branch_id: targetBranchId,
      p_start_date: bounds.startDate,
      p_end_date: bounds.endDate,
    });

    // 9. Fetch Cross-Branch Comparison (Business-wide reporting authorized)
    let branchComparisonData: BranchComparisonItem[] | undefined = undefined;
    const canViewAllBranches = await can({ context: authContext, permission: 'reports.view' });
    if (canViewAllBranches && authContext.isBusinessOwner) {
      const { data: compRes } = await admin.rpc('get_branch_comparison', {
        p_business_id: authContext.businessId,
        p_start_date: bounds.startDate,
        p_end_date: bounds.endDate,
      });
      if (compRes && (compRes as { success?: boolean }).success) {
        branchComparisonData = (compRes as { branches?: BranchComparisonItem[] }).branches || [];
      }
    }

    const defaultSummary: SalesSummaryData = {
      total_orders: 0,
      completed_orders: 0,
      cancelled_orders: 0,
      pending_orders: 0,
      gross_sales_cents: 0,
      subtotal_cents: 0,
      tax_cents: 0,
      service_charge_cents: 0,
      paid_revenue_cents: 0,
      outstanding_balance_cents: 0,
      refunded_cents: 0,
      aov_cents: 0,
      top_item_name: 'None',
      top_category_name: 'None',
      top_payment_method: 'pay_at_counter',
      avg_prep_seconds: 0,
    };

    const activeBranchAssignment = authContext.branchAssignments.find(
      (b) => b.branchId === targetBranchId
    );
    const branchName = activeBranchAssignment?.branchName || 'Branch';

    return {
      success: true,
      data: {
        summary: (summaryData as SalesSummaryData) || defaultSummary,
        timeSeries: (timeSeriesData as { series?: TimeSeriesBucket[] })?.series || [],
        ordersByHour: (ordersByHourData as { hours?: OrdersByHourBucket[] })?.hours || [],
        payments: (paymentData as { breakdown?: PaymentBreakdownItem[] })?.breakdown || [],
        menuItems: (menuData as { items?: MenuItemPerformance[] })?.items || [],
        modifiers: (modifierData as { modifiers?: ModifierPerformance[] })?.modifiers || [],
        kitchen: (kitchenData as KitchenPerformance) || {
          avg_confirmation_seconds: 0,
          avg_preparation_seconds: 0,
          avg_ready_seconds: 0,
          longest_preparation_seconds: 0,
        },
        tables: (tableData as { tables?: TablePerformance[] })?.tables || [],
        branchComparison: branchComparisonData,
        currency: 'LKR',
        branchName,
        businessName: authContext.businessName,
        dateRangeLabel: bounds.label,
      },
    };
  }
}
