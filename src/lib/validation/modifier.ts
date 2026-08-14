import { z } from 'zod';

export const MODIFIER_SELECTION_TYPES = ['single', 'multiple'] as const;

export const createModifierGroupSchema = z
  .object({
    menuItemId: z.string().uuid('Please select a valid menu item'),
    name: z
      .string()
      .trim()
      .min(1, 'Modifier group name is required')
      .max(100, 'Group name cannot exceed 100 characters'),
    description: z.string().trim().max(500).optional().or(z.literal('')),
    selectionType: z.enum(MODIFIER_SELECTION_TYPES).default('single'),
    isRequired: z.boolean().default(false),
    minSelections: z.number().int().min(0, 'Minimum selections cannot be negative').default(0),
    maxSelections: z.number().int().min(1, 'Maximum selections must be at least 1').optional().nullable(),
    displayOrder: z.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.selectionType === 'single') {
        return data.maxSelections === null || data.maxSelections === undefined || data.maxSelections === 1;
      }
      return true;
    },
    {
      message: 'Single-selection groups cannot have maximum selections greater than 1',
      path: ['maxSelections'],
    }
  )
  .refine(
    (data) => {
      if (data.isRequired) {
        return data.minSelections >= 1;
      }
      return true;
    },
    {
      message: 'Required modifier groups must require at least 1 selection (minSelections >= 1)',
      path: ['minSelections'],
    }
  )
  .refine(
    (data) => {
      if (data.maxSelections !== null && data.maxSelections !== undefined) {
        return data.minSelections <= data.maxSelections;
      }
      return true;
    },
    {
      message: 'Minimum selections cannot exceed maximum selections',
      path: ['minSelections'],
    }
  );

export const updateModifierGroupSchema = z
  .object({
    id: z.string().uuid('Invalid modifier group ID'),
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    selectionType: z.enum(MODIFIER_SELECTION_TYPES).optional(),
    isRequired: z.boolean().optional(),
    minSelections: z.number().int().min(0).optional(),
    maxSelections: z.number().int().min(1).optional().nullable(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.minSelections !== undefined && data.maxSelections !== undefined && data.maxSelections !== null) {
        return data.minSelections <= data.maxSelections;
      }
      return true;
    },
    {
      message: 'Minimum selections cannot exceed maximum selections',
      path: ['minSelections'],
    }
  );

export const createModifierOptionSchema = z.object({
  modifierGroupId: z.string().uuid('Please select a valid modifier group'),
  name: z
    .string()
    .trim()
    .min(1, 'Option name is required')
    .max(100, 'Option name cannot exceed 100 characters'),
  additionalPrice: z
    .number({ message: 'Additional price must be a valid number' })
    .min(0, 'Additional price cannot be negative')
    .default(0),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateModifierOptionSchema = z.object({
  id: z.string().uuid('Invalid modifier option ID'),
  name: z.string().trim().min(1).max(100).optional(),
  additionalPrice: z.number().min(0).optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type CreateModifierGroupInput = z.infer<typeof createModifierGroupSchema>;
export type UpdateModifierGroupInput = z.infer<typeof updateModifierGroupSchema>;
export type CreateModifierOptionInput = z.infer<typeof createModifierOptionSchema>;
export type UpdateModifierOptionInput = z.infer<typeof updateModifierOptionSchema>;
