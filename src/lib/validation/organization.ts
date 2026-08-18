import { z } from 'zod';

// ==========================================
// 1. Enums & Constants
// ==========================================

export const organizationUnitTypeEnum = z.enum([
  'team',
  'area',
  'section',
  'station',
  'outlet',
  'operational_unit',
  'other',
]);
export type OrganizationUnitType = z.infer<typeof organizationUnitTypeEnum>;

export const organizationPositionStatusEnum = z.enum([
  'active',
  'vacant',
  'frozen',
  'archived',
]);
export type OrganizationPositionStatus = z.infer<typeof organizationPositionStatusEnum>;

export const staffAssignmentTypeEnum = z.enum([
  'primary',
  'additional',
  'cross_property',
  'temporary',
  'acting',
  'secondment',
]);
export type StaffAssignmentType = z.infer<typeof staffAssignmentTypeEnum>;

export const staffAssignmentStatusEnum = z.enum([
  'active',
  'ended',
  'cancelled',
  'scheduled',
]);
export type StaffAssignmentStatus = z.infer<typeof staffAssignmentStatusEnum>;

export const assignmentTransitionTypeEnum = z.enum([
  'promotion',
  'transfer',
  'reorganization',
  'demotion',
  'other',
]);
export type AssignmentTransitionType = z.infer<typeof assignmentTransitionTypeEnum>;

// Helper to coerce empty string to null/undefined
const emptyStringToNull = z.literal('').transform(() => null);
const optionalNullableUuid = z
  .union([z.string().uuid(), emptyStringToNull, z.null(), z.undefined()])
  .optional();
const optionalNullableString = z
  .union([z.string().trim(), emptyStringToNull, z.null(), z.undefined()])
  .optional();

// ==========================================
// 2. Hierarchy Levels Validation
// ==========================================

export const createHierarchyLevelSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  name: z.string().trim().min(1, 'Level name is required').max(100, 'Level name must be <= 100 characters'),
  rank: z.number().int('Rank must be an integer').min(1, 'Rank must be at least 1'),
  isManagement: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type CreateHierarchyLevelInput = z.input<typeof createHierarchyLevelSchema>;

export const updateHierarchyLevelSchema = z.object({
  id: z.string().uuid('Invalid hierarchy level ID'),
  name: z.string().trim().min(1, 'Level name is required').max(100).optional(),
  rank: z.number().int().min(1).optional(),
  isManagement: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateHierarchyLevelInput = z.input<typeof updateHierarchyLevelSchema>;

// ==========================================
// 3. Departments Validation
// ==========================================

export const createDepartmentSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  branchId: optionalNullableUuid,
  parentDepartmentId: optionalNullableUuid,
  name: z.string().trim().min(1, 'Department name is required').max(100),
  code: optionalNullableString,
  departmentType: optionalNullableString,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type CreateDepartmentInput = z.input<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  id: z.string().uuid('Invalid department ID'),
  branchId: optionalNullableUuid,
  parentDepartmentId: optionalNullableUuid,
  name: z.string().trim().min(1).max(100).optional(),
  code: optionalNullableString,
  departmentType: optionalNullableString,
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateDepartmentInput = z.input<typeof updateDepartmentSchema>;

// ==========================================
// 4. Organization Units Validation
// ==========================================

export const createOrganizationUnitSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  branchId: optionalNullableUuid,
  departmentId: z.string().uuid('Invalid department ID'),
  parentUnitId: optionalNullableUuid,
  unitType: organizationUnitTypeEnum,
  name: z.string().trim().min(1, 'Unit name is required').max(100),
  code: optionalNullableString,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type CreateOrganizationUnitInput = z.input<typeof createOrganizationUnitSchema>;

export const updateOrganizationUnitSchema = z.object({
  id: z.string().uuid('Invalid unit ID'),
  branchId: optionalNullableUuid,
  departmentId: z.string().uuid().optional(),
  parentUnitId: optionalNullableUuid,
  unitType: organizationUnitTypeEnum.optional(),
  name: z.string().trim().min(1).max(100).optional(),
  code: optionalNullableString,
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateOrganizationUnitInput = z.input<typeof updateOrganizationUnitSchema>;

// ==========================================
// 5. Job Titles Validation
// ==========================================

export const createJobTitleSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  name: z.string().trim().min(1, 'Job title name is required').max(100),
  code: optionalNullableString,
  hierarchyLevelId: z.string().uuid('Invalid hierarchy level ID'),
  departmentType: optionalNullableString,
  description: optionalNullableString,
  isManagement: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type CreateJobTitleInput = z.input<typeof createJobTitleSchema>;

export const updateJobTitleSchema = z.object({
  id: z.string().uuid('Invalid job title ID'),
  name: z.string().trim().min(1).max(100).optional(),
  code: optionalNullableString,
  hierarchyLevelId: z.string().uuid().optional(),
  departmentType: optionalNullableString,
  description: optionalNullableString,
  isManagement: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateJobTitleInput = z.input<typeof updateJobTitleSchema>;

// ==========================================
// 6. Positions Validation
// ==========================================

export const createPositionSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  branchId: optionalNullableUuid,
  departmentId: optionalNullableUuid,
  unitId: optionalNullableUuid,
  jobTitleId: z.string().uuid('Invalid job title ID'),
  positionCode: optionalNullableString,
  nameOverride: optionalNullableString,
  status: organizationPositionStatusEnum.default('active'),
  headcountLimit: z.number().int('Headcount limit must be integer').min(1, 'Headcount limit must be at least 1').default(1),
  isActive: z.boolean().default(true),
});
export type CreatePositionInput = z.input<typeof createPositionSchema>;

export const updatePositionSchema = z.object({
  id: z.string().uuid('Invalid position ID'),
  branchId: optionalNullableUuid,
  departmentId: optionalNullableUuid,
  unitId: optionalNullableUuid,
  jobTitleId: z.string().uuid().optional(),
  positionCode: optionalNullableString,
  nameOverride: optionalNullableString,
  status: organizationPositionStatusEnum.optional(),
  headcountLimit: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePositionInput = z.input<typeof updatePositionSchema>;

// ==========================================
// 7. Staff Assignments Validation
// ==========================================

export const createStaffAssignmentSchema = z
  .object({
    businessId: z.string().uuid('Invalid business ID'),
    businessMembershipId: z.string().uuid('Invalid business membership ID'),
    branchId: optionalNullableUuid,
    departmentId: optionalNullableUuid,
    unitId: optionalNullableUuid,
    positionId: optionalNullableUuid,
    jobTitleId: z.string().uuid('Invalid job title ID'),
    assignmentType: staffAssignmentTypeEnum.default('primary'),
    isPrimary: z.boolean().optional(),
    status: staffAssignmentStatusEnum.default('active'),
    startsAt: z.union([z.string().datetime(), z.date()]).default(() => new Date().toISOString()),
    endsAt: z.union([z.string().datetime(), z.date(), emptyStringToNull, z.null(), z.undefined()]).optional(),
    actingForAssignmentId: optionalNullableUuid,
    reportsToAssignmentId: optionalNullableUuid,
    reason: optionalNullableString,
  })
  .transform((data) => {
    // Canonical parity sync: assignment_type = 'primary' iff is_primary = true
    const isPrimaryComputed = data.isPrimary !== undefined ? data.isPrimary : data.assignmentType === 'primary';
    const assignmentTypeComputed = (isPrimaryComputed ? 'primary' : (data.assignmentType === 'primary' ? 'additional' : data.assignmentType)) as StaffAssignmentType;
    return {
      ...data,
      isPrimary: isPrimaryComputed,
      assignmentType: assignmentTypeComputed,
    };
  })
  .refine(
    (data) => {
      if (!data.endsAt) return true;
      const start = new Date(data.startsAt).getTime();
      const end = new Date(data.endsAt).getTime();
      return end > start;
    },
    {
      message: 'End date must be strictly after start date',
      path: ['endsAt'],
    }
  )
  .refine(
    (data) => (data.assignmentType === 'primary' && data.isPrimary === true) || (data.assignmentType !== 'primary' && data.isPrimary === false),
    {
      message: 'assignment_type must be "primary" if and only if is_primary is true',
      path: ['assignmentType'],
    }
  );
export type CreateStaffAssignmentInput = z.input<typeof createStaffAssignmentSchema>;

export const createAdditionalAssignmentSchema = z
  .object({
    businessId: z.string().uuid('Invalid business ID'),
    businessMembershipId: z.string().uuid('Invalid business membership ID'),
    branchId: optionalNullableUuid,
    departmentId: optionalNullableUuid,
    unitId: optionalNullableUuid,
    positionId: optionalNullableUuid,
    jobTitleId: z.string().uuid('Invalid job title ID'),
    assignmentType: z.enum(['additional', 'cross_property', 'temporary', 'acting', 'secondment']).default('additional'),
    status: staffAssignmentStatusEnum.default('active'),
    startsAt: z.union([z.string().datetime(), z.date()]).default(() => new Date().toISOString()),
    endsAt: z.union([z.string().datetime(), z.date(), emptyStringToNull, z.null(), z.undefined()]).optional(),
    actingForAssignmentId: optionalNullableUuid,
    reportsToAssignmentId: optionalNullableUuid,
    reason: optionalNullableString,
  })
  .transform((data) => ({
    ...data,
    isPrimary: false,
    assignmentType: data.assignmentType as StaffAssignmentType,
  }))
  .refine(
    (data) => {
      if (!data.endsAt) return true;
      const start = new Date(data.startsAt).getTime();
      const end = new Date(data.endsAt).getTime();
      return end > start;
    },
    {
      message: 'End date must be strictly after start date',
      path: ['endsAt'],
    }
  );
export type CreateAdditionalAssignmentInput = z.input<typeof createAdditionalAssignmentSchema>;

export const updateStaffAssignmentSchema = z
  .object({
    id: z.string().uuid('Invalid staff assignment ID'),
    branchId: optionalNullableUuid,
    departmentId: optionalNullableUuid,
    unitId: optionalNullableUuid,
    positionId: optionalNullableUuid,
    jobTitleId: z.string().uuid().optional(),
    assignmentType: staffAssignmentTypeEnum.optional(),
    isPrimary: z.boolean().optional(),
    status: staffAssignmentStatusEnum.optional(),
    startsAt: z.union([z.string().datetime(), z.date()]).optional(),
    endsAt: z.union([z.string().datetime(), z.date(), emptyStringToNull, z.null(), z.undefined()]).optional(),
    actingForAssignmentId: optionalNullableUuid,
    reportsToAssignmentId: optionalNullableUuid,
    reason: optionalNullableString,
  })
  .transform((data) => {
    let isPrimaryComputed = data.isPrimary;
    let assignmentTypeComputed = data.assignmentType as StaffAssignmentType | undefined;

    if (isPrimaryComputed !== undefined && assignmentTypeComputed === undefined) {
      assignmentTypeComputed = isPrimaryComputed ? 'primary' : 'additional';
    } else if (assignmentTypeComputed !== undefined && isPrimaryComputed === undefined) {
      isPrimaryComputed = assignmentTypeComputed === 'primary';
    }

    return {
      ...data,
      isPrimary: isPrimaryComputed,
      assignmentType: assignmentTypeComputed,
    };
  })
  .refine(
    (data) => {
      if (!data.startsAt || !data.endsAt) return true;
      const start = new Date(data.startsAt).getTime();
      const end = new Date(data.endsAt).getTime();
      return end > start;
    },
    {
      message: 'End date must be strictly after start date',
      path: ['endsAt'],
    }
  )
  .refine(
    (data) => {
      if (data.assignmentType === undefined && data.isPrimary === undefined) return true;
      return (data.assignmentType === 'primary' && data.isPrimary === true) || (data.assignmentType !== 'primary' && data.isPrimary === false);
    },
    {
      message: 'assignment_type must be "primary" if and only if is_primary is true',
      path: ['assignmentType'],
    }
  );
export type UpdateStaffAssignmentInput = z.input<typeof updateStaffAssignmentSchema>;

export const endStaffAssignmentSchema = z.object({
  id: z.string().uuid('Invalid staff assignment ID'),
  endedAt: z.union([z.string().datetime(), z.date()]).default(() => new Date().toISOString()),
  reason: optionalNullableString,
});
export type EndStaffAssignmentInput = z.input<typeof endStaffAssignmentSchema>;

// ==========================================
// 8. Primary Assignment Transition Validation
// ==========================================

export const transitionPrimaryAssignmentSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  currentAssignmentId: z.string().uuid('Invalid current assignment ID'),
  newPositionId: optionalNullableUuid,
  newJobTitleId: optionalNullableUuid,
  newBranchId: optionalNullableUuid,
  newDepartmentId: optionalNullableUuid,
  newUnitId: optionalNullableUuid,
  newReportsToId: optionalNullableUuid,
  transitionType: assignmentTransitionTypeEnum.default('promotion'),
  reason: optionalNullableString,
  transitionTime: z.union([z.string().datetime(), z.date()]).default(() => new Date().toISOString()),
});
export type TransitionPrimaryAssignmentInput = z.input<typeof transitionPrimaryAssignmentSchema>;

// ==========================================
// 9. Reporting Manager Validation
// ==========================================

export const setReportingManagerSchema = z.object({
  businessId: z.string().uuid('Invalid business ID'),
  assignmentId: z.string().uuid('Invalid staff assignment ID'),
  reportsToAssignmentId: optionalNullableUuid,
  reason: optionalNullableString,
});
export type SetReportingManagerInput = z.input<typeof setReportingManagerSchema>;
