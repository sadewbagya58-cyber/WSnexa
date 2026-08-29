import { z } from 'zod';

export const BUSINESS_TYPES = [
  'restaurant',
  'hotel',
  'cafe',
  'resort',
  'villa',
  'food_court',
  'other',
] as const;

export const COMMON_COUNTRY_MAP: Record<string, string> = {
  'SRI LANKA': 'LK',
  'SRILANKA': 'LK',
  'LKA': 'LK',
  'LK': 'LK',
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  'USA': 'US',
  'US': 'US',
  'UNITED KINGDOM': 'GB',
  'GREAT BRITAIN': 'GB',
  'UK': 'GB',
  'GBR': 'GB',
  'GB': 'GB',
  'UNITED ARAB EMIRATES': 'AE',
  'UAE': 'AE',
  'ARE': 'AE',
  'AE': 'AE',
  'SINGAPORE': 'SG',
  'SGP': 'SG',
  'SG': 'SG',
  'MALDIVES': 'MV',
  'MDV': 'MV',
  'MV': 'MV',
  'INDIA': 'IN',
  'IND': 'IN',
  'IN': 'IN',
  'AUSTRALIA': 'AU',
  'AUS': 'AU',
  'AU': 'AU',
  'CANADA': 'CA',
  'CAN': 'CA',
  'CA': 'CA',
  'GERMANY': 'DE',
  'DEU': 'DE',
  'DE': 'DE',
  'FRANCE': 'FR',
  'FRA': 'FR',
  'FR': 'FR',
  'JAPAN': 'JP',
  'JPN': 'JP',
  'JP': 'JP',
  'THAILAND': 'TH',
  'THA': 'TH',
  'TH': 'TH',
  'MALAYSIA': 'MY',
  'MYS': 'MY',
  'MY': 'MY',
  'INDONESIA': 'ID',
  'IDN': 'ID',
  'ID': 'ID',
  'NEW ZEALAND': 'NZ',
  'NZL': 'NZ',
  'NZ': 'NZ',
  'QATAR': 'QA',
  'QAT': 'QA',
  'QA': 'QA',
  'SAUDI ARABIA': 'SA',
  'SAU': 'SA',
  'SA': 'SA',
};

export function normalizeCountryCode(val: unknown): string {
  if (typeof val !== 'string') return 'US';
  const clean = val.trim().toUpperCase();
  if (COMMON_COUNTRY_MAP[clean]) return COMMON_COUNTRY_MAP[clean];
  if (clean.length === 2) return clean;
  return clean.slice(0, 2);
}

export const businessProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Business name is required')
    .max(100, 'Business name cannot exceed 100 characters'),
  businessType: z.enum(BUSINESS_TYPES, {
    message: 'Please select a valid business type',
  }),
  description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
  countryCode: z
    .string()
    .trim()
    .transform(normalizeCountryCode)
    .pipe(z.string().length(2, 'Country code must be 2 characters (e.g. LK, US)'))
    .default('US'),
  defaultCurrency: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .pipe(z.string().length(3, 'Currency must be 3 characters (e.g. LKR, USD)'))
    .default('USD'),
  timezone: z.string().trim().min(1, 'Timezone is required').default('UTC'),
});

export const contactLocationSchema = z.object({
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().trim().max(30, 'Phone number cannot exceed 30 characters').optional().nullable().or(z.literal('')),
  website: z.string().trim().max(200, 'Website URL cannot exceed 200 characters').optional().nullable().or(z.literal('')),
  addressLine1: z.string().trim().max(200).optional().nullable().or(z.literal('')),
  addressLine2: z.string().trim().max(200).optional().nullable().or(z.literal('')),
  city: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  region: z.string().trim().max(100).optional().nullable().or(z.literal('')),
  postalCode: z.string().trim().max(20).optional().nullable().or(z.literal('')),
  branchName: z.string().trim().min(1, 'Branch name is required').max(100).default('Main Branch'),
  branchCode: z.string().trim().min(1, 'Branch code is required').max(30).default('MAIN'),
});

export const operatingDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean().default(false),
  opensAt: z.string().default('08:00'),
  closesAt: z.string().default('22:00'),
}).refine((data) => {
  if (data.isClosed) return true;
  return typeof data.opensAt === 'string' && typeof data.closesAt === 'string' && data.opensAt.trim().length > 0 && data.closesAt.trim().length > 0;
}, {
  message: 'Valid opening and closing times are required',
  path: ['closesAt'],
});

export const operatingHoursSchema = z.object({
  hours: z.array(operatingDaySchema).length(7, 'Operating hours must cover all 7 days of the week'),
});

export const brandingSchema = z.object({
  logoUrl: z.string().optional().nullable(),
});

export const fullOnboardingSchema = z.object({
  business: businessProfileSchema,
  location: contactLocationSchema,
  hours: operatingHoursSchema,
  branding: brandingSchema,
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
export type ContactLocationInput = z.infer<typeof contactLocationSchema>;
export type OperatingDayInput = z.infer<typeof operatingDaySchema>;
export type OperatingHoursInput = z.infer<typeof operatingHoursSchema>;
export type BrandingInput = z.infer<typeof brandingSchema>;
export type FullOnboardingPayload = z.infer<typeof fullOnboardingSchema>;
