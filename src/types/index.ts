export * from './database.types';

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
  defaultBranch: {
    id: string;
    name: string;
    code: string;
    timezone: string;
    isDefault: boolean;
    require_table_selection?: boolean;
    require_table_pin?: boolean;
    table_pin_length?: number;
  } | null;
  membership: {
    id: string;
    role: string;
    status: string;
  };
}
