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
  countryCode: z.string().trim().length(2, 'Country code must be 2 characters (e.g. US)').default('US'),
  defaultCurrency: z.string().trim().length(3, 'Currency must be 3 characters (e.g. USD)').default('USD'),
  timezone: z.string().trim().min(1, 'Timezone is required').default('UTC'),
});

export const contactLocationSchema = z.object({
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().trim().max(30, 'Phone number cannot exceed 30 characters').optional().or(z.literal('')),
  website: z.string().trim().max(200, 'Website URL cannot exceed 200 characters').optional().or(z.literal('')),
  addressLine1: z.string().trim().max(200).optional().or(z.literal('')),
  addressLine2: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  region: z.string().trim().max(100).optional().or(z.literal('')),
  postalCode: z.string().trim().max(20).optional().or(z.literal('')),
  branchName: z.string().trim().min(1).max(100).default('Main Branch'),
  branchCode: z.string().trim().min(1).max(30).default('MAIN'),
});

export const operatingDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean().default(false),
  opensAt: z.string().default('08:00'),
  closesAt: z.string().default('22:00'),
}).refine((data) => {
  if (data.isClosed) return true;
  return data.closesAt > data.opensAt;
}, {
  message: 'Closing time must be after opening time',
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
