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
   * Returns exact non-overlapping RiskLevel based on retention risk score (0-100).
   * LOW: 0-29, MEDIUM: 30-54, HIGH: 55-74, CRITICAL: 75-100
   */
  public static getRiskLevel(score: number): RiskLevel {
    if (score >= 75) return 'CRITICAL';
    if (score >= 55) return 'HIGH';
    if (score >= 30) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculates cohort percentile ranks for a list of customer spends.
   * Handles small cohorts safely (1, 2, 3-4 customers).
   */
  public static computeCohortPercentiles(
    customers: { id: string; totalSpendCents: number }[]
  ): Map<string, number> {
    const map = new Map<string, number>();
    const n = customers.length;
    if (n === 0) return map;

    // Sort ascending by totalSpendCents
    const sorted = [...customers].sort((a, b) => a.totalSpendCents - b.totalSpendCents);

    if (n === 1) {
      map.set(sorted[0].id, 50); // Single customer baseline = neutral 50th percentile (Monetary 3)
      return map;
    }

    if (n === 2) {
      map.set(sorted[0].id, 30); // Lower spend = 30th percentile (Monetary 2)
      map.set(sorted[1].id, 80); // Higher spend = 80th percentile (Monetary 4)
      return map;
    }

    if (n === 3 || n === 4) {
      sorted.forEach((c, idx) => {
        if (idx === 0) map.set(c.id, 10); // Bottom = 10th percentile (Monetary 1)
        else if (idx === n - 1) map.set(c.id, 90); // Top = 90th percentile (Monetary 5)
        else map.set(c.id, 50); // Middle = 50th percentile (Monetary 3)
      });
      return map;
    }

    // N >= 5: Standard relative quantile ranking
    sorted.forEach((c, idx) => {
      const percentile = Math.round((idx / (n - 1)) * 100);
      map.set(c.id, percentile);
    });

    return map;
  }

  /**
   * Calculates deterministic RFM (Recency, Frequency, Monetary) scores.
   * Monetary score is currency-independent, derived from percentile rank or relative tier.
   */
  public static computeCustomerRFM(input: {
    recencyDays: number;
    frequency30d: number;
    frequency90d: number;
    totalOrders: number;
    totalSpendCents: number;
    aovCents: number;
    monetaryPercentile?: number | null; // 0 to 100
  }): RFMScoreDTO {
    const {
      recencyDays,
      frequency30d,
      frequency90d,
      totalOrders,
      totalSpendCents,
      aovCents,
      monetaryPercentile,
    } = input;

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

    // Currency-Independent Monetary Score (Percentile Distribution / Quantile Rank)
    let monetaryScore = 1;
    if (monetaryPercentile !== undefined && monetaryPercentile !== null) {
      if (monetaryPercentile >= 80) monetaryScore = 5;
      else if (monetaryPercentile >= 60) monetaryScore = 4;
      else if (monetaryPercentile >= 40) monetaryScore = 3;
      else if (monetaryPercentile >= 20) monetaryScore = 2;
      else monetaryScore = 1;
    } else {
      // Standalone fallback when no cohort percentile is provided
      if (totalSpendCents > 0) monetaryScore = 3;
      else monetaryScore = 1;
    }

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
   * Ranges: LOW = 0-29, MEDIUM = 30-54, HIGH = 55-74, CRITICAL = 75-100.
   */
  public static computeRetentionRisk(input: {
    recencyDays: number;
    totalOrders: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
  }): { retentionRiskScore: number; riskLevel: RiskLevel } {
    const { recencyDays, totalOrders, firstOrderAt, lastOrderAt } = input;

    // Sample-Size Safety: 0 completed orders
    if (totalOrders <= 0) {
      return { retentionRiskScore: 0, riskLevel: 'LOW' };
    }

    // Sample-Size Safety: 1 completed order (insufficient interval history)
    if (totalOrders === 1 || !firstOrderAt || !lastOrderAt) {
      if (recencyDays > 90) return { retentionRiskScore: 80, riskLevel: 'CRITICAL' };
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
    if (ratio >= 3.0 || recencyDays > 90) {
      retentionRiskScore = Math.min(100, Math.max(75, 75 + Math.round((ratio - 3.0) * 10)));
    } else if (ratio >= 2.0) {
      retentionRiskScore = Math.min(74, Math.max(55, 55 + Math.round((ratio - 2.0) * 19)));
    } else if (ratio >= 1.3) {
      retentionRiskScore = Math.min(54, Math.max(30, 30 + Math.round((ratio - 1.3) * 34)));
    } else {
      retentionRiskScore = Math.min(29, Math.max(0, Math.round(ratio * 22)));
    }

    const riskLevel = this.getRiskLevel(retentionRiskScore);
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

    // 1. VIP Rule (Currency-Independent): Top quantile monetary spender + high frequency or recency
    if (
      rfmScore.monetaryScore >= 4 &&
      (rfmScore.frequencyScore >= 4 || rfmScore.recencyScore >= 4)
    ) {
      codesSet.add('VIP');
    }

    // 2. REGULAR Rule: Consistent repeat visit pattern
    if (
      rfmScore.frequencyScore >= 3 &&
      rfmScore.recencyScore >= 3 &&
      !codesSet.has('VIP')
    ) {
      codesSet.add('REGULAR');
    }

    // 3. LAPSED Rule: > 90 days since last completed order
    if (rfmScore.totalOrders >= 1 && rfmScore.recencyDays > 90) {
      codesSet.add('LAPSED');
    }

    // 4. AT_RISK Rule: Active history (>= 2 orders) but high/critical risk decay and not yet lapsed (>90d)
    if (
      rfmScore.totalOrders >= 2 &&
      (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') &&
      !codesSet.has('LAPSED')
    ) {
      codesSet.add('AT_RISK');
    }

    // 5. NEW_GUEST Rule: Joined or first order within last 30 days (totalOrders <= 2)
    if (firstSeenDays <= 30 && rfmScore.recencyDays <= 30 && rfmScore.totalOrders <= 2) {
      codesSet.add('NEW_GUEST');
    }

    // 6. ONE_TIME Rule: Exactly 1 completed order placed 31 to 90 days ago
    if (rfmScore.totalOrders === 1 && rfmScore.recencyDays >= 31 && rfmScore.recencyDays <= 90) {
      codesSet.add('ONE_TIME');
    }

    // Fallback if no specific rule matched
    if (codesSet.size === 0) {
      if (rfmScore.totalOrders >= 2) codesSet.add('REGULAR');
      else if (rfmScore.recencyDays <= 30) codesSet.add('NEW_GUEST');
      else if (rfmScore.recencyDays <= 90) codesSet.add('ONE_TIME');
      else codesSet.add('LAPSED');
    }

    const segmentCodes = Array.from(codesSet);

    // Primary segment determination by strict priority order
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
    monetaryPercentile?: number | null;
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
      monetaryPercentile: input.monetaryPercentile,
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

    // Compute cohort percentile strictly bounded by property reach
    let monetaryPercentile: number | null = null;
    let cohortQuery = admin
      .from('orders')
      .select('crm_customer_id, total_cents, status, branch_id')
      .eq('business_id', businessId);

    if (branchIds && branchIds.length > 0) {
      cohortQuery = cohortQuery.in('branch_id', branchIds);
    }

    const { data: cohortOrders } = await cohortQuery;
    const validCohortOrders = (cohortOrders || []).filter(
      (o) => o.status === 'completed' || o.status === 'served' || o.status === 'delivered'
    );

    const spendMap = new Map<string, number>();
    for (const ord of validCohortOrders) {
      if (!ord.crm_customer_id) continue;
      spendMap.set(ord.crm_customer_id, (spendMap.get(ord.crm_customer_id) || 0) + (ord.total_cents || 0));
    }

    const cohortList = Array.from(spendMap.entries()).map(([id, totalSpendCents]) => ({
      id,
      totalSpendCents,
    }));

    const percentileMap = this.computeCohortPercentiles(cohortList);
    monetaryPercentile = percentileMap.get(customerId) ?? null;

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
      monetaryPercentile,
    });
  }

  /**
   * Evaluates and persists customer segment mappings to database (Business-Wide Truth).
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

    // Business-wide cohort percentile calculation
    const { data: businessOrders } = await admin
      .from('orders')
      .select('crm_customer_id, total_cents, status')
      .eq('business_id', businessId);

    const validBizOrders = (businessOrders || []).filter(
      (o) => o.status === 'completed' || o.status === 'served' || o.status === 'delivered'
    );

    const bizSpendMap = new Map<string, number>();
    for (const ord of validBizOrders) {
      if (!ord.crm_customer_id) continue;
      bizSpendMap.set(ord.crm_customer_id, (bizSpendMap.get(ord.crm_customer_id) || 0) + (ord.total_cents || 0));
    }

    const bizCohortList = Array.from(bizSpendMap.entries()).map(([id, totalSpendCents]) => ({
      id,
      totalSpendCents,
    }));

    const bizPercentileMap = this.computeCohortPercentiles(bizCohortList);
    const monetaryPercentile = bizPercentileMap.get(customerId) ?? null;

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
      monetaryPercentile,
    });

    // Delete existing segments for customer and upsert new primary/secondary segment rows
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
   * Computes segment breakdown distribution across customer base (bounded by property reach).
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

      // Group orders by customer and calculate spend for cohort percentile
      const ordersByCustMap = new Map<string, typeof validOrders>();
      const spendMap = new Map<string, number>();

      for (const ord of validOrders) {
        if (!ord.crm_customer_id) continue;
        const list = ordersByCustMap.get(ord.crm_customer_id) || [];
        list.push(ord);
        ordersByCustMap.set(ord.crm_customer_id, list);
        spendMap.set(ord.crm_customer_id, (spendMap.get(ord.crm_customer_id) || 0) + (ord.total_cents || 0));
      }

      const cohortList = customerList.map((cust) => ({
        id: cust.id,
        totalSpendCents: spendMap.get(cust.id) || 0,
      }));

      const percentileMap = this.computeCohortPercentiles(cohortList);

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
        const monetaryPercentile = percentileMap.get(cust.id) ?? null;

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
          monetaryPercentile,
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
