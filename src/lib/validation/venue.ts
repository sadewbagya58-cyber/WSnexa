import { z } from 'zod';

export const venueTypeEnum = z.enum([
  'restaurant',
  'hotel',
  'cafe',
  'resort',
  'villa',
  'guest_house',
  'food_court',
  'cloud_kitchen',
  'other',
]);

export type VenueType = z.infer<typeof venueTypeEnum>;

export const venueProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(100, 'Display name too long'),
  slug: z
    .string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(120, 'Slug too long')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  shortDescription: z.string().max(300, 'Short description too long').optional().nullable(),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  venueType: venueTypeEnum.default('restaurant'),
  logoUrl: z.string().url('Invalid logo URL').optional().nullable().or(z.literal('')),
  coverImageUrl: z.string().url('Invalid cover image URL').optional().nullable().or(z.literal('')),
  phonePublic: z.string().max(30, 'Phone too long').optional().nullable().or(z.literal('')),
  emailPublic: z.string().email('Invalid public email').optional().nullable().or(z.literal('')),
  websiteUrl: z.string().url('Invalid website URL').optional().nullable().or(z.literal('')),
  addressPublic: z.string().max(200, 'Address too long').optional().nullable().or(z.literal('')),
  city: z.string().trim().min(1, 'City is required').max(100, 'City too long'),
  country: z.string().length(2, 'Country code must be 2 letters').default('US'),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  priceLevel: z.number().int().min(1).max(4).default(2),
  isPublished: z.boolean().default(false),
  isAcceptingOrders: z.boolean().default(true),
  featuredBranchId: z.string().uuid('Invalid featured branch ID').optional().nullable(),
});

export type VenueProfileInput = z.infer<typeof venueProfileSchema>;

export const venueSearchQuerySchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  priceLevel: z.number().int().min(1).max(4).optional(),
  city: z.string().optional(),
  acceptingOrdersOnly: z.boolean().optional(),
  minRating: z.number().min(0).max(5).optional(),
  sort: z.enum(['recommended', 'rating', 'reviews', 'newest']).default('recommended'),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(12),
});

export type VenueSearchQuery = z.infer<typeof venueSearchQuerySchema>;

export const createReviewSchema = z.object({
  venueProfileId: z.string().uuid('Invalid venue profile ID'),
  orderId: z.string().uuid('Invalid order ID'),
  rating: z.number().int().min(1, 'Rating must be at least 1 star').max(5, 'Rating cannot exceed 5 stars'),
  reviewText: z.string().max(1000, 'Review text cannot exceed 1000 characters').optional().nullable(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = z.object({
  reviewId: z.string().uuid('Invalid review ID'),
  rating: z.number().int().min(1, 'Rating must be at least 1 star').max(5, 'Rating cannot exceed 5 stars'),
  reviewText: z.string().max(1000, 'Review text cannot exceed 1000 characters').optional().nullable(),
});

export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const ownerReviewResponseSchema = z.object({
  reviewId: z.string().uuid('Invalid review ID'),
  response: z.string().trim().min(1, 'Response text cannot be empty').max(1000, 'Response text cannot exceed 1000 characters'),
});

export type OwnerReviewResponseInput = z.infer<typeof ownerReviewResponseSchema>;
