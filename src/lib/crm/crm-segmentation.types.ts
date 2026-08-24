export type SegmentCode =
  | 'VIP'
  | 'REGULAR'
  | 'AT_RISK'
  | 'LAPSED'
  | 'NEW_GUEST'
  | 'ONE_TIME';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RFMScoreDTO {
  recencyDays: number;
  frequency30d: number;
  frequency90d: number;
  totalOrders: number;
  totalSpendCents: number;
  aovCents: number;
  recencyScore: number; // 1 (lowest/worst) to 5 (highest/best)
  frequencyScore: number; // 1 to 5
  monetaryScore: number; // 1 to 5
}

export interface CustomerSegmentationDTO {
  customerId: string;
  businessId: string;
  primarySegmentCode: SegmentCode;
  segmentCodes: SegmentCode[];
  rfmScore: RFMScoreDTO;
  retentionRiskScore: number; // 0 to 100
  riskLevel: RiskLevel;
  computedAt: string;
}

export interface SegmentBreakdownItemDTO {
  segmentCode: SegmentCode;
  segmentName: string;
  description: string;
  colorHex: string;
  customerCount: number;
  totalSpendCents: number;
  aovCents: number;
  percentageOfCustomerBase: number;
}

export interface SegmentBreakdownDTO {
  businessId: string;
  branchId: string | null;
  totalCustomers: number;
  segments: SegmentBreakdownItemDTO[];
  currency: string;
  computedAt: string;
}

export interface SystemSegmentDefinition {
  code: SegmentCode;
  name: string;
  description: string;
  colorHex: string;
}

export const SYSTEM_SEGMENTS: SystemSegmentDefinition[] = [
  {
    code: 'VIP',
    name: 'VIP / High Value',
    description: 'Top spending customers with frequent recent visits',
    colorHex: '#8B5CF6', // Purple
  },
  {
    code: 'REGULAR',
    name: 'Regular Guests',
    description: 'Consistent recurring diners with reliable visit patterns',
    colorHex: '#3B82F6', // Blue
  },
  {
    code: 'AT_RISK',
    name: 'At Risk of Churn',
    description: 'Previously regular guests whose visit interval has doubled',
    colorHex: '#F59E0B', // Amber
  },
  {
    code: 'LAPSED',
    name: 'Lapsed / Inactive',
    description: 'No order activity in over 90 days',
    colorHex: '#EF4444', // Red
  },
  {
    code: 'NEW_GUEST',
    name: 'New Guests',
    description: 'First joined or placed initial order within the last 30 days',
    colorHex: '#10B981', // Emerald
  },
  {
    code: 'ONE_TIME',
    name: 'One-Time Visitors',
    description: 'Placed exactly one order over 30 days ago without returning',
    colorHex: '#6B7280', // Gray
  },
];
