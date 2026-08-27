export interface BranchInfo {
  id: string;
  name: string;
  code: string;
  phone?: string | null;
  email?: string | null;
  address_line1?: string | null;
  city?: string | null;
  timezone: string;
  currency?: string | null;
  isDefault: boolean;
  status: string;
  require_table_selection?: boolean;
  require_table_pin?: boolean;
  table_pin_length?: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface TenantSubscriptionInfo {
  planCode: string;
  status: string;
  effectiveStatus: 'TRIALING' | 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'CANCELLED';
  trialEndsAt: string;
  periodEndsAt: string | null;
  graceEndsAt: string | null;
  daysRemaining: number;
  effectiveLimits: {
    maxBranches: number | null;
    maxActiveStaff: number | null;
    maxTables: number | null;
    maxMenuItems: number | null;
    maxCustomRoles: number | null;
  };
}

export interface ActiveTenantContext {
  user: {
    id: string;
    email: string;
  };
  profile: {
    firstName: string;
    lastName: string | null;
  } | null;
  business: {
    id: string;
    name: string;
    slug: string;
    businessType: string;
    countryCode: string;
    defaultCurrency: string;
    timezone: string;
    status: string;
  };
  defaultBranch: BranchInfo | null;
  activeBranch: BranchInfo | null;
  branches: BranchInfo[];
  membership: {
    id: string;
    role: string;
    status: string;
    customRoleId?: string | null;
    customRoleName?: string | null;
  };
  subscription?: TenantSubscriptionInfo;
}

export * from './authorization.types';

