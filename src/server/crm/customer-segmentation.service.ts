import { createAdminClient } from '@/lib/supabase/server';
import type {
  CustomerSegmentationDTO,
  RFMScoreDTO,
  RiskLevel,
  SegmentBreakdownDTO,
  SegmentBreakdownItemDTO,
  SegmentCode,
} from '@/lib/crm/crm-segmentation.types';
import { SYSTEM_SEGMENTS as SYSTEM_SEGMENT_DEFS } from '@/lib/crm/crm-segmentation.types';

export class CustomerSegmentationService {
  /**
   * Calculates deterministic RFM (Recency, Frequency, Monetary) scores.
   */
  public static computeCustomerRFM(input: {
    recencyDays: number;
    frequency30d: number;
    frequency90d: number;
    totalOrders: number;
    totalSpendCents: number;
    aovCents: number;
  }): RFMScoreDTO {
    const { recencyDays, frequency30d, frequency90d, totalOrders, totalSpendCents, aovCents } = input;

    // Recency Score (1 = old/worst, 5 = recent/best)
    let recencyScore = 1;
    if (recencyDays <= 7) recencyScore = 5;
    else if (recencyDays <= 14) recencyScore = 4;
    else if (recencyDays <= 30) recencyScore = 3;
    else if (recencyDays <= 90) recencyScore = 2;

    // Frequency Score
    let frequencyScore = 1;
    if (frequency90d >= 10 || totalOrders >= 15) frequencyScore = 5;
    else if (frequency90d >= 5 || totalOrders >= 8) frequencyScore = 4;
    else if (frequency90d >= 3 || totalOrders >= 4) frequencyScore = 3;
    else if (frequency90d >= 2 || totalOrders >= 2) frequencyScore = 2;

    // Monetary Score
    let monetaryScore = 1;
    if (totalSpendCents >= 50000 || aovCents >= 5000) monetaryScore = 5;
    else if (totalSpendCents >= 25000 || aovCents >= 3000) monetaryScore = 4;
    else if (totalSpendCents >= 10000 || aovCents >= 2000) monetaryScore = 3;
    else if (totalSpendCents >= 4000) monetaryScore = 2;

    return {
      recencyDays,
      frequency30d,
      frequency90d,
      totalOrders,
      totalSpendCents,
      aovCents,
      recencyScore,
      frequencyScore,
      monetaryScore,
    };
  }

  /**
   * Calculates deterministic Retention Risk Score (0-100) and Risk Level.
   */
  public static computeRetentionRisk(input: {
    recencyDays: number;
    totalOrders: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
  }): { retentionRiskScore: number; riskLevel: RiskLevel } {
    const { recencyDays, totalOrders, firstOrderAt, lastOrderAt } = input;

    if (totalOrders <= 1 || !firstOrderAt || !lastOrderAt) {
      if (recencyDays > 90) return { retentionRiskScore: 85, riskLevel: 'CRITICAL' };
      if (recencyDays > 45) return { retentionRiskScore: 65, riskLevel: 'HIGH' };
      if (recencyDays > 21) return { retentionRiskScore: 40, riskLevel: 'MEDIUM' };
      return { retentionRiskScore: 10, riskLevel: 'LOW' };
    }

    const firstTime = new Date(firstOrderAt).getTime();
    const lastTime = new Date(lastOrderAt).getTime();
    const spanDays = Math.max(1, Math.round((lastTime - firstTime) / (1000 * 60 * 60 * 24)));
    const avgIntervalDays = Math.max(3, spanDays / Math.max(1, totalOrders - 1));

    const ratio = recencyDays / avgIntervalDays;

    let retentionRiskScore = 10;
    let riskLevel: RiskLevel = 'LOW';

    if (ratio >= 3.0 || recencyDays > 90) {
      retentionRiskScore = Math.min(99, Math.round(75 + ratio * 5));
      riskLevel = 'CRITICAL';
    } else if (ratio >= 2.0) {
      retentionRiskScore = Math.min(85, Math.round(55 + (ratio - 2.0) * 20));
      riskLevel = 'HIGH';
    } else if (ratio >= 1.3) {
      retentionRiskScore = Math.min(55, Math.round(30 + (ratio - 1.3) * 25));
      riskLevel = 'MEDIUM';
    }

    return { retentionRiskScore, riskLevel };
  }

  /**
   * Classifies a customer into matching segment codes based on RFM and Retention Risk.
   */
  public static classifyCustomerSegments(input: {
    rfmScore: RFMScoreDTO;
    retentionRiskScore: number;
    riskLevel: RiskLevel;
    firstSeenAt: string;
  }): { primarySegmentCode: SegmentCode; segmentCodes: SegmentCode[] } {
    const { rfmScore, riskLevel, firstSeenAt } = input;
    const codesSet = new Set<SegmentCode>();

    const firstSeenDays = Math.max(
      0,
      Math.floor((Date.now() - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60 * 24))
    );

    // VIP Rule: High spend + good frequency or recency
    if (
      rfmScore.totalSpendCents >= 30000 &&
      (rfmScore.frequencyScore >= 4 || rfmScore.recencyScore >= 4)
    ) {
      codesSet.add('VIP');
    }

    // REGULAR Rule: Consistent repeat visit pattern
    if (
      rfmScore.frequencyScore >= 3 &&
      rfmScore.recencyScore >= 3 &&
      !codesSet.has('VIP')
    ) {
      codesSet.add('REGULAR');
    }

    // LAPSED Rule: > 90 days since last order
    if (rfmScore.recencyDays > 90) {
      codesSet.add('LAPSED');
    }

    // AT_RISK Rule: Active history but high risk decay and not yet lapsed
    if (
      rfmScore.totalOrders >= 2 &&
      (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') &&
      !codesSet.has('LAPSED')
    ) {
      codesSet.add('AT_RISK');
    }

    // NEW_GUEST Rule: Joined or first order within last 30 days
    if (firstSeenDays <= 30 && rfmScore.totalOrders <= 2) {
      codesSet.add('NEW_GUEST');
    }

    // ONE_TIME Rule: Only 1 order > 30 days ago
    if (rfmScore.totalOrders === 1 && rfmScore.recencyDays > 30) {
      codesSet.add('ONE_TIME');
    }

    // Fallback if no specific rule matched
    if (codesSet.size === 0) {
      if (rfmScore.totalOrders >= 2) codesSet.add('REGULAR');
      else codesSet.add('NEW_GUEST');
    }

    const segmentCodes = Array.from(codesSet);

    // Primary segment determination by priority
    const priorityOrder: SegmentCode[] = [
      'VIP',
      'AT_RISK',
      'LAPSED',
      'REGULAR',
      'NEW_GUEST',
      'ONE_TIME',
    ];

    let primarySegmentCode: SegmentCode = segmentCodes[0];
    for (const code of priorityOrder) {
      if (codesSet.has(code)) {
        primarySegmentCode = code;
        break;
      }
    }

    return { primarySegmentCode, segmentCodes };
  }

  /**
   * Evaluates segmentation DTO for a customer in memory.
   */
  public static evaluateCustomerSegmentation(input: {
    customerId: string;
    businessId: string;
    firstSeenAt: string;
    lastOrderAt: string | null;
    firstOrderAt: string | null;
    totalOrders: number;
    completedOrders: number;
    totalSpendCents: number;
    orders30d: number;
    orders90d: number;
  }): CustomerSegmentationDTO {
    const now = Date.now();
    const lastOrderTime = input.lastOrderAt ? new Date(input.lastOrderAt).getTime() : now;
    const recencyDays = input.lastOrderAt
      ? Math.max(0, Math.floor((now - lastOrderTime) / (1000 * 60 * 60 * 24)))
      : 999;

    const aovCents =
      input.completedOrders > 0 ? Math.round(input.totalSpendCents / input.completedOrders) : 0;

    const rfmScore = this.computeCustomerRFM({
      recencyDays,
      frequency30d: input.orders30d,
      frequency90d: input.orders90d,
      totalOrders: input.completedOrders,
      totalSpendCents: input.totalSpendCents,
      aovCents,
    });

    const { retentionRiskScore, riskLevel } = this.computeRetentionRisk({
      recencyDays,
      totalOrders: input.completedOrders,
      firstOrderAt: input.firstOrderAt,
      lastOrderAt: input.lastOrderAt,
    });

    const { primarySegmentCode, segmentCodes } = this.classifyCustomerSegments({
      rfmScore,
      retentionRiskScore,
      riskLevel,
      firstSeenAt: input.firstSeenAt,
    });

    return {
      customerId: input.customerId,
      businessId: input.businessId,
      primarySegmentCode,
      segmentCodes,
      rfmScore,
      retentionRiskScore,
      riskLevel,
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Fetches and computes segmentation for a single customer, bounded by property reach.
   */
  public static async getCustomerSegmentation(input: {
    businessId: string;
    customerId: string;
    branchIds?: string[] | null;
  }): Promise<CustomerSegmentationDTO | null> {
    const { businessId, customerId, branchIds } = input;
    const admin = createAdminClient();

    const { data: customer } = await admin
      .from('crm_customers')
      .select('id, business_id, created_at')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (!customer) return null;

    let ordersQuery = admin
      .from('orders')
      .select('id, created_at, total_cents, status, branch_id')
      .eq('crm_customer_id', customerId)
      .eq('business_id', businessId);

    if (branchIds && branchIds.length > 0) {
      ordersQuery = ordersQuery.in('branch_id', branchIds);
    }

    const { data: orders } = await ordersQuery;
    const validOrders = (orders || []).filter(
      (o) => o.status === 'completed' || o.status === 'served' || o.status === 'delivered'
    );

    validOrders.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    let totalSpendCents = 0;
    let orders30d = 0;
    let orders90d = 0;
    let firstOrderAt: string | null = null;
    let lastOrderAt: string | null = null;

    if (validOrders.length > 0) {
      firstOrderAt = validOrders[0].created_at;
      lastOrderAt = validOrders[validOrders.length - 1].created_at;
    }

    for (const ord of validOrders) {
      totalSpendCents += ord.total_cents || 0;
      const t = new Date(ord.created_at).getTime();
      if (t >= thirtyDaysAgo) orders30d++;
      if (t >= ninetyDaysAgo) orders90d++;
    }

    return this.evaluateCustomerSegmentation({
      customerId,
      businessId,
      firstSeenAt: customer.created_at,
      lastOrderAt,
      firstOrderAt,
      totalOrders: validOrders.length,
      completedOrders: validOrders.length,
      totalSpendCents,
      orders30d,
      orders90d,
    });
  }

  /**
   * Evaluates and persists customer segment mappings to database.
   */
  public static async evaluateAndPersistCustomerSegments(
    businessId: string,
    customerId: string
  ): Promise<CustomerSegmentationDTO | null> {
    const admin = createAdminClient();

    const { data: customer, error: custErr } = await admin
      .from('crm_customers')
      .select('id, business_id, created_at')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (custErr || !customer) return null;

    const { data: orders } = await admin
      .from('orders')
      .select('id, created_at, total_cents, status')
      .eq('crm_customer_id', customerId)
      .eq('business_id', businessId);

    const validOrders = (orders || []).filter(
      (o) => o.status === 'completed' || o.status === 'served' || o.status === 'delivered'
    );

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    let totalSpendCents = 0;
    let orders30d = 0;
    let orders90d = 0;
    let firstOrderAt: string | null = null;
    let lastOrderAt: string | null = null;

    validOrders.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    if (validOrders.length > 0) {
      firstOrderAt = validOrders[0].created_at;
      lastOrderAt = validOrders[validOrders.length - 1].created_at;
    }

    for (const ord of validOrders) {
      totalSpendCents += ord.total_cents || 0;
      const t = new Date(ord.created_at).getTime();
      if (t >= thirtyDaysAgo) orders30d++;
      if (t >= ninetyDaysAgo) orders90d++;
    }

    const dto = this.evaluateCustomerSegmentation({
      customerId,
      businessId,
      firstSeenAt: customer.created_at,
      lastOrderAt,
      firstOrderAt,
      totalOrders: validOrders.length,
      completedOrders: validOrders.length,
      totalSpendCents,
      orders30d,
      orders90d,
    });

    // Delete existing segments for customer and upsert new primary segment
    await admin.from('crm_customer_segments').delete().eq('customer_id', customerId);

    const rowsToInsert = dto.segmentCodes.map((code) => ({
      business_id: businessId,
      customer_id: customerId,
      segment_code: code,
      rfm_score: dto.rfmScore,
      retention_risk_score: dto.retentionRiskScore,
      computed_at: dto.computedAt,
    }));

    if (rowsToInsert.length > 0) {
      await admin.from('crm_customer_segments').insert(rowsToInsert);
    }

    return dto;
  }

  /**
   * Computes segment breakdown distribution across customer base.
   */
  public static async getSegmentBreakdown(input: {
    businessId: string;
    branchIds?: string[] | null;
  }): Promise<SegmentBreakdownDTO> {
    const { businessId, branchIds } = input;
    const admin = createAdminClient();

    const { data: business } = await admin
      .from('businesses')
      .select('default_currency')
      .eq('id', businessId)
      .maybeSingle();

    const currency = business?.default_currency || 'LKR';

    const customersQuery = admin
      .from('crm_customers')
      .select('id, created_at')
      .eq('business_id', businessId);

    const { data: customers } = await customersQuery;
    const customerList = customers || [];
    const totalCustomers = customerList.length;

    const segmentCounts: Record<SegmentCode, { count: number; totalSpendCents: number }> = {
      VIP: { count: 0, totalSpendCents: 0 },
      REGULAR: { count: 0, totalSpendCents: 0 },
      AT_RISK: { count: 0, totalSpendCents: 0 },
      LAPSED: { count: 0, totalSpendCents: 0 },
      NEW_GUEST: { count: 0, totalSpendCents: 0 },
      ONE_TIME: { count: 0, totalSpendCents: 0 },
    };

    if (totalCustomers > 0) {
      const customerIds = customerList.map((c) => c.id);

      // Fetch all customer orders bounded by property reach
      let ordersQuery = admin
        .from('orders')
        .select('crm_customer_id, branch_id, total_cents, status, created_at')
        .eq('business_id', businessId)
        .in('crm_customer_id', customerIds);

      if (branchIds && branchIds.length > 0) {
        ordersQuery = ordersQuery.in('branch_id', branchIds);
      }

      const { data: orders } = await ordersQuery;
      const validOrders = (orders || []).filter(
        (o) => o.status === 'completed' || o.status === 'served' || o.status === 'delivered'
      );

      // Group orders by customer
      const ordersByCustMap = new Map<string, typeof validOrders>();
      for (const ord of validOrders) {
        if (!ord.crm_customer_id) continue;
        const list = ordersByCustMap.get(ord.crm_customer_id) || [];
        list.push(ord);
        ordersByCustMap.set(ord.crm_customer_id, list);
      }

      for (const cust of customerList) {
        const custOrders = ordersByCustMap.get(cust.id) || [];
        custOrders.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );

        let totalSpendCents = 0;
        let orders30d = 0;
        let orders90d = 0;
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
        const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

        for (const ord of custOrders) {
          totalSpendCents += ord.total_cents || 0;
          const t = new Date(ord.created_at).getTime();
          if (t >= thirtyDaysAgo) orders30d++;
          if (t >= ninetyDaysAgo) orders90d++;
        }

        const firstOrderAt = custOrders.length > 0 ? custOrders[0].created_at : null;
        const lastOrderAt = custOrders.length > 0 ? custOrders[custOrders.length - 1].created_at : null;

        const dto = this.evaluateCustomerSegmentation({
          customerId: cust.id,
          businessId,
          firstSeenAt: cust.created_at,
          lastOrderAt,
          firstOrderAt,
          totalOrders: custOrders.length,
          completedOrders: custOrders.length,
          totalSpendCents,
          orders30d,
          orders90d,
        });

        // Tally segment breakdown
        const item = segmentCounts[dto.primarySegmentCode];
        if (item) {
          item.count++;
          item.totalSpendCents += totalSpendCents;
        }
      }
    }

    const segments: SegmentBreakdownItemDTO[] = SYSTEM_SEGMENT_DEFS.map((def) => {
      const tally = segmentCounts[def.code] || { count: 0, totalSpendCents: 0 };
      const percentageOfCustomerBase =
        totalCustomers > 0 ? Number(((tally.count / totalCustomers) * 100).toFixed(1)) : 0;
      const aovCents =
        tally.count > 0 ? Math.round(tally.totalSpendCents / tally.count) : 0;

      return {
        segmentCode: def.code,
        segmentName: def.name,
        description: def.description,
        colorHex: def.colorHex,
        customerCount: tally.count,
        totalSpendCents: tally.totalSpendCents,
        aovCents,
        percentageOfCustomerBase,
      };
    });

    return {
      businessId,
      branchId: branchIds && branchIds.length === 1 ? branchIds[0] : null,
      totalCustomers,
      segments,
      currency,
      computedAt: new Date().toISOString(),
    };
  }
}
