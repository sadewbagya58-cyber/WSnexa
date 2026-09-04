import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import {
  CreateHierarchyLevelInput,
  UpdateHierarchyLevelInput,
  CreateDepartmentInput,
  UpdateDepartmentInput,
  CreateOrganizationUnitInput,
  UpdateOrganizationUnitInput,
  CreateJobTitleInput,
  UpdateJobTitleInput,
  CreatePositionInput,
  UpdatePositionInput,
  CreateStaffAssignmentInput,
  CreateAdditionalAssignmentInput,
  UpdateStaffAssignmentInput,
  EndStaffAssignmentInput,
  TransitionPrimaryAssignmentInput,
  SetReportingManagerInput,
  CreateAssignmentAbsenceInput,
  EndAssignmentAbsenceInput,
  CreateActingAssignmentInput,
  ExtendActingAssignmentInput,
  EndActingAssignmentInput,
  CreateSecondmentInput,
  ExtendSecondmentInput,
  EndSecondmentInput,
  CreateTemporaryAssignmentInput,
  EndTemporaryAssignmentInput,
  createHierarchyLevelSchema,
  updateHierarchyLevelSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
  createOrganizationUnitSchema,
  updateOrganizationUnitSchema,
  createJobTitleSchema,
  updateJobTitleSchema,
  createPositionSchema,
  updatePositionSchema,
  createStaffAssignmentSchema,
  createAdditionalAssignmentSchema,
  updateStaffAssignmentSchema,
  endStaffAssignmentSchema,
  transitionPrimaryAssignmentSchema,
  setReportingManagerSchema,
  createAssignmentAbsenceSchema,
  endAssignmentAbsenceSchema,
  createActingAssignmentSchema,
  extendActingAssignmentSchema,
  endActingAssignmentSchema,
  createSecondmentSchema,
  extendSecondmentSchema,
  endSecondmentSchema,
  createTemporaryAssignmentSchema,
  endTemporaryAssignmentSchema,
} from '@/lib/validation/organization';

// Default standard hierarchy levels
export const DEFAULT_ORGANIZATION_HIERARCHY_LEVELS = [
  { rank: 1, name: 'Owner / Board', isManagement: true },
  { rank: 2, name: 'Executive', isManagement: true },
  { rank: 3, name: 'Group / Regional Management', isManagement: true },
  { rank: 4, name: 'General Management', isManagement: true },
  { rank: 5, name: 'Department Leadership', isManagement: true },
  { rank: 6, name: 'Management', isManagement: true },
  { rank: 7, name: 'Supervisory', isManagement: false },
  { rank: 8, name: 'Operational', isManagement: false },
];

export interface ReportingTreeNode {
  assignment: Record<string, unknown>;
  directReports: ReportingTreeNode[];
}

export interface EffectiveReportingTreeNode {
  assignment: Record<string, unknown>;
  isActingCoverage?: boolean;
  substantiveManagerId?: string | null;
  directReports: EffectiveReportingTreeNode[];
}

export class OrganizationService {
  // ==========================================
  // 1. Internal Validation Helpers
  // ==========================================

  static async validateBranchBelongsToBusiness(branchId: string, businessId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data } = await admin
      .from('branches')
      .select('business_id')
      .eq('id', branchId)
      .maybeSingle();

    return !!data && data.business_id === businessId;
  }

  static async validateDepartmentBelongsToBusiness(departmentId: string, businessId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data } = await admin
      .from('organization_departments')
      .select('business_id')
      .eq('id', departmentId)
      .maybeSingle();

    return !!data && data.business_id === businessId;
  }

  static async validateUnitBelongsToBusiness(unitId: string, businessId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data } = await admin
      .from('organization_units')
      .select('business_id')
      .eq('id', unitId)
      .maybeSingle();

    return !!data && data.business_id === businessId;
  }

  static async validateJobTitleBelongsToBusiness(jobTitleId: string, businessId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data } = await admin
      .from('organization_job_titles')
      .select('business_id')
      .eq('id', jobTitleId)
      .maybeSingle();

    return !!data && data.business_id === businessId;
  }

  static async validatePositionBelongsToBusiness(positionId: string, businessId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data } = await admin
      .from('organization_positions')
      .select('business_id')
      .eq('id', positionId)
      .maybeSingle();

    return !!data && data.business_id === businessId;
  }

  static async validateMembershipBelongsToBusiness(membershipId: string, businessId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data } = await admin
      .from('business_memberships')
      .select('business_id')
      .eq('id', membershipId)
      .maybeSingle();

    return !!data && data.business_id === businessId;
  }

  // ==========================================
  // 2. Hierarchy Levels
  // ==========================================

  static async seedDefaultHierarchyLevels(businessId: string) {
    const admin = createAdminClient();
    const levelsToInsert = DEFAULT_ORGANIZATION_HIERARCHY_LEVELS.map((lvl) => ({
      business_id: businessId,
      name: lvl.name,
      rank: lvl.rank,
      is_management: lvl.isManagement,
      is_active: true,
    }));

    const { data, error } = await admin
      .from('organization_hierarchy_levels')
      .upsert(levelsToInsert, { onConflict: 'business_id,rank' })
      .select();

    if (error) {
      throw new Error(`Failed to seed hierarchy levels: ${error.message}`);
    }
    return data;
  }

  static async ensureDefaultHierarchyLevels(businessId: string) {
    return this.seedDefaultHierarchyLevels(businessId);
  }

  static async getHierarchyLevels(businessId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_hierarchy_levels')
      .select('*')
      .eq('business_id', businessId)
      .order('rank', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch hierarchy levels: ${error.message}`);
    }
    return data || [];
  }

  static async createHierarchyLevel(input: CreateHierarchyLevelInput) {
    const parsed = createHierarchyLevelSchema.parse(input);
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('organization_hierarchy_levels')
      .insert({
        business_id: parsed.businessId,
        name: parsed.name,
        rank: parsed.rank,
        is_management: parsed.isManagement,
        is_active: parsed.isActive,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create hierarchy level: ${error.message}`);
    }
    return data;
  }

  static async updateHierarchyLevel(input: UpdateHierarchyLevelInput) {
    const parsed = updateHierarchyLevelSchema.parse(input);
    const admin = createAdminClient();

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.name !== undefined) updatePayload.name = parsed.name;
    if (parsed.rank !== undefined) updatePayload.rank = parsed.rank;
    if (parsed.isManagement !== undefined) updatePayload.is_management = parsed.isManagement;
    if (parsed.isActive !== undefined) updatePayload.is_active = parsed.isActive;

    const { data, error } = await admin
      .from('organization_hierarchy_levels')
      .update(updatePayload)
      .eq('id', parsed.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update hierarchy level: ${error.message}`);
    }
    return data;
  }

  // ==========================================
  // 3. Departments
  // ==========================================

  static async createDepartment(input: CreateDepartmentInput) {
    const parsed = createDepartmentSchema.parse(input);
    const admin = createAdminClient();

    if (parsed.branchId) {
      const valid = await this.validateBranchBelongsToBusiness(parsed.branchId, parsed.businessId);
      if (!valid) throw new Error('Branch does not belong to the specified business');
    }

    if (parsed.parentDepartmentId) {
      const valid = await this.validateDepartmentBelongsToBusiness(parsed.parentDepartmentId, parsed.businessId);
      if (!valid) throw new Error('Parent department does not belong to the specified business');
    }

    const { data, error } = await admin
      .from('organization_departments')
      .insert({
        business_id: parsed.businessId,
        branch_id: parsed.branchId || null,
        parent_department_id: parsed.parentDepartmentId || null,
        name: parsed.name,
        code: parsed.code || null,
        department_type: parsed.departmentType || null,
        is_active: parsed.isActive,
        sort_order: parsed.sortOrder,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create department: ${error.message}`);
    return data;
  }

  static async updateDepartment(input: UpdateDepartmentInput) {
    const parsed = updateDepartmentSchema.parse(input);
    const admin = createAdminClient();

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.branchId !== undefined) updatePayload.branch_id = parsed.branchId;
    if (parsed.parentDepartmentId !== undefined) updatePayload.parent_department_id = parsed.parentDepartmentId;
    if (parsed.name !== undefined) updatePayload.name = parsed.name;
    if (parsed.code !== undefined) updatePayload.code = parsed.code;
    if (parsed.departmentType !== undefined) updatePayload.department_type = parsed.departmentType;
    if (parsed.isActive !== undefined) updatePayload.is_active = parsed.isActive;
    if (parsed.sortOrder !== undefined) updatePayload.sort_order = parsed.sortOrder;

    const { data, error } = await admin
      .from('organization_departments')
      .update(updatePayload)
      .eq('id', parsed.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update department: ${error.message}`);
    return data;
  }

  static async getDepartments(businessId: string, options?: { branchId?: string | null; activeOnly?: boolean }) {
    const admin = createAdminClient();
    let query = admin
      .from('organization_departments')
      .select(`
        *,
        parent_department:organization_departments!parent_department_id(id, name, code),
        branch:branches(id, name, code)
      `)
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (options?.branchId !== undefined) {
      if (options.branchId === null) {
        query = query.is('branch_id', null);
      } else {
        query = query.eq('branch_id', options.branchId);
      }
    }
    if (options?.activeOnly) {
      query = query.eq('is_active', true).is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch departments: ${error.message}`);
    return data || [];
  }

  static async getDepartmentById(id: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_departments')
      .select(`
        *,
        parent_department:organization_departments!parent_department_id(id, name, code),
        branch:branches(id, name, code)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch department: ${error.message}`);
    return data;
  }

  // ==========================================
  // 4. Organization Units
  // ==========================================

  static async createOrganizationUnit(input: CreateOrganizationUnitInput) {
    const parsed = createOrganizationUnitSchema.parse(input);
    const admin = createAdminClient();

    const validDept = await this.validateDepartmentBelongsToBusiness(parsed.departmentId, parsed.businessId);
    if (!validDept) throw new Error('Department does not belong to the specified business');

    if (parsed.branchId) {
      const validBranch = await this.validateBranchBelongsToBusiness(parsed.branchId, parsed.businessId);
      if (!validBranch) throw new Error('Branch does not belong to the specified business');
    }

    if (parsed.parentUnitId) {
      const validParent = await this.validateUnitBelongsToBusiness(parsed.parentUnitId, parsed.businessId);
      if (!validParent) throw new Error('Parent unit does not belong to the specified business');
    }

    const { data, error } = await admin
      .from('organization_units')
      .insert({
        business_id: parsed.businessId,
        branch_id: parsed.branchId || null,
        department_id: parsed.departmentId,
        parent_unit_id: parsed.parentUnitId || null,
        unit_type: parsed.unitType,
        name: parsed.name,
        code: parsed.code || null,
        is_active: parsed.isActive,
        sort_order: parsed.sortOrder,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create organization unit: ${error.message}`);
    return data;
  }

  static async updateOrganizationUnit(input: UpdateOrganizationUnitInput) {
    const parsed = updateOrganizationUnitSchema.parse(input);
    const admin = createAdminClient();

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.branchId !== undefined) updatePayload.branch_id = parsed.branchId;
    if (parsed.departmentId !== undefined) updatePayload.department_id = parsed.departmentId;
    if (parsed.parentUnitId !== undefined) updatePayload.parent_unit_id = parsed.parentUnitId;
    if (parsed.unitType !== undefined) updatePayload.unit_type = parsed.unitType;
    if (parsed.name !== undefined) updatePayload.name = parsed.name;
    if (parsed.code !== undefined) updatePayload.code = parsed.code;
    if (parsed.isActive !== undefined) updatePayload.is_active = parsed.isActive;
    if (parsed.sortOrder !== undefined) updatePayload.sort_order = parsed.sortOrder;

    const { data, error } = await admin
      .from('organization_units')
      .update(updatePayload)
      .eq('id', parsed.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update organization unit: ${error.message}`);
    return data;
  }

  static async getOrganizationUnits(
    businessId: string,
    options?: { departmentId?: string; branchId?: string | null; activeOnly?: boolean }
  ) {
    const admin = createAdminClient();
    let query = admin
      .from('organization_units')
      .select(`
        *,
        department:organization_departments(id, name, code),
        parent_unit:organization_units!parent_unit_id(id, name, code),
        branch:branches(id, name, code)
      `)
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (options?.departmentId) {
      query = query.eq('department_id', options.departmentId);
    }
    if (options?.branchId !== undefined) {
      if (options.branchId === null) {
        query = query.is('branch_id', null);
      } else {
        query = query.eq('branch_id', options.branchId);
      }
    }
    if (options?.activeOnly) {
      query = query.eq('is_active', true).is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch organization units: ${error.message}`);
    return data || [];
  }

  static async createUnit(input: CreateOrganizationUnitInput) {
    return this.createOrganizationUnit(input);
  }

  static async updateUnit(input: UpdateOrganizationUnitInput) {
    return this.updateOrganizationUnit(input);
  }

  static async getUnits(
    businessId: string,
    options?: { departmentId?: string; branchId?: string | null; activeOnly?: boolean }
  ) {
    return this.getOrganizationUnits(businessId, options);
  }

  // ==========================================
  // 5. Job Titles
  // ==========================================

  static async createJobTitle(input: CreateJobTitleInput) {
    const parsed = createJobTitleSchema.parse(input);
    const admin = createAdminClient();

    const { data, error } = await admin
      .from('organization_job_titles')
      .insert({
        business_id: parsed.businessId,
        name: parsed.name,
        code: parsed.code || null,
        hierarchy_level_id: parsed.hierarchyLevelId,
        department_type: parsed.departmentType || null,
        description: parsed.description || null,
        is_management: parsed.isManagement,
        is_active: parsed.isActive,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create job title: ${error.message}`);
    return data;
  }

  static async updateJobTitle(input: UpdateJobTitleInput) {
    const parsed = updateJobTitleSchema.parse(input);
    const admin = createAdminClient();

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.name !== undefined) updatePayload.name = parsed.name;
    if (parsed.code !== undefined) updatePayload.code = parsed.code;
    if (parsed.hierarchyLevelId !== undefined) updatePayload.hierarchy_level_id = parsed.hierarchyLevelId;
    if (parsed.departmentType !== undefined) updatePayload.department_type = parsed.departmentType;
    if (parsed.description !== undefined) updatePayload.description = parsed.description;
    if (parsed.isManagement !== undefined) updatePayload.is_management = parsed.isManagement;
    if (parsed.isActive !== undefined) updatePayload.is_active = parsed.isActive;

    const { data, error } = await admin
      .from('organization_job_titles')
      .update(updatePayload)
      .eq('id', parsed.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update job title: ${error.message}`);
    return data;
  }

  static async getJobTitles(businessId: string, options?: { activeOnly?: boolean; hierarchyLevelId?: string }) {
    const admin = createAdminClient();
    let query = admin
      .from('organization_job_titles')
      .select(`
        *,
        hierarchy_level:organization_hierarchy_levels(id, name, rank, is_management)
      `)
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    if (options?.hierarchyLevelId) {
      query = query.eq('hierarchy_level_id', options.hierarchyLevelId);
    }
    if (options?.activeOnly) {
      query = query.eq('is_active', true).is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch job titles: ${error.message}`);
    return data || [];
  }

  // ==========================================
  // 6. Organization Positions
  // ==========================================

  static async createPosition(input: CreatePositionInput) {
    const parsed = createPositionSchema.parse(input);
    const admin = createAdminClient();

    const validJT = await this.validateJobTitleBelongsToBusiness(parsed.jobTitleId, parsed.businessId);
    if (!validJT) throw new Error('Job title does not belong to the specified business');

    if (parsed.branchId) {
      const validBranch = await this.validateBranchBelongsToBusiness(parsed.branchId, parsed.businessId);
      if (!validBranch) throw new Error('Branch does not belong to the specified business');
    }

    if (parsed.departmentId) {
      const validDept = await this.validateDepartmentBelongsToBusiness(parsed.departmentId, parsed.businessId);
      if (!validDept) throw new Error('Department does not belong to the specified business');

      const { data: dept } = await admin
        .from('organization_departments')
        .select('branch_id')
        .eq('id', parsed.departmentId)
        .maybeSingle();

      if (dept) {
        if (!parsed.branchId && dept.branch_id) {
          throw new Error('Corporate position cannot be assigned to property-scoped department');
        }
        if (parsed.branchId && dept.branch_id && dept.branch_id !== parsed.branchId) {
          throw new Error(`Position branch ${parsed.branchId} does not match department branch ${dept.branch_id}`);
        }
      }
    }

    if (parsed.unitId) {
      const validUnit = await this.validateUnitBelongsToBusiness(parsed.unitId, parsed.businessId);
      if (!validUnit) throw new Error('Unit does not belong to the specified business');

      const { data: unit } = await admin
        .from('organization_units')
        .select('branch_id, department_id')
        .eq('id', parsed.unitId)
        .maybeSingle();

      if (unit) {
        if (!parsed.branchId && unit.branch_id) {
          throw new Error('Corporate position cannot be assigned to property-scoped unit');
        }
        if (parsed.branchId && unit.branch_id && unit.branch_id !== parsed.branchId) {
          throw new Error(`Position branch ${parsed.branchId} does not match unit branch ${unit.branch_id}`);
        }
        if (parsed.departmentId && unit.department_id !== parsed.departmentId) {
          throw new Error(`Position unit ${parsed.unitId} department ${unit.department_id} does not match position department ${parsed.departmentId}`);
        }
      }
    }

    const { data, error } = await admin
      .from('organization_positions')
      .insert({
        business_id: parsed.businessId,
        branch_id: parsed.branchId || null,
        department_id: parsed.departmentId || null,
        unit_id: parsed.unitId || null,
        job_title_id: parsed.jobTitleId,
        position_code: parsed.positionCode || null,
        name_override: parsed.nameOverride || null,
        status: parsed.status,
        headcount_limit: parsed.headcountLimit,
        is_active: parsed.isActive,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create position: ${error.message}`);
    return data;
  }

  static async updatePosition(input: UpdatePositionInput) {
    const parsed = updatePositionSchema.parse(input);
    const admin = createAdminClient();

    // If changing branch, department, or unit, validate consistency
    if (parsed.branchId !== undefined || parsed.departmentId !== undefined || parsed.unitId !== undefined) {
      const { data: currentPos } = await admin
        .from('organization_positions')
        .select('branch_id, department_id, unit_id')
        .eq('id', parsed.id)
        .maybeSingle();

      const effectiveBranchId = parsed.branchId !== undefined ? parsed.branchId : (currentPos?.branch_id || null);
      const effectiveDeptId = parsed.departmentId !== undefined ? parsed.departmentId : (currentPos?.department_id || null);
      const effectiveUnitId = parsed.unitId !== undefined ? parsed.unitId : (currentPos?.unit_id || null);

      if (effectiveDeptId) {
        const { data: dept } = await admin
          .from('organization_departments')
          .select('branch_id')
          .eq('id', effectiveDeptId)
          .maybeSingle();

        if (dept) {
          if (!effectiveBranchId && dept.branch_id) {
            throw new Error('Corporate position cannot be assigned to property-scoped department');
          }
          if (effectiveBranchId && dept.branch_id && dept.branch_id !== effectiveBranchId) {
            throw new Error(`Position branch ${effectiveBranchId} does not match department branch ${dept.branch_id}`);
          }
        }
      }

      if (effectiveUnitId) {
        const { data: unit } = await admin
          .from('organization_units')
          .select('branch_id, department_id')
          .eq('id', effectiveUnitId)
          .maybeSingle();

        if (unit) {
          if (!effectiveBranchId && unit.branch_id) {
            throw new Error('Corporate position cannot be assigned to property-scoped unit');
          }
          if (effectiveBranchId && unit.branch_id && unit.branch_id !== effectiveBranchId) {
            throw new Error(`Position branch ${effectiveBranchId} does not match unit branch ${unit.branch_id}`);
          }
          if (effectiveDeptId && unit.department_id !== effectiveDeptId) {
            throw new Error(`Position unit ${effectiveUnitId} department ${unit.department_id} does not match position department ${effectiveDeptId}`);
          }
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.branchId !== undefined) updatePayload.branch_id = parsed.branchId;
    if (parsed.departmentId !== undefined) updatePayload.department_id = parsed.departmentId;
    if (parsed.unitId !== undefined) updatePayload.unit_id = parsed.unitId;
    if (parsed.jobTitleId !== undefined) updatePayload.job_title_id = parsed.jobTitleId;
    if (parsed.positionCode !== undefined) updatePayload.position_code = parsed.positionCode;
    if (parsed.nameOverride !== undefined) updatePayload.name_override = parsed.nameOverride;
    if (parsed.status !== undefined) updatePayload.status = parsed.status;
    if (parsed.headcountLimit !== undefined) updatePayload.headcount_limit = parsed.headcountLimit;
    if (parsed.isActive !== undefined) updatePayload.is_active = parsed.isActive;

    const { data, error } = await admin
      .from('organization_positions')
      .update(updatePayload)
      .eq('id', parsed.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update position: ${error.message}`);
    return data;
  }

  static async getPositions(
    businessId: string,
    options?: { branchId?: string | null; departmentId?: string; status?: string; activeOnly?: boolean }
  ) {
    const admin = createAdminClient();
    let query = admin
      .from('organization_positions')
      .select(`
        *,
        job_title:organization_job_titles(id, name, code, is_management, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        department:organization_departments(id, name, code),
        unit:organization_units(id, name, code),
        branch:branches(id, name, code)
      `)
      .eq('business_id', businessId)
      .order('position_code', { ascending: true });

    if (options?.branchId !== undefined) {
      if (options.branchId === null) {
        query = query.is('branch_id', null);
      } else {
        query = query.eq('branch_id', options.branchId);
      }
    }
    if (options?.departmentId) {
      query = query.eq('department_id', options.departmentId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.activeOnly) {
      query = query.eq('is_active', true).is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch positions: ${error.message}`);
    return data || [];
  }

  static async getPositionById(id: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_positions')
      .select(`
        *,
        job_title:organization_job_titles(id, name, code, is_management, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        department:organization_departments(id, name, code),
        unit:organization_units(id, name, code),
        branch:branches(id, name, code)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch position: ${error.message}`);
    return data;
  }

  static async getPositionOccupancy(positionId: string, referenceDate: Date = new Date()) {
    const admin = createAdminClient();
    const { data: pos, error: posErr } = await admin
      .from('organization_positions')
      .select('id, headcount_limit, status, position_code, name_override, job_title_id')
      .eq('id', positionId)
      .maybeSingle();

    if (posErr) throw new Error(`Database error fetching position ${positionId}: ${posErr.message}`);
    if (!pos) throw new Error(`Position ${positionId} not found`);

    const refIso = referenceDate.toISOString();
    // Substantive occupancy includes ONLY active primary assignments of non-suspended members
    const { data: occupants, error: occErr } = await admin
      .from('staff_assignments')
      .select('id, assignment_type, is_primary, starts_at, ends_at, business_membership_id, membership:business_memberships(id, membership_status)')
      .eq('position_id', positionId)
      .eq('is_primary', true)
      .eq('status', 'active')
      .lte('starts_at', refIso)
      .or(`ends_at.is.null,ends_at.gt.${refIso}`)
      .is('archived_at', null);

    if (occErr) throw new Error(`Failed to calculate position occupancy: ${occErr.message}`);

    const activeOccupants = (occupants || []).filter((o) => {
      const m = Array.isArray(o.membership) ? o.membership[0] : o.membership;
      return !m || m.membership_status !== 'suspended';
    });

    const occupiedCount = activeOccupants.length;
    const headcountLimit = pos.headcount_limit || 1;
    const availableSlots = Math.max(0, headcountLimit - occupiedCount);
    const isFull = occupiedCount >= headcountLimit;

    return {
      positionId: pos.id,
      positionCode: pos.position_code,
      nameOverride: pos.name_override,
      status: pos.status,
      headcountLimit,
      occupiedCount,
      availableSlots,
      isFull,
      occupants: activeOccupants,
    };
  }

  static async getPositionCoverage(positionId: string, referenceDate: Date = new Date()) {
    const admin = createAdminClient();
    const { data: pos, error: posErr } = await admin
      .from('organization_positions')
      .select('id, headcount_limit, status, position_code, name_override, job_title_id')
      .eq('id', positionId)
      .maybeSingle();

    if (posErr || !pos) throw new Error(`Position ${positionId} not found`);

    const refIso = referenceDate.toISOString();

    // 1. Substantive occupants (primary / substantive only of active non-suspended members)
    const { data: rawSubstantiveOccupants } = await admin
      .from('staff_assignments')
      .select(`
        id, assignment_type, is_primary, starts_at, ends_at, business_membership_id,
        membership:business_memberships(id, user_id, role, membership_status)
      `)
      .eq('position_id', positionId)
      .eq('is_primary', true)
      .eq('status', 'active')
      .lte('starts_at', refIso)
      .or(`ends_at.is.null,ends_at.gt.${refIso}`)
      .is('archived_at', null);

    const substantiveOccupants = (rawSubstantiveOccupants || []).filter((o) => {
      const m = Array.isArray(o.membership) ? o.membership[0] : o.membership;
      return !m || m.membership_status !== 'suspended';
    });

    // 2. Active acting coverage on this position
    const { data: actingCoverage } = await admin
      .from('staff_assignments')
      .select(`
        id, assignment_type, starts_at, ends_at, acting_for_assignment_id, business_membership_id,
        membership:business_memberships(id, user_id, role)
      `)
      .eq('position_id', positionId)
      .eq('assignment_type', 'acting')
      .eq('status', 'active')
      .lte('starts_at', refIso)
      .or(`ends_at.is.null,ends_at.gt.${refIso}`)
      .is('archived_at', null);

    // 3. Active secondment assignments on this position
    const { data: secondmentAssignments } = await admin
      .from('staff_assignments')
      .select(`
        id, assignment_type, starts_at, ends_at, business_membership_id,
        membership:business_memberships(id, user_id, role)
      `)
      .eq('position_id', positionId)
      .eq('assignment_type', 'secondment')
      .eq('status', 'active')
      .lte('starts_at', refIso)
      .or(`ends_at.is.null,ends_at.gt.${refIso}`)
      .is('archived_at', null);

    // 4. Active temporary coverage assignments on this position
    const { data: temporaryAssignments } = await admin
      .from('staff_assignments')
      .select(`
        id, assignment_type, starts_at, ends_at, business_membership_id,
        membership:business_memberships(id, user_id, role)
      `)
      .eq('position_id', positionId)
      .eq('assignment_type', 'temporary')
      .eq('status', 'active')
      .lte('starts_at', refIso)
      .or(`ends_at.is.null,ends_at.gt.${refIso}`)
      .is('archived_at', null);

    const substantiveOccupiedCount = substantiveOccupants?.length || 0;
    const headcountLimit = pos.headcount_limit || 1;
    const availableSlots = Math.max(0, headcountLimit - substantiveOccupiedCount);
    const isFull = substantiveOccupiedCount >= headcountLimit;

    let coverageState: 'vacant' | 'occupied' | 'acting_covered' | 'over_capacity' | 'frozen' | 'archived' = 'vacant';
    if (pos.status === 'frozen') {
      coverageState = 'frozen';
    } else if (pos.status === 'archived') {
      coverageState = 'archived';
    } else if (substantiveOccupiedCount > headcountLimit) {
      coverageState = 'over_capacity';
    } else if ((actingCoverage?.length || 0) > 0) {
      coverageState = 'acting_covered';
    } else if (substantiveOccupiedCount > 0) {
      coverageState = 'occupied';
    } else {
      coverageState = 'vacant';
    }

    return {
      positionId: pos.id,
      positionCode: pos.position_code,
      nameOverride: pos.name_override,
      status: pos.status,
      headcountLimit,
      substantiveOccupiedCount,
      availableSlots,
      isFull,
      substantiveOccupants: substantiveOccupants || [],
      actingCoverage: actingCoverage || [],
      secondmentAssignments: secondmentAssignments || [],
      temporaryAssignments: temporaryAssignments || [],
      coverageState,
    };
  }

  private static positionLocks = new Map<string, Promise<void>>();

  private static async withPositionLock<T>(positionId: string | null | undefined, fn: () => Promise<T>): Promise<T> {
    if (!positionId) return fn();
    const currentLock = this.positionLocks.get(positionId) || Promise.resolve();
    let release: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.positionLocks.set(positionId, currentLock.then(() => nextLock));

    try {
      await currentLock;
      return await fn();
    } finally {
      release!();
      if (this.positionLocks.get(positionId) === nextLock) {
        this.positionLocks.delete(positionId);
      }
    }
  }

  // ==========================================
  // 7. Staff Assignments & Lifecycle
  // ==========================================

  static async createStaffAssignment(input: CreateStaffAssignmentInput, actorId?: string) {
    const parsed = createStaffAssignmentSchema.parse(input);
    return this.withPositionLock(parsed.positionId, async () => {
      const admin = createAdminClient();

    // 1. Validate Business Membership belongs to business
    const validMember = await this.validateMembershipBelongsToBusiness(parsed.businessMembershipId, parsed.businessId);
    if (!validMember) throw new Error('Business membership does not belong to the specified business');

    // 2. Validate Job Title belongs to business
    const validJob = await this.validateJobTitleBelongsToBusiness(parsed.jobTitleId, parsed.businessId);
    if (!validJob) throw new Error('Job title does not belong to the specified business');

    // 3. Optional Entity Scope Validations
    if (parsed.branchId) {
      const validBranch = await this.validateBranchBelongsToBusiness(parsed.branchId, parsed.businessId);
      if (!validBranch) throw new Error('Branch does not belong to the specified business');
    }
    if (parsed.departmentId) {
      const validDept = await this.validateDepartmentBelongsToBusiness(parsed.departmentId, parsed.businessId);
      if (!validDept) throw new Error('Department does not belong to the specified business');
    }
    if (parsed.unitId) {
      const validUnit = await this.validateUnitBelongsToBusiness(parsed.unitId, parsed.businessId);
      if (!validUnit) throw new Error('Unit does not belong to the specified business');
    }
    if (parsed.positionId) {
      const validPos = await this.validatePositionBelongsToBusiness(parsed.positionId, parsed.businessId);
      if (!validPos) throw new Error('Position does not belong to the specified business');

      // Verify position job title matches
      const { data: pos } = await admin
        .from('organization_positions')
        .select('job_title_id, status, headcount_limit')
        .eq('id', parsed.positionId)
        .single();
      if (pos && pos.job_title_id !== parsed.jobTitleId) {
        throw new Error('Position job title does not match assignment job title');
      }
      if (pos && (pos.status === 'frozen' || pos.status === 'archived')) {
        throw new Error(`Target position is ${pos.status} and cannot accept new assignments`);
      }
      if (pos && parsed.assignmentType !== 'acting') {
        const occ = await this.getPositionOccupancy(parsed.positionId);
        if (occ.isFull) {
          throw new Error(`Target position has reached maximum headcount limit (${occ.occupiedCount} / ${occ.headcountLimit} occupied)`);
        }
      }
    }

    // 4. Reporting Manager validation
    if (parsed.reportsToAssignmentId) {
      const { data: mgr, error: mgrErr } = await admin
        .from('staff_assignments')
        .select('id, business_id, status')
        .eq('id', parsed.reportsToAssignmentId)
        .maybeSingle();

      if (mgrErr || !mgr) throw new Error(`Reporting manager assignment ${parsed.reportsToAssignmentId} not found`);
      if (mgr.business_id !== parsed.businessId) {
        throw new Error('Reporting manager assignment belongs to a different business');
      }
      if (mgr.status === 'ended' || mgr.status === 'cancelled') {
        throw new Error(`Cannot assign manager with status ${mgr.status}`);
      }
    }

    const startsAtStr = typeof parsed.startsAt === 'string' ? parsed.startsAt : parsed.startsAt.toISOString();
    const endsAtStr = parsed.endsAt ? (typeof parsed.endsAt === 'string' ? parsed.endsAt : parsed.endsAt.toISOString()) : null;

    // Concurrency-safe creation via atomic RPC
    const { data: rpcRes, error: rpcErr } = await admin.rpc('create_staff_assignment_atomic', {
      p_business_id: parsed.businessId,
      p_business_membership_id: parsed.businessMembershipId,
      p_job_title_id: parsed.jobTitleId,
      p_branch_id: parsed.branchId || null,
      p_department_id: parsed.departmentId || null,
      p_unit_id: parsed.unitId || null,
      p_position_id: parsed.positionId || null,
      p_assignment_type: parsed.assignmentType || 'primary',
      p_is_primary: parsed.isPrimary,
      p_status: parsed.status || 'active',
      p_starts_at: startsAtStr,
      p_ends_at: endsAtStr,
      p_acting_for_id: parsed.actingForAssignmentId || null,
      p_reports_to_id: parsed.reportsToAssignmentId || null,
      p_reason: parsed.reason || null,
      p_actor_id: actorId || null,
    });

    if (!rpcErr && rpcRes && rpcRes.assignment_id) {
      const { data, error: fetchErr } = await admin
        .from('staff_assignments')
        .select()
        .eq('id', rpcRes.assignment_id)
        .single();

      if (!fetchErr && data) {
        await this.logAssignmentEvent({
          businessId: parsed.businessId,
          assignmentId: data.id,
          eventType: parsed.status === 'scheduled' ? 'scheduled' : 'created',
          newStatus: parsed.status || 'active',
          reason: parsed.reason || 'Staff assignment created',
          changedBy: actorId,
        });
        return data;
      }
    }

    // Direct insertion fallback
    const { data, error: createErr } = await admin
      .from('staff_assignments')
      .insert({
        business_id: parsed.businessId,
        business_membership_id: parsed.businessMembershipId,
        branch_id: parsed.branchId || null,
        department_id: parsed.departmentId || null,
        unit_id: parsed.unitId || null,
        position_id: parsed.positionId || null,
        job_title_id: parsed.jobTitleId,
        assignment_type: parsed.assignmentType || 'primary',
        is_primary: parsed.isPrimary,
        status: parsed.status || 'active',
        starts_at: startsAtStr,
        ends_at: endsAtStr,
        acting_for_assignment_id: parsed.actingForAssignmentId || null,
        source_assignment_id: parsed.sourceAssignmentId || null,
        coverage_absence_id: parsed.coverageAbsenceId || null,
        reports_to_assignment_id: parsed.reportsToAssignmentId || null,
        reason: parsed.reason || null,
      })
      .select()
      .single();

    if (createErr || !data) {
      throw new Error(`Failed to create staff assignment: ${createErr?.message || rpcErr?.message}`);
    }

    // Optimistic concurrency safety check for positions (primary/substantive assignments only)
    if (parsed.positionId && parsed.isPrimary) {
      const { data: currentOccupants } = await admin
        .from('staff_assignments')
        .select('id, created_at')
        .eq('position_id', parsed.positionId)
        .eq('is_primary', true)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      const { data: targetPos } = await admin
        .from('organization_positions')
        .select('headcount_limit')
        .eq('id', parsed.positionId)
        .single();

      const limit = targetPos?.headcount_limit || 1;
      const occupantList = currentOccupants || [];
      const myIndex = occupantList.findIndex((o) => o.id === data.id);

      if (myIndex >= limit) {
        // We lost the concurrency race! Clean up our insertion
        await admin.from('staff_assignments').delete().eq('id', data.id);
        throw new Error(
          `Target position has reached maximum headcount limit (${occupantList.length} / ${limit} occupied)`
        );
      }
    }

    // Log assignment history event
    await this.logAssignmentEvent({
      businessId: parsed.businessId,
      assignmentId: data.id,
      eventType: parsed.status === 'scheduled' ? 'scheduled' : 'created',
      newStatus: parsed.status || 'active',
      reason: parsed.reason || 'Staff assignment created',
      changedBy: actorId,
    });

    return data;
    });
  }

  static async createAdditionalAssignment(
    input: CreateAdditionalAssignmentInput | z.output<typeof createAdditionalAssignmentSchema>,
    actorId?: string
  ) {
    const parsed = createAdditionalAssignmentSchema.parse(input);
    return this.createStaffAssignment(
      {
        ...parsed,
        isPrimary: false,
        assignmentType: parsed.assignmentType || 'additional',
      },
      actorId
    );
  }

  static async updateStaffAssignment(input: UpdateStaffAssignmentInput) {
    const parsed = updateStaffAssignmentSchema.parse(input);
    const admin = createAdminClient();

    // If updating to active primary, ensure no other active primary assignment exists for the same membership
    if (parsed.isPrimary && parsed.status === 'active') {
      const { data: currentAssignment } = await admin
        .from('staff_assignments')
        .select('business_membership_id')
        .eq('id', parsed.id)
        .maybeSingle();

      if (currentAssignment?.business_membership_id) {
        const { data: existingPrimary } = await admin
          .from('staff_assignments')
          .select('id')
          .eq('business_membership_id', currentAssignment.business_membership_id)
          .neq('id', parsed.id)
          .eq('is_primary', true)
          .eq('status', 'active')
          .maybeSingle();

        if (existingPrimary) {
          throw new Error(
            'Business membership already has an active primary assignment. End or transfer the existing primary assignment before setting another assignment as primary.'
          );
        }
      }
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.branchId !== undefined) updatePayload.branch_id = parsed.branchId;
    if (parsed.departmentId !== undefined) updatePayload.department_id = parsed.departmentId;
    if (parsed.unitId !== undefined) updatePayload.unit_id = parsed.unitId;
    if (parsed.positionId !== undefined) updatePayload.position_id = parsed.positionId;
    if (parsed.jobTitleId !== undefined) updatePayload.job_title_id = parsed.jobTitleId;
    if (parsed.assignmentType !== undefined) updatePayload.assignment_type = parsed.assignmentType;
    if (parsed.isPrimary !== undefined) updatePayload.is_primary = parsed.isPrimary;
    if (parsed.status !== undefined) updatePayload.status = parsed.status;
    if (parsed.startsAt !== undefined) {
      updatePayload.starts_at = typeof parsed.startsAt === 'string' ? parsed.startsAt : parsed.startsAt.toISOString();
    }
    if (parsed.endsAt !== undefined) {
      updatePayload.ends_at = parsed.endsAt ? (typeof parsed.endsAt === 'string' ? parsed.endsAt : parsed.endsAt.toISOString()) : null;
    }
    if (parsed.actingForAssignmentId !== undefined) updatePayload.acting_for_assignment_id = parsed.actingForAssignmentId;
    if (parsed.sourceAssignmentId !== undefined) updatePayload.source_assignment_id = parsed.sourceAssignmentId;
    if (parsed.coverageAbsenceId !== undefined) updatePayload.coverage_absence_id = parsed.coverageAbsenceId;
    if (parsed.reportsToAssignmentId !== undefined) updatePayload.reports_to_assignment_id = parsed.reportsToAssignmentId;
    if (parsed.reason !== undefined) updatePayload.reason = parsed.reason;

    const { data, error } = await admin
      .from('staff_assignments')
      .update(updatePayload)
      .eq('id', parsed.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update staff assignment: ${error.message}`);
    return data;
  }

  static async endStaffAssignment(input: EndStaffAssignmentInput, actorId?: string) {
    const parsed = endStaffAssignmentSchema.parse(input);
    const admin = createAdminClient();

    const endedAtStr = typeof parsed.endedAt === 'string' ? parsed.endedAt : parsed.endedAt.toISOString();

    const { data, error } = await admin
      .from('staff_assignments')
      .update({
        status: 'ended',
        ends_at: endedAtStr,
        reason: parsed.reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to end staff assignment: ${error.message}`);

    // Log history
    await this.logAssignmentEvent({
      businessId: data.business_id,
      assignmentId: data.id,
      eventType: 'ended',
      previousStatus: 'active',
      newStatus: 'ended',
      reason: parsed.reason || 'Staff assignment ended',
      changedBy: actorId,
    });

    return data;
  }

  // ==========================================
  // 8. Acting Assignments Engine
  // ==========================================

  static async createActingAssignment(input: CreateActingAssignmentInput, actorId?: string) {
    const parsed = createActingAssignmentSchema.parse(input);
    const admin = createAdminClient();

    const startsAtStr = typeof parsed.startsAt === 'string' ? parsed.startsAt : parsed.startsAt.toISOString();
    const endsAtStr = typeof parsed.endsAt === 'string' ? parsed.endsAt : parsed.endsAt.toISOString();

    // 1. Validate target substantive assignment
    const { data: target, error: targetErr } = await admin
      .from('staff_assignments')
      .select('*')
      .eq('id', parsed.actingForAssignmentId)
      .maybeSingle();

    if (targetErr || !target) {
      throw new Error(`Target substantive assignment ${parsed.actingForAssignmentId} not found`);
    }
    if (target.business_id !== parsed.businessId) {
      throw new Error(`Acting target assignment ${parsed.actingForAssignmentId} does not belong to business ${parsed.businessId}`);
    }
    if (target.assignment_type === 'acting') {
      throw new Error('Cannot create an acting assignment covering another acting assignment');
    }
    if (target.business_membership_id === parsed.businessMembershipId) {
      throw new Error('Cannot act for your own assignment');
    }

    // 2. Check for overlapping acting assignments for the same substantive target
    const { data: existingActings } = await admin
      .from('staff_assignments')
      .select('id, starts_at, ends_at, status')
      .eq('acting_for_assignment_id', parsed.actingForAssignmentId)
      .in('status', ['active', 'scheduled']);

    const newStart = new Date(startsAtStr).getTime();
    const newEnd = new Date(endsAtStr).getTime();

    for (const existing of existingActings || []) {
      const exStart = new Date(existing.starts_at).getTime();
      const exEnd = existing.ends_at ? new Date(existing.ends_at).getTime() : Infinity;
      if (newStart < exEnd && exStart < newEnd) {
        throw new Error(`Conflicting overlapping acting assignment already exists for substantive assignment ${parsed.actingForAssignmentId}`);
      }
    }

    // 3. Validate coverage absence if specified
    if (parsed.coverageAbsenceId) {
      const { data: absence } = await admin
        .from('organization_assignment_absences')
        .select('*')
        .eq('id', parsed.coverageAbsenceId)
        .maybeSingle();

      if (!absence || absence.business_id !== parsed.businessId) {
        throw new Error('Coverage absence not found in business');
      }
      if (absence.assignment_id !== parsed.actingForAssignmentId) {
        throw new Error(`Coverage absence assignment ${absence.assignment_id} does not match acting target assignment ${parsed.actingForAssignmentId}`);
      }
    }

    // Call atomic RPC
    const { data: rpcRes, error: rpcErr } = await admin.rpc('create_acting_assignment_atomic', {
      p_business_id: parsed.businessId,
      p_business_membership_id: parsed.businessMembershipId,
      p_acting_for_assignment_id: parsed.actingForAssignmentId,
      p_starts_at: startsAtStr,
      p_ends_at: endsAtStr,
      p_coverage_absence_id: parsed.coverageAbsenceId || null,
      p_reports_to_id: parsed.reportsToAssignmentId || null,
      p_status: parsed.status || 'active',
      p_reason: parsed.reason || null,
      p_actor_id: actorId || null,
    });

    if (!rpcErr && rpcRes && rpcRes.assignment_id) {
      const { data: created } = await admin
        .from('staff_assignments')
        .select()
        .eq('id', rpcRes.assignment_id)
        .single();
      return created;
    }

    // Fallback: direct insertion
    const { data: created, error: createErr } = await admin
      .from('staff_assignments')
      .insert({
        business_id: parsed.businessId,
        business_membership_id: parsed.businessMembershipId,
        branch_id: target.branch_id,
        department_id: target.department_id,
        unit_id: target.unit_id,
        position_id: target.position_id,
        job_title_id: target.job_title_id,
        assignment_type: 'acting',
        is_primary: false,
        status: parsed.status || 'active',
        starts_at: startsAtStr,
        ends_at: endsAtStr,
        acting_for_assignment_id: parsed.actingForAssignmentId,
        coverage_absence_id: parsed.coverageAbsenceId || null,
        reports_to_assignment_id: parsed.reportsToAssignmentId || target.reports_to_assignment_id || null,
        reason: parsed.reason || null,
      })
      .select()
      .single();

    if (createErr || !created) {
      throw new Error(`Failed to create acting assignment: ${createErr?.message}`);
    }

    await this.logAssignmentEvent({
      businessId: parsed.businessId,
      assignmentId: created.id,
      eventType: parsed.status === 'scheduled' ? 'scheduled' : 'acting_started',
      newStatus: parsed.status || 'active',
      relatedAssignmentId: parsed.actingForAssignmentId,
      reason: parsed.reason || 'Acting assignment created',
      changedBy: actorId,
    });

    return created;
  }

  static async extendActingAssignment(input: ExtendActingAssignmentInput, actorId?: string) {
    const parsed = extendActingAssignmentSchema.parse(input);
    const admin = createAdminClient();

    const newEndsAtStr = typeof parsed.newEndsAt === 'string' ? parsed.newEndsAt : parsed.newEndsAt.toISOString();

    const { data: assign, error: findErr } = await admin
      .from('staff_assignments')
      .select('*')
      .eq('id', parsed.assignmentId)
      .eq('business_id', parsed.businessId)
      .single();

    if (findErr || !assign) throw new Error('Acting assignment not found');
    if (assign.assignment_type !== 'acting') throw new Error('Assignment is not an acting assignment');
    if (new Date(newEndsAtStr).getTime() <= new Date(assign.starts_at).getTime()) {
      throw new Error('New end date must be strictly after start date');
    }

    const { data: rpcRes, error: rpcErr } = await admin.rpc('extend_acting_assignment_atomic', {
      p_business_id: parsed.businessId,
      p_assignment_id: parsed.assignmentId,
      p_new_ends_at: newEndsAtStr,
      p_reason: parsed.reason || null,
      p_actor_id: actorId || null,
    });

    if (!rpcErr && rpcRes && rpcRes.success) {
      return rpcRes;
    }

    // Fallback: direct update
    const { error: updateErr } = await admin
      .from('staff_assignments')
      .update({
        ends_at: newEndsAtStr,
        reason: parsed.reason || assign.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.assignmentId)
      .select()
      .single();

    if (updateErr) throw new Error(`Failed to extend acting assignment: ${updateErr.message}`);

    await this.logAssignmentEvent({
      businessId: parsed.businessId,
      assignmentId: parsed.assignmentId,
      eventType: 'extended',
      previousStatus: assign.status,
      newStatus: assign.status,
      relatedAssignmentId: assign.acting_for_assignment_id,
      metadata: { previous_ends_at: assign.ends_at, new_ends_at: newEndsAtStr },
      reason: parsed.reason || 'Acting assignment extended',
      changedBy: actorId,
    });

    return {
      success: true,
      assignment_id: parsed.assignmentId,
      previous_ends_at: assign.ends_at,
      new_ends_at: newEndsAtStr,
    };
  }

  static async endActingAssignment(input: EndActingAssignmentInput, actorId?: string) {
    const parsed = endActingAssignmentSchema.parse(input);
    const admin = createAdminClient();

    const endedAtStr = typeof parsed.endedAt === 'string' ? parsed.endedAt : parsed.endedAt.toISOString();

    const { data: assign, error: findErr } = await admin
      .from('staff_assignments')
      .select('id, business_id, status, assignment_type, acting_for_assignment_id')
      .eq('id', parsed.assignmentId)
      .eq('business_id', parsed.businessId)
      .single();

    if (findErr || !assign) throw new Error('Acting assignment not found');
    if (assign.assignment_type !== 'acting') throw new Error('Assignment is not an acting assignment');

    const { data, error } = await admin
      .from('staff_assignments')
      .update({
        status: 'ended',
        ends_at: endedAtStr,
        reason: parsed.reason || 'Acting assignment ended',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.assignmentId)
      .select()
      .single();

    if (error) throw new Error(`Failed to end acting assignment: ${error.message}`);

    await this.logAssignmentEvent({
      businessId: parsed.businessId,
      assignmentId: parsed.assignmentId,
      eventType: 'acting_ended',
      previousStatus: assign.status,
      newStatus: 'ended',
      relatedAssignmentId: assign.acting_for_assignment_id,
      reason: parsed.reason || 'Acting assignment ended',
      changedBy: actorId,
    });

    return data;
  }

  // ==========================================
  // 9. Secondments Engine
  // ==========================================

  static async createSecondment(input: CreateSecondmentInput, actorId?: string) {
    const parsed = createSecondmentSchema.parse(input);
    const admin = createAdminClient();

    const startsAtStr = typeof parsed.startsAt === 'string' ? parsed.startsAt : parsed.startsAt.toISOString();
    const endsAtStr = parsed.endsAt ? (typeof parsed.endsAt === 'string' ? parsed.endsAt : parsed.endsAt.toISOString()) : null;

    // Validate home source assignment
    const { data: source, error: sourceErr } = await admin
      .from('staff_assignments')
      .select('*')
      .eq('id', parsed.sourceAssignmentId)
      .maybeSingle();

    if (sourceErr || !source) {
      throw new Error(`Home source assignment ${parsed.sourceAssignmentId} not found`);
    }
    if (source.business_id !== parsed.businessId) {
      throw new Error(`Home source assignment ${parsed.sourceAssignmentId} does not belong to business ${parsed.businessId}`);
    }

    const { data: rpcRes, error: rpcErr } = await admin.rpc('create_secondment_atomic', {
      p_business_id: parsed.businessId,
      p_business_membership_id: parsed.businessMembershipId,
      p_source_assignment_id: parsed.sourceAssignmentId,
      p_job_title_id: parsed.jobTitleId,
      p_branch_id: parsed.branchId || null,
      p_department_id: parsed.departmentId || null,
      p_unit_id: parsed.unitId || null,
      p_position_id: parsed.positionId || null,
      p_starts_at: startsAtStr,
      p_ends_at: endsAtStr,
      p_reports_to_id: parsed.reportsToAssignmentId || null,
      p_reason: parsed.reason || null,
      p_status: parsed.status || 'active',
      p_actor_id: actorId || null,
    });

    if (!rpcErr && rpcRes && rpcRes.assignment_id) {
      const { data: created } = await admin
        .from('staff_assignments')
        .select()
        .eq('id', rpcRes.assignment_id)
        .single();
      return created;
    }

    // Fallback: direct insert
    const { data: created, error: createErr } = await admin
      .from('staff_assignments')
      .insert({
        business_id: parsed.businessId,
        business_membership_id: parsed.businessMembershipId,
        branch_id: parsed.branchId || null,
        department_id: parsed.departmentId || null,
        unit_id: parsed.unitId || null,
        position_id: parsed.positionId || null,
        job_title_id: parsed.jobTitleId,
        assignment_type: 'secondment',
        is_primary: false,
        status: parsed.status || 'active',
        starts_at: startsAtStr,
        ends_at: endsAtStr,
        source_assignment_id: parsed.sourceAssignmentId,
        reports_to_assignment_id: parsed.reportsToAssignmentId || null,
        reason: parsed.reason || null,
      })
      .select()
      .single();

    if (createErr || !created) {
      throw new Error(`Failed to create secondment: ${createErr?.message}`);
    }

    await this.logAssignmentEvent({
      businessId: parsed.businessId,
      assignmentId: created.id,
      eventType: parsed.status === 'scheduled' ? 'scheduled' : 'secondment_started',
      newStatus: parsed.status || 'active',
      relatedAssignmentId: parsed.sourceAssignmentId,
      reason: parsed.reason || 'Secondment started',
      changedBy: actorId,
    });

    return created;
  }

  static async endSecondment(input: EndSecondmentInput, actorId?: string) {
    const parsed = endSecondmentSchema.parse(input);
    const admin = createAdminClient();

    const endedAtStr = typeof parsed.endedAt === 'string' ? parsed.endedAt : parsed.endedAt.toISOString();

    const { data: assign, error: findErr } = await admin
      .from('staff_assignments')
      .select('id, business_id, status, assignment_type, source_assignment_id')
      .eq('id', parsed.assignmentId)
      .eq('business_id', parsed.businessId)
      .single();

    if (findErr || !assign) throw new Error('Secondment assignment not found');
    if (assign.assignment_type !== 'secondment') throw new Error('Assignment is not a secondment');

    const { data, error } = await admin
      .from('staff_assignments')
      .update({
        status: 'ended',
        ends_at: endedAtStr,
        reason: parsed.reason || 'Secondment ended',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.assignmentId)
      .select()
      .single();

    if (error) throw new Error(`Failed to end secondment: ${error.message}`);

    await this.logAssignmentEvent({
      businessId: parsed.businessId,
      assignmentId: parsed.assignmentId,
      eventType: 'secondment_ended',
      previousStatus: assign.status,
      newStatus: 'ended',
      relatedAssignmentId: assign.source_assignment_id,
      reason: parsed.reason || 'Secondment ended',
      changedBy: actorId,
    });

    return data;
  }

  static async extendSecondment(input: ExtendSecondmentInput, actorId?: string) {
    const parsed = extendSecondmentSchema.parse(input);
    const admin = createAdminClient();

    const newEndsAtStr = typeof parsed.newEndsAt === 'string' ? parsed.newEndsAt : parsed.newEndsAt.toISOString();

    const { data: assign, error: findErr } = await admin
      .from('staff_assignments')
      .select('*')
      .eq('id', parsed.assignmentId)
      .eq('business_id', parsed.businessId)
      .single();

    if (findErr || !assign) throw new Error('Secondment assignment not found');
    if (assign.assignment_type !== 'secondment') throw new Error('Assignment is not a secondment');
    if (new Date(newEndsAtStr).getTime() <= new Date(assign.starts_at).getTime()) {
      throw new Error('New end date must be strictly after start date');
    }

    const { error: updateErr } = await admin
      .from('staff_assignments')
      .update({
        ends_at: newEndsAtStr,
        reason: parsed.reason || assign.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.assignmentId)
      .select()
      .single();

    if (updateErr) throw new Error(`Failed to extend secondment: ${updateErr.message}`);

    await this.logAssignmentEvent({
      businessId: parsed.businessId,
      assignmentId: parsed.assignmentId,
      eventType: 'extended',
      previousStatus: assign.status,
      newStatus: assign.status,
      relatedAssignmentId: assign.source_assignment_id,
      metadata: { previous_ends_at: assign.ends_at, new_ends_at: newEndsAtStr },
      reason: parsed.reason || 'Secondment extended',
      changedBy: actorId,
    });

    return {
      success: true,
      assignment_id: parsed.assignmentId,
      previous_ends_at: assign.ends_at,
      new_ends_at: newEndsAtStr,
    };
  }

  // ==========================================
  // 10. Temporary Assignments Engine
  // ==========================================

  static async createTemporaryAssignment(input: CreateTemporaryAssignmentInput, actorId?: string) {
    const parsed = createTemporaryAssignmentSchema.parse(input);
    const admin = createAdminClient();

    const startsAtStr = typeof parsed.startsAt === 'string' ? parsed.startsAt : parsed.startsAt.toISOString();
    const endsAtStr = typeof parsed.endsAt === 'string' ? parsed.endsAt : parsed.endsAt.toISOString();

    const { data, error } = await admin
      .from('staff_assignments')
      .insert({
        business_id: parsed.businessId,
        business_membership_id: parsed.businessMembershipId,
        branch_id: parsed.branchId || null,
        department_id: parsed.departmentId || null,
        unit_id: parsed.unitId || null,
        position_id: parsed.positionId || null,
        job_title_id: parsed.jobTitleId,
        source_assignment_id: parsed.sourceAssignmentId || null,
        assignment_type: 'temporary',
        is_primary: false,
        status: parsed.status || 'active',
        starts_at: startsAtStr,
        ends_at: endsAtStr,
        reports_to_assignment_id: parsed.reportsToAssignmentId || null,
        reason: parsed.reason || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create temporary assignment: ${error.message}`);

    await this.logAssignmentEvent({
      businessId: parsed.businessId,
      assignmentId: data.id,
      eventType: parsed.status === 'scheduled' ? 'scheduled' : 'temporary_started',
      newStatus: parsed.status || 'active',
      relatedAssignmentId: parsed.sourceAssignmentId || null,
      reason: parsed.reason || 'Temporary assignment created',
      changedBy: actorId,
    });

    return data;
  }

  static async endTemporaryAssignment(input: EndTemporaryAssignmentInput, actorId?: string) {
    const parsed = endTemporaryAssignmentSchema.parse(input);
    const admin = createAdminClient();

    const endedAtStr = typeof parsed.endedAt === 'string' ? parsed.endedAt : parsed.endedAt.toISOString();

    const { data: assign, error: findErr } = await admin
      .from('staff_assignments')
      .select('id, business_id, status, assignment_type, source_assignment_id')
      .eq('id', parsed.assignmentId)
      .eq('business_id', parsed.businessId)
      .single();

    if (findErr || !assign) throw new Error('Temporary assignment not found');

    const { data, error } = await admin
      .from('staff_assignments')
      .update({
        status: 'ended',
        ends_at: endedAtStr,
        reason: parsed.reason || 'Temporary assignment ended',
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.assignmentId)
      .select()
      .single();

    if (error) throw new Error(`Failed to end temporary assignment: ${error.message}`);

    await this.logAssignmentEvent({
      businessId: parsed.businessId,
      assignmentId: parsed.assignmentId,
      eventType: 'temporary_ended',
      previousStatus: assign.status,
      newStatus: 'ended',
      relatedAssignmentId: assign.source_assignment_id,
      reason: parsed.reason || 'Temporary assignment ended',
      changedBy: actorId,
    });

    return data;
  }

  // ==========================================
  // 11. Assignment Absences Model
  // ==========================================

  static async createAssignmentAbsence(input: CreateAssignmentAbsenceInput, actorId?: string) {
    const parsed = createAssignmentAbsenceSchema.parse(input);
    const admin = createAdminClient();

    const startsAtStr = typeof parsed.startsAt === 'string' ? parsed.startsAt : parsed.startsAt.toISOString();
    const endsAtStr = typeof parsed.endsAt === 'string' ? parsed.endsAt : parsed.endsAt.toISOString();

    // Verify assignment belongs to business
    const { data: assign, error: assignErr } = await admin
      .from('staff_assignments')
      .select('id, business_id')
      .eq('id', parsed.assignmentId)
      .maybeSingle();

    if (assignErr || !assign || assign.business_id !== parsed.businessId) {
      throw new Error('Assignment does not belong to the specified business');
    }

    const { data, error } = await admin
      .from('organization_assignment_absences')
      .insert({
        business_id: parsed.businessId,
        assignment_id: parsed.assignmentId,
        absence_type: parsed.absenceType,
        starts_at: startsAtStr,
        ends_at: endsAtStr,
        reason: parsed.reason || null,
        status: parsed.status,
        created_by: actorId || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create assignment absence: ${error.message}`);
    return data;
  }

  static async endAssignmentAbsence(input: EndAssignmentAbsenceInput) {
    const parsed = endAssignmentAbsenceSchema.parse(input);
    const admin = createAdminClient();

    const endedAtStr = typeof parsed.endedAt === 'string' ? parsed.endedAt : parsed.endedAt.toISOString();

    const { data, error } = await admin
      .from('organization_assignment_absences')
      .update({
        status: 'ended',
        ends_at: endedAtStr,
        reason: parsed.reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to end assignment absence: ${error.message}`);
    return data;
  }

  static async getAssignmentAbsences(
    businessId: string,
    options?: { assignmentId?: string; activeOnly?: boolean }
  ) {
    const admin = createAdminClient();
    let query = admin
      .from('organization_assignment_absences')
      .select(`
        *,
        assignment:staff_assignments(
          id, job_title:organization_job_titles(id, name),
          membership:business_memberships(id, user_id, role)
        )
      `)
      .eq('business_id', businessId)
      .order('starts_at', { ascending: false });

    if (options?.assignmentId) {
      query = query.eq('assignment_id', options.assignmentId);
    }
    if (options?.activeOnly) {
      query = query.eq('status', 'active');
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch assignment absences: ${error.message}`);
    return data || [];
  }

  // ==========================================
  // 12. Primary Transitions (Promotion / Transfer)
  // ==========================================

  static async transitionPrimaryAssignment(input: TransitionPrimaryAssignmentInput, actorId?: string) {
    const parsed = transitionPrimaryAssignmentSchema.parse(input);
    const admin = createAdminClient();

    const transitionTimeStr = typeof parsed.transitionTime === 'string' ? parsed.transitionTime : parsed.transitionTime.toISOString();

    // Validate current assignment
    const { data: current, error: currErr } = await admin
      .from('staff_assignments')
      .select('id, business_id, business_membership_id, status, is_primary, reports_to_assignment_id')
      .eq('id', parsed.currentAssignmentId)
      .eq('business_id', parsed.businessId)
      .maybeSingle();

    if (currErr || !current) {
      throw new Error(`Current staff assignment ${parsed.currentAssignmentId} not found in business ${parsed.businessId}`);
    }
    if (current.status !== 'active') {
      throw new Error(`Current staff assignment is not active (status: ${current.status})`);
    }

    // Try executing via atomic PostgreSQL RPC
    const { data: rpcRes, error: rpcErr } = await admin.rpc('transition_staff_primary_assignment', {
      p_business_id: parsed.businessId,
      p_current_assignment_id: parsed.currentAssignmentId,
      p_new_position_id: parsed.newPositionId || null,
      p_new_job_title_id: parsed.newJobTitleId || null,
      p_new_branch_id: parsed.newBranchId || null,
      p_new_department_id: parsed.newDepartmentId || null,
      p_new_unit_id: parsed.newUnitId || null,
      p_new_reports_to_id: parsed.newReportsToId || null,
      p_transition_type: parsed.transitionType || 'promotion',
      p_reason: parsed.reason || null,
      p_actor_id: actorId || null,
      p_transition_time: transitionTimeStr,
    });

    if (!rpcErr && rpcRes && rpcRes.success) {
      return {
        success: true,
        endedAssignmentId: rpcRes.ended_assignment_id,
        newAssignmentId: rpcRes.new_assignment_id,
        transitionType: rpcRes.transition_type,
        transitionTime: rpcRes.transition_time,
      };
    }

    // Fallback: If RPC fails, rethrow error
    if (rpcErr) {
      throw new Error(`Transition failed: ${rpcErr.message}`);
    }

    return rpcRes;
  }

  // ==========================================
  // 13. Reporting Manager Engine & Trees
  // ==========================================

  static async setReportingManager(input: SetReportingManagerInput, actorId?: string) {
    const parsed = setReportingManagerSchema.parse(input);
    const admin = createAdminClient();

    if (parsed.reportsToAssignmentId && parsed.assignmentId === parsed.reportsToAssignmentId) {
      throw new Error('Self-reporting is not allowed: Assignment cannot report to itself');
    }

    const { data: assign, error: assignErr } = await admin
      .from('staff_assignments')
      .select('id, business_id, reports_to_assignment_id, status')
      .eq('id', parsed.assignmentId)
      .eq('business_id', parsed.businessId)
      .single();

    if (assignErr || !assign) {
      throw new Error(`Staff assignment ${parsed.assignmentId} not found`);
    }

    const previousManagerId = assign.reports_to_assignment_id;

    if (parsed.reportsToAssignmentId) {
      const { data: mgr, error: mgrErr } = await admin
        .from('staff_assignments')
        .select('id, business_id, status, reports_to_assignment_id')
        .eq('id', parsed.reportsToAssignmentId)
        .maybeSingle();

      if (mgrErr || !mgr) {
        throw new Error(`Reporting manager assignment ${parsed.reportsToAssignmentId} not found`);
      }
      if (mgr.business_id !== parsed.businessId) {
        throw new Error('Reporting manager assignment belongs to a different business');
      }
      if (mgr.status === 'ended' || mgr.status === 'cancelled') {
        throw new Error(`Cannot assign manager with status ${mgr.status}: Manager assignment is ended or cancelled`);
      }

      // Check circular reporting cycle in ancestry
      let curAncestorId: string | null = mgr.reports_to_assignment_id;
      const visited = new Set<string>([parsed.assignmentId, mgr.id]);
      while (curAncestorId) {
        if (curAncestorId === parsed.assignmentId) {
          throw new Error(`Circular reporting cycle detected in ancestry chain: assignment ${parsed.assignmentId} already exists in ancestry`);
        }
        if (visited.has(curAncestorId)) break;
        visited.add(curAncestorId);
        const { data: nextAncestor } = await admin
          .from('staff_assignments')
          .select('reports_to_assignment_id')
          .eq('id', curAncestorId)
          .maybeSingle();
        curAncestorId = nextAncestor?.reports_to_assignment_id || null;
      }
    }

    // Try RPC first, fallback to direct update
    const { data: rpcRes, error: rpcErr } = await admin.rpc('set_staff_reporting_manager_atomic', {
      p_business_id: parsed.businessId,
      p_assignment_id: parsed.assignmentId,
      p_reports_to_id: parsed.reportsToAssignmentId || null,
      p_reason: parsed.reason || null,
      p_actor_id: actorId || null,
    });

    if (!rpcErr && rpcRes && rpcRes.success) {
      return rpcRes;
    }

    // Fallback: update directly
    const { error: updateErr } = await admin
      .from('staff_assignments')
      .update({
        reports_to_assignment_id: parsed.reportsToAssignmentId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.assignmentId)
      .select()
      .single();

    if (updateErr) throw new Error(`Failed to update reporting manager: ${updateErr.message}`);

    // Insert history
    await admin.from('organization_reporting_history').insert({
      business_id: parsed.businessId,
      assignment_id: parsed.assignmentId,
      previous_manager_assignment_id: previousManagerId,
      new_manager_assignment_id: parsed.reportsToAssignmentId || null,
      reason: parsed.reason || null,
      changed_by: actorId || null,
      changed_at: new Date().toISOString(),
    });

    return {
      success: true,
      assignment_id: parsed.assignmentId,
      previous_manager_assignment_id: previousManagerId,
      new_manager_assignment_id: parsed.reportsToAssignmentId || null,
    };
  }

  static async getReportingHistory(assignmentId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_reporting_history')
      .select(`
        *,
        previous_manager:staff_assignments!previous_manager_assignment_id(
          id, job_title:organization_job_titles(id, name),
          membership:business_memberships(id, user_id, role)
        ),
        new_manager:staff_assignments!new_manager_assignment_id(
          id, job_title:organization_job_titles(id, name),
          membership:business_memberships(id, user_id, role)
        )
      `)
      .eq('assignment_id', assignmentId)
      .order('changed_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch reporting history: ${error.message}`);
    return data || [];
  }

  static async getStaffAssignmentById(id: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('staff_assignments')
      .select(`
        *,
        membership:business_memberships(id, user_id, role, membership_status),
        job_title:organization_job_titles(id, name, code, is_management, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        position:organization_positions(id, position_code, name_override, headcount_limit),
        department:organization_departments(id, name, code),
        unit:organization_units(id, name, code),
        branch:branches(id, name, code)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch staff assignment: ${error.message}`);
    if (!data) return null;

    // Normalize joined relations if returned as arrays by postgREST
    if (Array.isArray(data.membership)) data.membership = data.membership[0] || null;
    if (Array.isArray(data.job_title)) data.job_title = data.job_title[0] || null;
    if (Array.isArray(data.position)) data.position = data.position[0] || null;
    if (Array.isArray(data.department)) data.department = data.department[0] || null;
    if (Array.isArray(data.unit)) data.unit = data.unit[0] || null;
    if (Array.isArray(data.branch)) data.branch = data.branch[0] || null;

    // Deterministically fetch related assignments (reports_to, acting_for, source_assignment)
    const relatedIds = [
      data.reports_to_assignment_id,
      data.acting_for_assignment_id,
      data.source_assignment_id,
    ].filter(Boolean) as string[];

    const relatedMap = new Map<string, Record<string, unknown>>();
    if (relatedIds.length > 0) {
      const { data: relData } = await admin
        .from('staff_assignments')
        .select(`
          id,
          job_title:organization_job_titles(id, name, code),
          membership:business_memberships(id, user_id, role),
          branch:branches(id, name, code)
        `)
        .in('id', relatedIds);

      for (const rel of (relData || []) as Record<string, unknown>[]) {
        if (Array.isArray(rel.membership)) rel.membership = rel.membership[0] || null;
        if (Array.isArray(rel.job_title)) rel.job_title = rel.job_title[0] || null;
        if (Array.isArray(rel.branch)) rel.branch = rel.branch[0] || null;
        relatedMap.set(rel.id as string, rel);
      }
    }

    data.reports_to = data.reports_to_assignment_id ? (relatedMap.get(data.reports_to_assignment_id) || null) : null;
    data.acting_for = data.acting_for_assignment_id ? (relatedMap.get(data.acting_for_assignment_id) || null) : null;
    data.source_assignment = data.source_assignment_id ? (relatedMap.get(data.source_assignment_id) || null) : null;

    // Batch resolve user_profiles for all referenced memberships
    const userIds = new Set<string>();
    const selfMem = data.membership as { user_id?: string } | null;
    if (selfMem?.user_id) userIds.add(selfMem.user_id);

    const repAssign = data.reports_to as { membership?: { user_id?: string } } | null;
    if (repAssign?.membership?.user_id) userIds.add(repAssign.membership.user_id);

    const actAssign = data.acting_for as { membership?: { user_id?: string } } | null;
    if (actAssign?.membership?.user_id) userIds.add(actAssign.membership.user_id);

    const srcAssign = data.source_assignment as { membership?: { user_id?: string } } | null;
    if (srcAssign?.membership?.user_id) userIds.add(srcAssign.membership.user_id);

    if (userIds.size > 0) {
      const { data: profiles } = await admin
        .from('user_profiles')
        .select('id, first_name, last_name')
        .in('id', Array.from(userIds));

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      if (selfMem?.user_id) (selfMem as { user_profiles?: unknown }).user_profiles = profileMap.get(selfMem.user_id) || null;
      if (repAssign?.membership?.user_id) (repAssign.membership as { user_profiles?: unknown }).user_profiles = profileMap.get(repAssign.membership.user_id) || null;
      if (actAssign?.membership?.user_id) (actAssign.membership as { user_profiles?: unknown }).user_profiles = profileMap.get(actAssign.membership.user_id) || null;
      if (srcAssign?.membership?.user_id) (srcAssign.membership as { user_profiles?: unknown }).user_profiles = profileMap.get(srcAssign.membership.user_id) || null;
    }

    return data;
  }

  static isAssignmentEffective(assignment: { status: string; starts_at: string; ends_at?: string | null }, referenceDate: Date = new Date()): boolean {
    if (assignment.status !== 'active') return false;
    const refTime = referenceDate.getTime();
    const startTime = new Date(assignment.starts_at).getTime();
    if (startTime > refTime) return false;
    if (assignment.ends_at) {
      const endTime = new Date(assignment.ends_at).getTime();
      if (endTime <= refTime) return false;
    }
    return true;
  }

  static async getDirectReports(assignmentId: string, options?: { effectiveOnly?: boolean; referenceDate?: Date }) {
    const admin = createAdminClient();
    const refDate = options?.referenceDate || new Date();

    const { data, error } = await admin
      .from('staff_assignments')
      .select(`
        *,
        membership:business_memberships(id, user_id, role, membership_status),
        job_title:organization_job_titles(id, name, code, is_management, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        position:organization_positions(id, position_code, name_override),
        branch:branches(id, name, code),
        department:organization_departments(id, name, code),
        unit:organization_units(id, name, code)
      `)
      .eq('reports_to_assignment_id', assignmentId)
      .eq('status', 'active')
      .is('archived_at', null);

    if (error) throw new Error(`Failed to fetch direct reports: ${error.message}`);

    const userIds = new Set<string>();
    for (const r of (data || []) as Array<{ membership?: { user_id?: string; user_profiles?: unknown } | null }>) {
      const mem = Array.isArray(r.membership) ? r.membership[0] : r.membership;
      if (mem?.user_id) userIds.add(mem.user_id);
    }

    if (userIds.size > 0) {
      const { data: profiles } = await admin
        .from('user_profiles')
        .select('id, first_name, last_name')
        .in('id', Array.from(userIds));

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      for (const r of (data || []) as Array<{ membership?: { user_id?: string; user_profiles?: unknown } | null }>) {
        const mem = Array.isArray(r.membership) ? r.membership[0] : r.membership;
        if (mem?.user_id) {
          mem.user_profiles = profileMap.get(mem.user_id) || null;
        }
      }
    }

    if (options?.effectiveOnly) {
      return (data || []).filter((r) => this.isAssignmentEffective(r, refDate));
    }

    return data || [];
  }

  static async getReportingChain(assignmentId: string, maxDepth = 50) {
    const chain: Record<string, unknown>[] = [];
    const visited = new Set<string>();

    let currentId: string | null = assignmentId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      if (visited.has(currentId)) {
        break; // Cycle detected, prevent infinite loop
      }
      visited.add(currentId);

      const node = await this.getStaffAssignmentById(currentId);
      if (!node) break;

      chain.push(node);
      currentId = (node.reports_to_assignment_id as string) || null;
      depth++;
    }

    return chain;
  }

  static async getReportingTree(rootAssignmentId?: string, businessId?: string): Promise<ReportingTreeNode[]> {
    const admin = createAdminClient();

    if (!rootAssignmentId && !businessId) {
      throw new Error('Either rootAssignmentId or businessId must be specified to build reporting tree');
    }

    let rootAssignments: Record<string, unknown>[] = [];

    if (rootAssignmentId) {
      const root = await this.getStaffAssignmentById(rootAssignmentId);
      if (root) rootAssignments = [root];
    } else if (businessId) {
      const { data } = await admin
        .from('staff_assignments')
        .select(`
          *,
          membership:business_memberships(id, user_id, role),
          job_title:organization_job_titles(id, name, code, hierarchy_level:organization_hierarchy_levels(id, name, rank))
        `)
        .eq('business_id', businessId)
        .eq('status', 'active')
        .is('reports_to_assignment_id', null)
        .is('archived_at', null);

      rootAssignments = data || [];
    }

    const buildSubtree = async (node: Record<string, unknown>, visited: Set<string>): Promise<ReportingTreeNode> => {
      const nodeId = node.id as string;
      if (visited.has(nodeId)) {
        return { assignment: node, directReports: [] };
      }
      visited.add(nodeId);

      const directSubordinates = await this.getDirectReports(nodeId, { effectiveOnly: true });
      const children: ReportingTreeNode[] = [];

      for (const sub of directSubordinates) {
        if (!visited.has(sub.id as string)) {
          const childTree = await buildSubtree(sub, new Set(visited));
          children.push(childTree);
        }
      }

      return {
        assignment: node,
        directReports: children,
      };
    };

    const trees: ReportingTreeNode[] = [];
    for (const root of rootAssignments) {
      const tree = await buildSubtree(root, new Set());
      trees.push(tree);
    }

    return trees;
  }

  // ==========================================
  // 14. Effective Reporting Resolution Engine
  // ==========================================

  static async resolveEffectiveManager(
    assignmentId: string,
    referenceDate: Date = new Date()
  ): Promise<{
    substantiveManager: Record<string, unknown> | null;
    effectiveManager: Record<string, unknown> | null;
    isActingCoverage: boolean;
  }> {
    const admin = createAdminClient();
    const assignment = await this.getStaffAssignmentById(assignmentId);
    if (!assignment || !assignment.reports_to_assignment_id) {
      return { substantiveManager: null, effectiveManager: null, isActingCoverage: false };
    }

    const substantiveManagerId = assignment.reports_to_assignment_id as string;
    const substantiveManager = await this.getStaffAssignmentById(substantiveManagerId);
    if (!substantiveManager) {
      return { substantiveManager: null, effectiveManager: null, isActingCoverage: false };
    }

    const refIso = referenceDate.toISOString();

    // Check if there is an active acting assignment covering this substantive manager
    const { data: actingCoverage } = await admin
      .from('staff_assignments')
      .select(`
        *,
        job_title:organization_job_titles(id, name, code, is_management, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        membership:business_memberships(id, user_id, role)
      `)
      .eq('acting_for_assignment_id', substantiveManagerId)
      .eq('status', 'active')
      .lte('starts_at', refIso)
      .or(`ends_at.is.null,ends_at.gt.${refIso}`)
      .is('archived_at', null)
      .order('starts_at', { ascending: false })
      .limit(1);

    if (actingCoverage && actingCoverage.length > 0) {
      const actCoverageNode = actingCoverage[0];
      const actMem = Array.isArray(actCoverageNode.membership) ? actCoverageNode.membership[0] : actCoverageNode.membership;
      if (actMem?.user_id) {
        const { data: prof } = await admin
          .from('user_profiles')
          .select('id, first_name, last_name')
          .eq('id', actMem.user_id)
          .maybeSingle();
        (actMem as { user_profiles?: unknown }).user_profiles = prof || null;
      }

      return {
        substantiveManager,
        effectiveManager: actCoverageNode,
        isActingCoverage: true,
      };
    }

    return {
      substantiveManager,
      effectiveManager: substantiveManager,
      isActingCoverage: false,
    };
  }

  static async getEffectiveDirectReports(
    assignmentId: string,
    referenceDate: Date = new Date()
  ): Promise<Record<string, unknown>[]> {
    const admin = createAdminClient();
    const assignment = await this.getStaffAssignmentById(assignmentId);
    if (!assignment) return [];

    const refIso = referenceDate.toISOString();

    // Determine target substantive assignments whose subordinates effectively report to this assignment
    let targetSubstantiveId = assignment.id;
    if (assignment.assignment_type === 'acting' && assignment.acting_for_assignment_id) {
      targetSubstantiveId = assignment.acting_for_assignment_id;
    }

    // Direct reports who point to targetSubstantiveId
    const { data: directReports, error } = await admin
      .from('staff_assignments')
      .select(`
        *,
        membership:business_memberships(id, user_id, role, membership_status),
        job_title:organization_job_titles(id, name, code, is_management, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        position:organization_positions(id, position_code, name_override),
        branch:branches(id, name, code),
        department:organization_departments(id, name, code),
        unit:organization_units(id, name, code)
      `)
      .eq('reports_to_assignment_id', targetSubstantiveId)
      .eq('status', 'active')
      .lte('starts_at', refIso)
      .or(`ends_at.is.null,ends_at.gt.${refIso}`)
      .is('archived_at', null);

    if (error) throw new Error(`Failed to fetch effective direct reports: ${error.message}`);

    const userIds = new Set<string>();
    for (const r of (directReports || []) as Array<{ membership?: { user_id?: string; user_profiles?: unknown } | null }>) {
      const mem = Array.isArray(r.membership) ? r.membership[0] : r.membership;
      if (mem?.user_id) userIds.add(mem.user_id);
    }

    if (userIds.size > 0) {
      const { data: profiles } = await admin
        .from('user_profiles')
        .select('id, first_name, last_name')
        .in('id', Array.from(userIds));

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      for (const r of (directReports || []) as Array<{ membership?: { user_id?: string; user_profiles?: unknown } | null }>) {
        const mem = Array.isArray(r.membership) ? r.membership[0] : r.membership;
        if (mem?.user_id) {
          mem.user_profiles = profileMap.get(mem.user_id) || null;
        }
      }
    }

    return directReports || [];
  }

  static async getEffectiveReportingChain(
    assignmentId: string,
    referenceDate: Date = new Date(),
    maxDepth = 50
  ): Promise<Record<string, unknown>[]> {
    const chain: Record<string, unknown>[] = [];
    const visited = new Set<string>();

    let currentId: string | null = assignmentId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      if (visited.has(currentId)) {
        break; // Cycle detected
      }
      visited.add(currentId);

      const node = await this.getStaffAssignmentById(currentId);
      if (!node) break;

      chain.push(node);

      // Resolve effective manager for current node
      const { effectiveManager } = await this.resolveEffectiveManager(currentId, referenceDate);
      if (!effectiveManager) {
        break;
      }

      currentId = (effectiveManager.id as string) || null;
      depth++;
    }

    return chain;
  }

  static async getEffectiveReportingTree(
    rootAssignmentId?: string,
    businessId?: string,
    referenceDate: Date = new Date()
  ): Promise<EffectiveReportingTreeNode[]> {
    const admin = createAdminClient();

    if (!rootAssignmentId && !businessId) {
      throw new Error('Either rootAssignmentId or businessId must be specified to build effective reporting tree');
    }

    let rootAssignments: Record<string, unknown>[] = [];

    if (rootAssignmentId) {
      const root = await this.getStaffAssignmentById(rootAssignmentId);
      if (root) rootAssignments = [root];
    } else if (businessId) {
      const { data } = await admin
        .from('staff_assignments')
        .select(`
          *,
          membership:business_memberships(id, user_id, role),
          job_title:organization_job_titles(id, name, code, hierarchy_level:organization_hierarchy_levels(id, name, rank))
        `)
        .eq('business_id', businessId)
        .eq('status', 'active')
        .is('reports_to_assignment_id', null)
        .is('archived_at', null);

      rootAssignments = data || [];
    }

    const buildEffectiveSubtree = async (
      node: Record<string, unknown>,
      visited: Set<string>
    ): Promise<EffectiveReportingTreeNode> => {
      const nodeId = node.id as string;
      if (visited.has(nodeId)) {
        return { assignment: node, directReports: [] };
      }
      visited.add(nodeId);

      const effectiveSubs = await this.getEffectiveDirectReports(nodeId, referenceDate);
      const children: EffectiveReportingTreeNode[] = [];

      for (const sub of effectiveSubs) {
        if (!visited.has(sub.id as string)) {
          const childTree = await buildEffectiveSubtree(sub, new Set(visited));
          children.push(childTree);
        }
      }

      return {
        assignment: node,
        isActingCoverage: node.assignment_type === 'acting',
        substantiveManagerId: (node.reports_to_assignment_id as string) || null,
        directReports: children,
      };
    };

    const trees: EffectiveReportingTreeNode[] = [];
    for (const root of rootAssignments) {
      const tree = await buildEffectiveSubtree(root, new Set());
      trees.push(tree);
    }

    return trees;
  }

  // ==========================================
  // 15. Lifecycle Reconciliation Engine
  // ==========================================

  static async reconcileAssignmentLifecycle(
    businessId?: string,
    referenceTime: Date = new Date()
  ) {
    const admin = createAdminClient();
    const refIso = referenceTime.toISOString();

    const { data: rpcRes, error: rpcErr } = await admin.rpc('reconcile_temporary_staff_assignments', {
      p_business_id: businessId || null,
      p_reference_time: refIso,
    });

    if (!rpcErr && rpcRes && rpcRes.success) {
      return rpcRes;
    }

    // Fallback: direct reconciliation
    let activatedCount = 0;
    let endedCount = 0;

    // 1. Activate scheduled assignments
    let scheduledQuery = admin
      .from('staff_assignments')
      .select('id, business_id, assignment_type')
      .eq('status', 'scheduled')
      .lte('starts_at', refIso);

    if (businessId) scheduledQuery = scheduledQuery.eq('business_id', businessId);
    const { data: scheduledList } = await scheduledQuery;

    for (const item of scheduledList || []) {
      await admin.from('staff_assignments').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', item.id);
      await this.logAssignmentEvent({
        businessId: item.business_id,
        assignmentId: item.id,
        eventType: 'activated',
        previousStatus: 'scheduled',
        newStatus: 'active',
        reason: 'Activated by lifecycle reconciliation',
      });
      activatedCount++;
    }

    // 2. End expired temporary/acting/secondment assignments
    let expiredQuery = admin
      .from('staff_assignments')
      .select('id, business_id, assignment_type')
      .eq('status', 'active')
      .not('ends_at', 'is', null)
      .lte('ends_at', refIso)
      .in('assignment_type', ['acting', 'temporary', 'secondment']);

    if (businessId) expiredQuery = expiredQuery.eq('business_id', businessId);
    const { data: expiredList } = await expiredQuery;

    for (const item of expiredList || []) {
      await admin.from('staff_assignments').update({ status: 'ended', updated_at: new Date().toISOString() }).eq('id', item.id);
      await this.logAssignmentEvent({
        businessId: item.business_id,
        assignmentId: item.id,
        eventType: item.assignment_type === 'acting' ? 'acting_ended' : (item.assignment_type === 'secondment' ? 'secondment_ended' : 'ended'),
        previousStatus: 'active',
        newStatus: 'ended',
        reason: 'Ended by lifecycle reconciliation due to expiration',
      });
      endedCount++;
    }

    return {
      success: true,
      reference_time: refIso,
      activated_count: activatedCount,
      ended_count: endedCount,
    };
  }

  // ==========================================
  // 16. Assignment Event History Logging
  // ==========================================

  static async logAssignmentEvent(params: {
    businessId: string;
    assignmentId: string;
    eventType: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    relatedAssignmentId?: string | null;
    metadata?: Record<string, unknown> | null;
    reason?: string | null;
    changedBy?: string | null;
  }) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_assignment_history')
      .insert({
        business_id: params.businessId,
        assignment_id: params.assignmentId,
        event_type: params.eventType,
        previous_status: params.previousStatus || null,
        new_status: params.newStatus || null,
        related_assignment_id: params.relatedAssignmentId || null,
        metadata: params.metadata || null,
        reason: params.reason || null,
        changed_by: params.changedBy || null,
        changed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.warn(`[OrganizationService] Warning: Failed to log assignment event: ${error.message}`);
    }
    return data;
  }

  static async getAssignmentEventHistory(assignmentId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_assignment_history')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('changed_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch assignment event history: ${error.message}`);
    return data || [];
  }

  // ==========================================
  // 17. Member Assignment History & Profiles
  // ==========================================

  static async getMemberAssignmentHistory(membershipId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('staff_assignments')
      .select(`
        *,
        job_title:organization_job_titles(id, name, code, is_management, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        position:organization_positions(id, position_code, name_override, headcount_limit),
        department:organization_departments(id, name, code),
        unit:organization_units(id, name, code),
        branch:branches(id, name, code),
        reports_to:staff_assignments!reports_to_assignment_id(
          id,
          job_title:organization_job_titles(id, name, code),
          membership:business_memberships(id, user_id, role)
        ),
        acting_for:staff_assignments!acting_for_assignment_id(
          id,
          job_title:organization_job_titles(id, name, code),
          membership:business_memberships(id, user_id, role)
        ),
        source_assignment:staff_assignments!source_assignment_id(
          id,
          job_title:organization_job_titles(id, name, code),
          membership:business_memberships(id, user_id, role)
        )
      `)
      .eq('business_membership_id', membershipId)
      .order('starts_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch member assignment history: ${error.message}`);
    return data || [];
  }

  static async getMemberOrganizationProfile(membershipId: string) {
    const admin = createAdminClient();

    // 1. Fetch membership context
    const { data: member, error: memErr } = await admin
      .from('business_memberships')
      .select('id, business_id, user_id, role, membership_status')
      .eq('id', membershipId)
      .maybeSingle();

    if (memErr || !member) throw new Error(`Business membership ${membershipId} not found`);

    // 2. Fetch all assignments for this member
    const allAssignments = await this.getMemberAssignmentHistory(membershipId);

    const now = new Date();
    const activeAssignments = allAssignments.filter((a) => a.status === 'active');
    const effectiveAssignments = allAssignments.filter((a) => this.isAssignmentEffective(a as { status: string; starts_at: string; ends_at?: string | null }, now));

    const primaryAssignment = activeAssignments.find((a) => a.is_primary) || null;
    const additionalAssignments = activeAssignments.filter((a) => !a.is_primary && a.assignment_type !== 'acting' && a.assignment_type !== 'secondment' && a.assignment_type !== 'temporary');
    const actingAssignments = activeAssignments.filter((a) => a.assignment_type === 'acting');
    const secondmentAssignments = activeAssignments.filter((a) => a.assignment_type === 'secondment');
    const temporaryAssignments = activeAssignments.filter((a) => a.assignment_type === 'temporary');

    // 3. Reporting manager and direct reports for primary assignment
    let reportingManager = null;
    let directReports: Record<string, unknown>[] = [];
    if (primaryAssignment) {
      if (primaryAssignment.reports_to_assignment_id) {
        reportingManager = await this.getStaffAssignmentById(primaryAssignment.reports_to_assignment_id as string);
      }
      directReports = await this.getDirectReports(primaryAssignment.id as string, { effectiveOnly: true });
    }

    // 4. Branch access mismatch diagnostics
    const { data: branchAccessList } = await admin
      .from('branch_assignments')
      .select('branch_id')
      .eq('business_membership_id', membershipId);

    const accessibleBranchIds = (branchAccessList || []).map((ba) => ba.branch_id);
    let organizationBranchAccessMismatch = false;

    for (const assign of effectiveAssignments) {
      if (assign.branch_id && !accessibleBranchIds.includes(assign.branch_id as string)) {
        organizationBranchAccessMismatch = true;
        break;
      }
    }

    return {
      membership: member,
      primaryAssignment,
      additionalAssignments,
      actingAssignments,
      secondmentAssignments,
      temporaryAssignments,
      effectiveAssignments,
      reportingManager,
      directReports,
      totalHistoricalAssignments: allAssignments.length,
      organizationBranchAccessMismatch,
      accessibleBranchIds,
    };
  }

  // ==========================================
  // 18. Organization Integrity Diagnostics
  // ==========================================

  static async getOrganizationIntegrityIssues(businessId: string) {
    const admin = createAdminClient();
    const issues: {
      type:
        | 'no_reporting_manager'
        | 'position_over_capacity'
        | 'branch_access_mismatch'
        | 'temporal_anomaly_expired'
        | 'temporal_anomaly_future_active'
        | 'hierarchy_anomaly';
      severity: 'error' | 'warning' | 'info';
      message: string;
      assignmentId?: string;
      positionId?: string;
      membershipId?: string;
    }[] = [];

    const now = new Date();

    // 1. Fetch active assignments with hierarchy and positions
    const { data: assignments } = await admin
      .from('staff_assignments')
      .select(`
        id,
        business_membership_id,
        branch_id,
        position_id,
        assignment_type,
        reports_to_assignment_id,
        status,
        is_primary,
        starts_at,
        ends_at,
        job_title:organization_job_titles(id, name, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        position:organization_positions(id, headcount_limit, position_code),
        membership:business_memberships(id, membership_status),
        reports_to:staff_assignments!reports_to_assignment_id(
          id,
          job_title:organization_job_titles(id, name, hierarchy_level:organization_hierarchy_levels(id, name, rank))
        )
      `)
      .eq('business_id', businessId)
      .eq('status', 'active');

    // 2. Fetch all branch_assignments for the business
    const { data: branchAccessList } = await admin
      .from('branch_assignments')
      .select('business_membership_id, branch_id');

    const branchAccessMap = new Map<string, Set<string>>();
    for (const ba of branchAccessList || []) {
      if (!branchAccessMap.has(ba.business_membership_id)) {
        branchAccessMap.set(ba.business_membership_id, new Set());
      }
      branchAccessMap.get(ba.business_membership_id)!.add(ba.branch_id);
    }

    // Evaluate each assignment
    for (const assign of assignments || []) {
      const jobTitle = assign.job_title as unknown as { id: string; name: string; hierarchy_level?: { rank: number } } | null;
      const rank = jobTitle?.hierarchy_level?.rank;

      // Check: Missing reporting manager for non-top-level staff
      if (!assign.reports_to_assignment_id && rank !== undefined && rank > 2) {
        issues.push({
          type: 'no_reporting_manager',
          severity: 'warning',
          message: `Active assignment has no reporting manager assigned (Rank ${rank}: ${jobTitle?.name || 'Unknown'})`,
          assignmentId: assign.id,
          membershipId: assign.business_membership_id,
        });
      }

      // Check: Temporal anomalies
      if (assign.ends_at && new Date(assign.ends_at).getTime() < now.getTime()) {
        issues.push({
          type: 'temporal_anomaly_expired',
          severity: 'warning',
          message: `Assignment has status active but end date (${assign.ends_at}) has already passed`,
          assignmentId: assign.id,
        });
      }

      if (new Date(assign.starts_at).getTime() > now.getTime()) {
        issues.push({
          type: 'temporal_anomaly_future_active',
          severity: 'info',
          message: `Assignment has status active but start date (${assign.starts_at}) is in the future`,
          assignmentId: assign.id,
        });
      }

      // Check: Branch access mismatch
      if (assign.branch_id) {
        const allowedBranches = branchAccessMap.get(assign.business_membership_id);
        if (!allowedBranches || !allowedBranches.has(assign.branch_id)) {
          issues.push({
            type: 'branch_access_mismatch',
            severity: 'warning',
            message: `Staff member is assigned to branch ${assign.branch_id} organizationally, but does not have operational branch_assignment`,
            assignmentId: assign.id,
            membershipId: assign.business_membership_id,
          });
        }
      }

      // Check: Hierarchy anomaly (subordinate rank number is less than manager rank number)
      const reportsTo = assign.reports_to as unknown as { id: string; job_title?: { hierarchy_level?: { rank: number } } } | null;
      const mgrRank = reportsTo?.job_title?.hierarchy_level?.rank;
      if (rank !== undefined && mgrRank !== undefined && rank < mgrRank) {
        issues.push({
          type: 'hierarchy_anomaly',
          severity: 'info',
          message: `Subordinate hierarchy level (Rank ${rank}) has a higher seniority rank than their manager (Rank ${mgrRank})`,
          assignmentId: assign.id,
        });
      }
    }

    // 3. Check position occupancy (substantive occupants only, non-suspended)
    const { data: positions } = await admin
      .from('organization_positions')
      .select('id, headcount_limit, position_code, name_override')
      .eq('business_id', businessId)
      .eq('status', 'active');

    const posOccupantCount = new Map<string, number>();
    for (const assign of assignments || []) {
      const mem = assign.membership as { membership_status?: string } | null;
      const isSuspended = mem?.membership_status === 'suspended';
      if (assign.position_id && assign.is_primary && !isSuspended) {
        posOccupantCount.set(assign.position_id, (posOccupantCount.get(assign.position_id) || 0) + 1);
      }
    }

    for (const pos of positions || []) {
      const count = posOccupantCount.get(pos.id) || 0;
      if (count > pos.headcount_limit) {
        issues.push({
          type: 'position_over_capacity',
          severity: 'error',
          message: `Position ${pos.position_code || pos.id} is over capacity (${count} / ${pos.headcount_limit})`,
          positionId: pos.id,
        });
      }
    }

    return issues;
  }

  // ==========================================
  // 19. UI Listing & Aggregation Helpers
  // ==========================================

  static async getOrganizationSummary(businessId: string) {
    const admin = createAdminClient();

    const [
      { count: totalMembersCount },
      { data: assignments },
      { count: departmentsCount },
      { count: unitsCount },
      { data: positions },
      { data: absences },
      issues,
    ] = await Promise.all([
      admin.from('business_memberships').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('membership_status', 'active'),
      admin.from('staff_assignments').select('id, assignment_type, is_primary, status, position_id').eq('business_id', businessId).eq('status', 'active'),
      admin.from('organization_departments').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('is_active', true),
      admin.from('organization_units').select('*', { count: 'exact', head: true }).eq('business_id', businessId).eq('is_active', true),
      admin.from('organization_positions').select('id, headcount_limit, status').eq('business_id', businessId).eq('status', 'active'),
      admin.from('organization_assignment_absences').select('id').eq('business_id', businessId).eq('status', 'active'),
      this.getOrganizationIntegrityIssues(businessId),
    ]);

    const activeAssignments = assignments || [];
    const activePositions = positions || [];

    const activePrimaryCount = activeAssignments.filter((a) => a.is_primary).length;
    const activeActingCount = activeAssignments.filter((a) => a.assignment_type === 'acting').length;
    const activeSecondmentsCount = activeAssignments.filter((a) => a.assignment_type === 'secondment').length;
    const activeTemporaryCount = activeAssignments.filter((a) => a.assignment_type === 'temporary').length;

    let totalHeadcountLimit = 0;
    const posOccupantMap = new Map<string, number>();

    for (const a of activeAssignments) {
      if (a.position_id && a.is_primary) {
        posOccupantMap.set(a.position_id, (posOccupantMap.get(a.position_id) || 0) + 1);
      }
    }

    let occupiedPositionsCount = 0;
    let vacantPositionsCount = 0;

    for (const p of activePositions) {
      const limit = p.headcount_limit || 1;
      totalHeadcountLimit += limit;
      const count = posOccupantMap.get(p.id) || 0;
      if (count >= limit) {
        occupiedPositionsCount++;
      } else {
        vacantPositionsCount++;
      }
    }

    return {
      totalMembers: totalMembersCount || 0,
      activePrimaryAssignments: activePrimaryCount,
      departmentsCount: departmentsCount || 0,
      unitsCount: unitsCount || 0,
      positionsCount: activePositions.length,
      totalHeadcountLimit,
      occupiedPositionsCount,
      vacantPositionsCount,
      activeActingCount,
      activeSecondmentsCount,
      activeTemporaryCount,
      activeAbsencesCount: absences?.length || 0,
      integrityIssuesCount: issues.length,
      criticalIssuesCount: issues.filter((i) => i.severity === 'error').length,
    };
  }

  static async listOrganizationStaff(
    businessId: string,
    options?: {
      branchId?: string | null;
      departmentId?: string;
      jobTitleId?: string;
      search?: string;
      allowedBranchIds?: string[] | null;
      scope?: 'all' | 'corporate' | 'unassigned' | 'branch';
    }
  ) {
    const admin = createAdminClient();

    // 1. Fetch active memberships, assignments, and branch access in parallel
    const [
      { data: members, error: memErr },
      { data: assignments, error: assignErr },
      { data: branchAccessList },
    ] = await Promise.all([
      admin
        .from('business_memberships')
        .select(`
          id,
          business_id,
          user_id,
          role,
          custom_role_id,
          custom_role:custom_roles(id, name),
          membership_status,
          created_at
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      admin
        .from('staff_assignments')
        .select(`
          id,
          business_membership_id,
          assignment_type,
          is_primary,
          status,
          starts_at,
          ends_at,
          reports_to_assignment_id,
          acting_for_assignment_id,
          source_assignment_id,
          branch:branches(id, name, code),
          department:organization_departments(id, name, code),
          unit:organization_units(id, name, code),
          position:organization_positions(id, position_code),
          job_title:organization_job_titles(id, name, code, hierarchy_level:organization_hierarchy_levels(id, name, rank))
        `)
        .eq('business_id', businessId)
        .eq('status', 'active'),
      admin
        .from('branch_assignments')
        .select('business_membership_id, branch_id'),
    ]);

    if (memErr) throw new Error(`Failed to list staff: ${memErr.message}`);
    if (assignErr) throw new Error(`Failed to fetch assignments: ${assignErr.message}`);

    // Map membership ID to membership object
    const memberMap = new Map((members || []).map((m) => [m.id, m]));

    // 2. Collect all user IDs across members
    const userIds = new Set<string>();
    for (const m of members || []) {
      if (m.user_id) userIds.add(m.user_id);
    }

    // 3. Batch fetch profiles
    const { data: profiles, error: profErr } = userIds.size > 0
      ? await admin.from('user_profiles').select('id, first_name, last_name').in('id', Array.from(userIds))
      : { data: [], error: null };

    if (profErr) throw new Error(`Failed to fetch user profiles: ${profErr.message}`);
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    type AssignmentItem = NonNullable<typeof assignments>[number] & {
      reports_to?: {
        id: string;
        job_title?: { id: string; name: string } | null;
        branch?: { id: string; name: string; code: string } | null;
        membership?: {
          id: string;
          user_id: string;
          role: string;
          user_profiles?: { id: string; first_name?: string | null; last_name?: string | null } | null;
        } | null;
      } | null;
      acting_for?: {
        id: string;
        job_title?: { id: string; name: string } | null;
        branch?: { id: string; name: string; code: string } | null;
        membership?: {
          id: string;
          user_id: string;
          role: string;
          user_profiles?: { id: string; first_name?: string | null; last_name?: string | null } | null;
        } | null;
      } | null;
    };

    // 4. Normalize assignments and index them by ID
    const assignmentMap = new Map<string, AssignmentItem>();
    for (const rawA of (assignments || []) as Record<string, unknown>[]) {
      if (Array.isArray(rawA.branch)) rawA.branch = rawA.branch[0] || null;
      if (Array.isArray(rawA.department)) rawA.department = rawA.department[0] || null;
      if (Array.isArray(rawA.unit)) rawA.unit = rawA.unit[0] || null;
      if (Array.isArray(rawA.job_title)) rawA.job_title = rawA.job_title[0] || null;
      assignmentMap.set(rawA.id as string, rawA as AssignmentItem);
    }

    // 5. Deterministically resolve reports_to and acting_for links
    for (const a of assignmentMap.values()) {
      if (a.reports_to_assignment_id) {
        const mgrAssign = assignmentMap.get(a.reports_to_assignment_id as string);
        if (mgrAssign) {
          const mgrMem = memberMap.get(mgrAssign.business_membership_id as string);
          const mgrProf = mgrMem?.user_id ? profileMap.get(mgrMem.user_id) : null;
          a.reports_to = {
            id: mgrAssign.id,
            job_title: mgrAssign.job_title as unknown as { id: string; name: string } | null,
            branch: mgrAssign.branch as unknown as { id: string; name: string; code: string } | null,
            membership: mgrMem ? {
              id: mgrMem.id,
              user_id: mgrMem.user_id,
              role: mgrMem.role,
              user_profiles: mgrProf || null,
            } : null,
          };
        } else {
          a.reports_to = null;
        }
      } else {
        a.reports_to = null;
      }

      if (a.acting_for_assignment_id) {
        const actAssign = assignmentMap.get(a.acting_for_assignment_id as string);
        if (actAssign) {
          const actMem = memberMap.get(actAssign.business_membership_id as string);
          const actProf = actMem?.user_id ? profileMap.get(actMem.user_id) : null;
          a.acting_for = {
            id: actAssign.id,
            job_title: actAssign.job_title as unknown as { id: string; name: string } | null,
            branch: actAssign.branch as unknown as { id: string; name: string; code: string } | null,
            membership: actMem ? {
              id: actMem.id,
              user_id: actMem.user_id,
              role: actMem.role,
              user_profiles: actProf || null,
            } : null,
          };
        } else {
          a.acting_for = null;
        }
      } else {
        a.acting_for = null;
      }
    }

    // 6. Fetch branch access mappings
    const branchAccessMap = new Map<string, Set<string>>();
    for (const ba of branchAccessList || []) {
      if (!branchAccessMap.has(ba.business_membership_id)) {
        branchAccessMap.set(ba.business_membership_id, new Set());
      }
      branchAccessMap.get(ba.business_membership_id)!.add(ba.branch_id);
    }

    const memberAssignmentsMap = new Map<string, AssignmentItem[]>();
    for (const a of (assignments || []) as AssignmentItem[]) {
      if (!memberAssignmentsMap.has(a.business_membership_id)) {
        memberAssignmentsMap.set(a.business_membership_id, []);
      }
      memberAssignmentsMap.get(a.business_membership_id)!.push(a);
    }

    // Compose staff directory list
    const staffList = (members || []).map((m) => {
      const userProfile = profileMap.get(m.user_id);
      const firstName = userProfile?.first_name || '';
      const lastName = userProfile?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim() || 'Staff Member';

      const memberAssigns = memberAssignmentsMap.get(m.id) || [];
      const primaryAssign = memberAssigns.find((a) => a.is_primary) || null;
      const actingAssigns = memberAssigns.filter((a) => a.assignment_type === 'acting');
      const secondmentAssigns = memberAssigns.filter((a) => a.assignment_type === 'secondment');
      const temporaryAssigns = memberAssigns.filter((a) => a.assignment_type === 'temporary');
      const additionalAssigns = memberAssigns.filter((a) => !a.is_primary && a.assignment_type !== 'acting' && a.assignment_type !== 'secondment' && a.assignment_type !== 'temporary');

      let hasBranchAccessMismatch = false;
      const allowedBranches = branchAccessMap.get(m.id) || new Set();
      for (const a of memberAssigns) {
        const branch = a.branch as unknown as { id: string } | null;
        if (branch?.id && !allowedBranches.has(branch.id)) {
          hasBranchAccessMismatch = true;
          break;
        }
      }

      const hasPrimaryAssignment = Boolean(primaryAssign);
      const isCorporate = Boolean(primaryAssign && !primaryAssign.branch);
      const isUnassigned = !primaryAssign;

      const rawCustomRole = (m as unknown as { custom_role?: { id?: string; name?: string } | Array<{ id?: string; name?: string }> })?.custom_role;
      const customRoleObj = Array.isArray(rawCustomRole) ? rawCustomRole[0] : rawCustomRole;
      const customRoleName = customRoleObj?.name || null;
      const customRoleId = m.custom_role_id || customRoleObj?.id || null;

      return {
        membershipId: m.id,
        userId: m.user_id,
        fullName,
        role: m.role,
        customRoleId,
        customRoleName,
        status: m.membership_status,
        primaryAssignment: primaryAssign,
        actingAssignments: actingAssigns,
        secondmentAssignments: secondmentAssigns,
        temporaryAssignments: temporaryAssigns,
        additionalAssignments: additionalAssigns,
        totalActiveAssignments: memberAssigns.length,
        hasBranchAccessMismatch,
        hasPrimaryAssignment,
        isCorporate,
        isUnassigned,
      };
    });

    // 5. Server-side security enforcement for branch-scoped users
    let filtered = staffList;
    if (options?.allowedBranchIds && options.allowedBranchIds.length > 0) {
      const allowedSet = new Set(options.allowedBranchIds);
      filtered = filtered.filter((s) => {
        const pBranchId = (s.primaryAssignment?.branch as unknown as { id: string } | null)?.id;
        if (pBranchId && allowedSet.has(pBranchId)) return true;
        // Check active secondments to allowed branch
        const hasSecToAllowed = s.secondmentAssignments.some((sec) => {
          const secBranchId = (sec as unknown as { branch?: { id: string } }).branch?.id;
          return secBranchId && allowedSet.has(secBranchId);
        });
        if (hasSecToAllowed) return true;
        // Check branch access
        const memberBranchAccess = branchAccessMap.get(s.membershipId);
        if (memberBranchAccess) {
          for (const bId of options.allowedBranchIds!) {
            if (memberBranchAccess.has(bId)) return true;
          }
        }
        return false;
      });
    }

    // 6. Branch / Scope filtering
    if (options?.scope === 'corporate' || options?.branchId === 'corporate') {
      filtered = filtered.filter((s) => s.isCorporate);
    } else if (options?.scope === 'unassigned' || options?.branchId === 'unassigned') {
      filtered = filtered.filter((s) => s.isUnassigned);
    } else if (options?.branchId && options.branchId !== 'all') {
      const targetBranchId: string = options.branchId;
      filtered = filtered.filter((s) => {
        const pBranch = s.primaryAssignment?.branch as unknown as { id: string } | null;
        if (pBranch?.id === targetBranchId) return true;
        // Also match staff seconded to this branch
        const isSecondedHere = s.secondmentAssignments.some((sec) => {
          const secBranch = (sec as unknown as { branch?: { id: string } }).branch;
          return secBranch?.id === targetBranchId;
        });
        if (isSecondedHere) return true;
        // Also include operationally-assigned staff with no org placement (legacy/new staff):
        // They appear in the directory as "Unassigned" but are visible within their operational branch.
        if (s.isUnassigned) {
          const memberBranchAccess = branchAccessMap.get(s.membershipId);
          if (memberBranchAccess?.has(targetBranchId)) return true;
        }
        return false;
      });
    }

    // 7. Additional multi-filters
    if (options?.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter((s) => {
        const nameMatch = s.fullName.toLowerCase().includes(q);
        const pJob = s.primaryAssignment?.job_title as unknown as { name?: string } | null;
        const titleMatch = pJob?.name?.toLowerCase().includes(q);
        return Boolean(nameMatch || titleMatch);
      });
    }
    if (options?.departmentId && options.departmentId !== 'all') {
      filtered = filtered.filter((s) => {
        const pDept = s.primaryAssignment?.department as unknown as { id: string } | null;
        return pDept?.id === options.departmentId;
      });
    }
    if (options?.jobTitleId && options.jobTitleId !== 'all') {
      filtered = filtered.filter((s) => {
        const pJob = s.primaryAssignment?.job_title as unknown as { id: string } | null;
        return pJob?.id === options.jobTitleId;
      });
    }

    return filtered;
  }

  static async listAllPositionsWithCoverage(
    businessId: string,
    options?: { branchId?: string; departmentId?: string }
  ) {
    const admin = createAdminClient();

    let query = admin
      .from('organization_positions')
      .select(`
        *,
        job_title:organization_job_titles(id, name, code, is_management, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        department:organization_departments(id, name, code),
        unit:organization_units(id, name, code),
        branch:branches(id, name, code)
      `)
      .eq('business_id', businessId)
      .order('position_code', { ascending: true });

    if (options?.branchId) query = query.eq('branch_id', options.branchId);
    if (options?.departmentId) query = query.eq('department_id', options.departmentId);

    const { data: positions, error } = await query;
    if (error) throw new Error(`Failed to list positions: ${error.message}`);

    const nowIso = new Date().toISOString();

    // Fetch all active assignments for business
    const { data: assignments, error: assignErr } = await admin
      .from('staff_assignments')
      .select(`
        id,
        position_id,
        *,
        job_title:organization_job_titles(id, name, code),
        membership:business_memberships(id, user_id, role)
      `)
      .eq('business_id', businessId)
      .eq('status', 'active')
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .is('archived_at', null);

    if (assignErr) throw new Error(`Failed to fetch position assignments: ${assignErr.message}`);

    const userIds = Array.from(
      new Set(
        (assignments || [])
          .map((a) => (a.membership as { user_id?: string } | null)?.user_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const { data: profiles } = userIds.length > 0
      ? await admin.from('user_profiles').select('id, first_name, last_name').in('id', userIds)
      : { data: [] };
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    type RelMember = { user_id?: string; user_profiles?: { id: string; first_name?: string | null; last_name?: string | null } | null };
    type RelAssignment = {
      membership?: RelMember | null;
      position_id?: string | null;
      assignment_type?: string;
    };

    for (const a of (assignments || []) as RelAssignment[]) {
      const mem = a.membership;
      if (mem?.user_id) {
        mem.user_profiles = profileMap.get(mem.user_id) || null;
      }
    }

    type PositionAssignment = NonNullable<typeof assignments>[number];
    const posSubstantiveMap = new Map<string, PositionAssignment[]>();
    const posActingMap = new Map<string, PositionAssignment[]>();
    const posSecondmentMap = new Map<string, PositionAssignment[]>();
    const posTemporaryMap = new Map<string, PositionAssignment[]>();

    for (const a of assignments || []) {
      const mem = a.membership as { membership_status?: string } | null;
      const isSuspended = mem?.membership_status === 'suspended';

      if (a.position_id) {
        if (a.assignment_type === 'acting') {
          if (!posActingMap.has(a.position_id)) posActingMap.set(a.position_id, []);
          posActingMap.get(a.position_id)!.push(a);
        } else if (a.assignment_type === 'secondment') {
          if (!posSecondmentMap.has(a.position_id)) posSecondmentMap.set(a.position_id, []);
          posSecondmentMap.get(a.position_id)!.push(a);
        } else if (a.assignment_type === 'temporary') {
          if (!posTemporaryMap.has(a.position_id)) posTemporaryMap.set(a.position_id, []);
          posTemporaryMap.get(a.position_id)!.push(a);
        } else if (a.is_primary && !isSuspended) {
          if (!posSubstantiveMap.has(a.position_id)) posSubstantiveMap.set(a.position_id, []);
          posSubstantiveMap.get(a.position_id)!.push(a);
        }
      }
    }

    return (positions || []).map((p) => {
      const substantiveOccupants = posSubstantiveMap.get(p.id) || [];
      const actingCoverage = posActingMap.get(p.id) || [];
      const secondmentAssignments = posSecondmentMap.get(p.id) || [];
      const temporaryAssignments = posTemporaryMap.get(p.id) || [];
      const occupiedCount = substantiveOccupants.length;
      const limit = p.headcount_limit || 1;
      const availableSlots = Math.max(0, limit - occupiedCount);
      const isFull = occupiedCount >= limit;

      let coverageState: 'vacant' | 'occupied' | 'acting_covered' | 'over_capacity' | 'frozen' | 'archived' = 'vacant';
      if (p.status === 'frozen') coverageState = 'frozen';
      else if (p.status === 'archived') coverageState = 'archived';
      else if (occupiedCount > limit) coverageState = 'over_capacity';
      else if (actingCoverage.length > 0) coverageState = 'acting_covered';
      else if (occupiedCount > 0) coverageState = 'occupied';

      return {
        ...p,
        substantiveOccupants,
        actingCoverage,
        secondmentAssignments,
        temporaryAssignments,
        occupiedCount,
        availableSlots,
        isFull,
        coverageState,
      };
    });
  }

  static async listActingAssignments(businessId: string, options?: { activeOnly?: boolean }) {
    const admin = createAdminClient();

    let query = admin
      .from('staff_assignments')
      .select(`
        *,
        membership:business_memberships(id, user_id, role),
        job_title:organization_job_titles(id, name, code),
        position:organization_positions(id, position_code),
        branch:branches(id, name, code),
        department:organization_departments(id, name, code),
        acting_for:staff_assignments!acting_for_assignment_id(
          id,
          job_title:organization_job_titles(id, name),
          membership:business_memberships(id, user_id, role)
        ),
        coverage_absence:organization_assignment_absences!coverage_absence_id(
          id,
          absence_type,
          starts_at,
          ends_at,
          reason,
          status
        )
      `)
      .eq('business_id', businessId)
      .eq('assignment_type', 'acting')
      .order('starts_at', { ascending: false });

    if (options?.activeOnly) {
      query = query.eq('status', 'active');
    }

    const { data: actingRaw, error } = await query;
    if (error) throw new Error(`Failed to list acting assignments: ${error.message}`);

    type RelMember = { user_id?: string; user_profiles?: { id: string; first_name?: string | null; last_name?: string | null } | null };
    type RelAssignment = {
      membership?: RelMember | null;
      acting_for?: { membership?: RelMember | null } | null;
    };

    const userIds = new Set<string>();
    for (const a of (actingRaw || []) as RelAssignment[]) {
      if (a.membership?.user_id) userIds.add(a.membership.user_id);
      const actMem = a.acting_for?.membership;
      if (actMem?.user_id) userIds.add(actMem.user_id);
    }

    const { data: profiles } = userIds.size > 0
      ? await admin.from('user_profiles').select('id, first_name, last_name').in('id', Array.from(userIds))
      : { data: [] };

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    for (const a of (actingRaw || []) as RelAssignment[]) {
      if (a.membership?.user_id) {
        a.membership.user_profiles = profileMap.get(a.membership.user_id) || null;
      }
      const actMem = a.acting_for?.membership;
      if (actMem?.user_id) {
        actMem.user_profiles = profileMap.get(actMem.user_id) || null;
      }
    }

    return actingRaw || [];
  }

  static async listSecondments(businessId: string, options?: { activeOnly?: boolean }) {
    const admin = createAdminClient();

    let query = admin
      .from('staff_assignments')
      .select(`
        *,
        membership:business_memberships(id, user_id, role),
        job_title:organization_job_titles(id, name, code),
        position:organization_positions(id, position_code),
        branch:branches(id, name, code),
        department:organization_departments(id, name, code),
        source_assignment:staff_assignments!source_assignment_id(
          id,
          branch:branches(id, name, code),
          department:organization_departments(id, name, code),
          job_title:organization_job_titles(id, name)
        )
      `)
      .eq('business_id', businessId)
      .eq('assignment_type', 'secondment')
      .order('starts_at', { ascending: false });

    if (options?.activeOnly) {
      query = query.eq('status', 'active');
    }

    const { data: secondmentsRaw, error } = await query;
    if (error) throw new Error(`Failed to list secondments: ${error.message}`);

    type RelMember = { user_id?: string; user_profiles?: { id: string; first_name?: string | null; last_name?: string | null } | null };
    type RelAssignment = {
      membership?: RelMember | null;
    };

    const userIds = new Set<string>();
    for (const s of (secondmentsRaw || []) as RelAssignment[]) {
      if (s.membership?.user_id) userIds.add(s.membership.user_id);
    }

    const { data: profiles } = userIds.size > 0
      ? await admin.from('user_profiles').select('id, first_name, last_name').in('id', Array.from(userIds))
      : { data: [] };

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    for (const s of (secondmentsRaw || []) as RelAssignment[]) {
      if (s.membership?.user_id) {
        s.membership.user_profiles = profileMap.get(s.membership.user_id) || null;
      }
    }

    return secondmentsRaw || [];
  }
}
