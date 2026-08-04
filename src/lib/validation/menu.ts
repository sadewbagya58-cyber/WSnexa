import { z } from 'zod';

export const AVAILABILITY_STATUSES = ['available', 'out_of_stock', 'hidden'] as const;

export const createMenuCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name is required')
    .max(100, 'Category name cannot exceed 100 characters'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  imageUrl: z.string().trim().optional().or(z.literal('')),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateMenuCategorySchema = createMenuCategorySchema.partial().extend({
  id: z.string().uuid('Invalid category ID'),
});

export const createMenuItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Menu item name is required')
    .max(100, 'Menu item name cannot exceed 100 characters'),
  categoryId: z.string().uuid('Please select a valid menu category'),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  price: z
    .number({ message: 'Price must be a valid number' })
    .min(0, 'Price cannot be negative'),
  currency: z.string().trim().length(3).default('USD'),
  preparationTimeMinutes: z.number().int().min(0).optional().nullable(),
  availabilityStatus: z.enum(AVAILABILITY_STATUSES).default('available'),
  isFeatured: z.boolean().default(false),
  displayOrder: z.number().int().min(0).default(0),
  primaryImageUrl: z.string().trim().optional().nullable(),
});

export const updateMenuItemSchema = createMenuItemSchema.partial().extend({
  id: z.string().uuid('Invalid menu item ID'),
});

export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
