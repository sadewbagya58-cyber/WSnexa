export * from './database.types';

export interface ActiveTenantContext {
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
    isDefault: boolean;
  } | null;
  membership: {
    id: string;
    role: string;
    status: string;
  };
}
