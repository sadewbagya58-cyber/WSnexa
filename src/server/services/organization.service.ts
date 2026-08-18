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

export class OrganizationService {
  // ==========================================
  // 1. Internal Validation Helpers
  // ==========================================

  static async validateBranchBelongsToBusiness(branchId: string, businessId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('branches')
      .select('id, business_id')
      .eq('id', branchId)
      .maybeSingle();

    if (error || !data || data.business_id !== businessId) {
      return false;
    }
    return true;
  }

  static async validateDepartmentBelongsToBusiness(departmentId: string, businessId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_departments')
      .select('id, business_id, branch_id')
      .eq('id', departmentId)
      .maybeSingle();

    if (error || !data || data.business_id !== businessId) {
      return false;
    }
    return true;
  }

  static async validateUnitBelongsToDepartment(unitId: string, departmentId: string, businessId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_units')
      .select('id, business_id, department_id')
      .eq('id', unitId)
      .maybeSingle();

    if (error || !data || data.business_id !== businessId || data.department_id !== departmentId) {
      return false;
    }
    return true;
  }

  static async validateJobTitleBelongsToBusiness(jobTitleId: string, businessId: string): Promise<boolean> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_job_titles')
      .select('id, business_id')
      .eq('id', jobTitleId)
      .maybeSingle();

    if (error || !data || data.business_id !== businessId) {
      return false;
    }
    return true;
  }

  static async validatePositionHierarchy(
    positionId: string,
    businessId: string,
    expectedBranchId?: string | null,
    expectedDepartmentId?: string | null,
    expectedUnitId?: string | null
  ): Promise<boolean> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_positions')
      .select('id, business_id, branch_id, department_id, unit_id')
      .eq('id', positionId)
      .maybeSingle();

    if (error || !data || data.business_id !== businessId) {
      return false;
    }

    if (expectedBranchId !== undefined && data.branch_id !== expectedBranchId) {
      return false;
    }
    if (expectedDepartmentId !== undefined && data.department_id !== expectedDepartmentId) {
      return false;
    }
    if (expectedUnitId !== undefined && data.unit_id !== expectedUnitId) {
      return false;
    }

    return true;
  }

  static async validateAssignmentEntities(
    businessId: string,
    membershipId: string,
    jobTitleId: string,
    branchId?: string | null,
    departmentId?: string | null,
    unitId?: string | null,
    positionId?: string | null
  ): Promise<{ valid: boolean; error?: string }> {
    const admin = createAdminClient();

    // Check membership
    const { data: member } = await admin
      .from('business_memberships')
      .select('id, business_id')
      .eq('id', membershipId)
      .maybeSingle();

    if (!member || member.business_id !== businessId) {
      return { valid: false, error: 'Business membership does not belong to the given business' };
    }

    // Check job title
    const validJt = await this.validateJobTitleBelongsToBusiness(jobTitleId, businessId);
    if (!validJt) {
      return { valid: false, error: 'Job title does not belong to the given business' };
    }

    // Check branch if provided
    if (branchId) {
      const validBranch = await this.validateBranchBelongsToBusiness(branchId, businessId);
      if (!validBranch) {
        return { valid: false, error: 'Branch does not belong to the given business' };
      }
    }

    // Check department if provided
    if (departmentId) {
      const validDept = await this.validateDepartmentBelongsToBusiness(departmentId, businessId);
      if (!validDept) {
        return { valid: false, error: 'Department does not belong to the given business' };
      }
    }

    // Check unit if provided
    if (unitId) {
      if (!departmentId) {
        return { valid: false, error: 'Department is required when specifying an organization unit' };
      }
      const validUnit = await this.validateUnitBelongsToDepartment(unitId, departmentId, businessId);
      if (!validUnit) {
        return { valid: false, error: 'Organization unit does not belong to the given department or business' };
      }
    }

    // Check position if provided
    if (positionId) {
      const validPos = await this.validatePositionHierarchy(positionId, businessId, branchId, departmentId, unitId);
      if (!validPos) {
        return { valid: false, error: 'Position does not match the provided organizational hierarchy context' };
      }

      // Check job title matches position job title
      const { data: pos } = await admin
        .from('organization_positions')
        .select('job_title_id')
        .eq('id', positionId)
        .maybeSingle();

      if (pos && pos.job_title_id !== jobTitleId) {
        return { valid: false, error: 'Assignment job title must match position job title' };
      }
    }

    return { valid: true };
  }

  // ==========================================
  // 2. Hierarchy Levels
  // ==========================================

  static async getHierarchyLevels(businessId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_hierarchy_levels')
      .select('*')
      .eq('business_id', businessId)
      .order('rank', { ascending: true });

    if (error) throw new Error(`Failed to fetch hierarchy levels: ${error.message}`);
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

    if (error) throw new Error(`Failed to create hierarchy level: ${error.message}`);
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

    if (error) throw new Error(`Failed to update hierarchy level: ${error.message}`);
    return data;
  }

  static async ensureDefaultHierarchyLevels(businessId: string) {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('organization_hierarchy_levels')
      .select('id')
      .eq('business_id', businessId)
      .limit(1);

    if (!existing || existing.length === 0) {
      const inserts = DEFAULT_ORGANIZATION_HIERARCHY_LEVELS.map((lvl) => ({
        business_id: businessId,
        rank: lvl.rank,
        name: lvl.name,
        is_management: lvl.isManagement,
        is_active: true,
      }));

      await admin.from('organization_hierarchy_levels').insert(inserts);
    }
  }

  // ==========================================
  // 3. Departments
  // ==========================================

  static async getDepartments(businessId: string, options?: { branchId?: string | null; activeOnly?: boolean }) {
    const admin = createAdminClient();
    let query = admin
      .from('organization_departments')
      .select('*, branch:branches(id, name, code), parent_department:organization_departments!parent_department_id(id, name, code)')
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
      .select('*, branch:branches(id, name, code), parent_department:organization_departments!parent_department_id(id, name, code)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch department: ${error.message}`);
    return data;
  }

  static async createDepartment(input: CreateDepartmentInput) {
    const parsed = createDepartmentSchema.parse(input);
    const admin = createAdminClient();

    if (parsed.branchId) {
      const valid = await this.validateBranchBelongsToBusiness(parsed.branchId, parsed.businessId);
      if (!valid) throw new Error('Branch does not belong to the given business');
    }
    if (parsed.parentDepartmentId) {
      const valid = await this.validateDepartmentBelongsToBusiness(parsed.parentDepartmentId, parsed.businessId);
      if (!valid) throw new Error('Parent department does not belong to the given business');
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

  static async archiveDepartment(id: string, businessId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_departments')
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw new Error(`Failed to archive department: ${error.message}`);
    return data;
  }

  // ==========================================
  // 4. Organization Units
  // ==========================================

  static async getUnits(
    businessId: string,
    options?: { departmentId?: string; branchId?: string | null; activeOnly?: boolean }
  ) {
    const admin = createAdminClient();
    let query = admin
      .from('organization_units')
      .select('*, department:organization_departments(id, name, code), branch:branches(id, name, code), parent_unit:organization_units!parent_unit_id(id, name, code)')
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
    if (error) throw new Error(`Failed to fetch units: ${error.message}`);
    return data || [];
  }

  static async getUnitById(id: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_units')
      .select('*, department:organization_departments(id, name, code), branch:branches(id, name, code), parent_unit:organization_units!parent_unit_id(id, name, code)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch unit: ${error.message}`);
    return data;
  }

  static async createUnit(input: CreateOrganizationUnitInput) {
    const parsed = createOrganizationUnitSchema.parse(input);
    const admin = createAdminClient();

    const validDept = await this.validateDepartmentBelongsToBusiness(parsed.departmentId, parsed.businessId);
    if (!validDept) throw new Error('Department does not belong to the given business');

    if (parsed.branchId) {
      const validBranch = await this.validateBranchBelongsToBusiness(parsed.branchId, parsed.businessId);
      if (!validBranch) throw new Error('Branch does not belong to the given business');
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

    if (error) throw new Error(`Failed to create unit: ${error.message}`);
    return data;
  }

  static async updateUnit(input: UpdateOrganizationUnitInput) {
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

    if (error) throw new Error(`Failed to update unit: ${error.message}`);
    return data;
  }

  static async archiveUnit(id: string, businessId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_units')
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw new Error(`Failed to archive unit: ${error.message}`);
    return data;
  }

  // ==========================================
  // 5. Job Titles
  // ==========================================

  static async getJobTitles(
    businessId: string,
    options?: { hierarchyLevelId?: string; activeOnly?: boolean }
  ) {
    const admin = createAdminClient();
    let query = admin
      .from('organization_job_titles')
      .select('*, hierarchy_level:organization_hierarchy_levels(id, name, rank, is_management)')
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

  static async getJobTitleById(id: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_job_titles')
      .select('*, hierarchy_level:organization_hierarchy_levels(id, name, rank, is_management)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch job title: ${error.message}`);
    return data;
  }

  static async createJobTitle(input: CreateJobTitleInput) {
    const parsed = createJobTitleSchema.parse(input);
    const admin = createAdminClient();

    const { data: level } = await admin
      .from('organization_hierarchy_levels')
      .select('id, business_id')
      .eq('id', parsed.hierarchyLevelId)
      .maybeSingle();

    if (!level || level.business_id !== parsed.businessId) {
      throw new Error('Hierarchy level does not belong to the given business');
    }

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

  static async archiveJobTitle(id: string, businessId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_job_titles')
      .update({
        is_active: false,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw new Error(`Failed to archive job title: ${error.message}`);
    return data;
  }

  // ==========================================
  // 6. Positions & Occupancy
  // ==========================================

  static async getPositions(
    businessId: string,
    options?: {
      branchId?: string | null;
      departmentId?: string;
      unitId?: string;
      status?: string;
      activeOnly?: boolean;
    }
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
      .order('created_at', { ascending: false });

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
    if (options?.unitId) {
      query = query.eq('unit_id', options.unitId);
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

    if (posErr || !pos) throw new Error(`Position ${positionId} not found`);

    const refIso = referenceDate.toISOString();
    const { data: occupants, error: occErr } = await admin
      .from('staff_assignments')
      .select('id, assignment_type, is_primary, starts_at, ends_at, business_membership_id')
      .eq('position_id', positionId)
      .eq('status', 'active')
      .lte('starts_at', refIso)
      .or(`ends_at.is.null,ends_at.gt.${refIso}`)
      .is('archived_at', null);

    if (occErr) throw new Error(`Failed to calculate position occupancy: ${occErr.message}`);

    const occupiedCount = occupants?.length || 0;
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
      occupants: occupants || [],
    };
  }

  static async createPosition(input: CreatePositionInput) {
    const parsed = createPositionSchema.parse(input);
    const admin = createAdminClient();

    const validJt = await this.validateJobTitleBelongsToBusiness(parsed.jobTitleId, parsed.businessId);
    if (!validJt) throw new Error('Job title does not belong to the given business');

    if (parsed.branchId) {
      const validBranch = await this.validateBranchBelongsToBusiness(parsed.branchId, parsed.businessId);
      if (!validBranch) throw new Error('Branch does not belong to the given business');
    }
    if (parsed.departmentId) {
      const validDept = await this.validateDepartmentBelongsToBusiness(parsed.departmentId, parsed.businessId);
      if (!validDept) throw new Error('Department does not belong to the given business');
    }
    if (parsed.unitId) {
      if (!parsed.departmentId) throw new Error('Department is required when specifying an organization unit');
      const validUnit = await this.validateUnitBelongsToDepartment(parsed.unitId, parsed.departmentId, parsed.businessId);
      if (!validUnit) throw new Error('Organization unit does not belong to the given department or business');
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

  static async archivePosition(id: string, businessId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_positions')
      .update({
        status: 'archived',
        is_active: false,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw new Error(`Failed to archive position: ${error.message}`);
    return data;
  }

  // ==========================================
  // 7. Staff Assignments & Lifecycle
  // ==========================================

  static isAssignmentEffective(
    assignment: { status: string; starts_at: string; ends_at?: string | null },
    referenceDate: Date = new Date()
  ): boolean {
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

  static async getStaffAssignments(
    businessId: string,
    options?: {
      membershipId?: string;
      branchId?: string | null;
      departmentId?: string;
      positionId?: string;
      status?: string;
      activeOnly?: boolean;
      effectiveOnly?: boolean;
    }
  ) {
    const admin = createAdminClient();
    let query = admin
      .from('staff_assignments')
      .select(`
        *,
        job_title:organization_job_titles(id, name, code, is_management, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        position:organization_positions(id, position_code, name_override, headcount_limit),
        department:organization_departments(id, name, code),
        unit:organization_units(id, name, code),
        branch:branches(id, name, code),
        membership:business_memberships(id, user_id, role, membership_status)
      `)
      .eq('business_id', businessId)
      .order('starts_at', { ascending: false });

    if (options?.membershipId) {
      query = query.eq('business_membership_id', options.membershipId);
    }
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
    if (options?.positionId) {
      query = query.eq('position_id', options.positionId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.effectiveOnly) {
      const nowIso = new Date().toISOString();
      query = query
        .eq('status', 'active')
        .lte('starts_at', nowIso)
        .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
        .is('archived_at', null);
    } else if (options?.activeOnly) {
      query = query.eq('status', 'active').is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch staff assignments: ${error.message}`);
    return data || [];
  }

  static async getStaffAssignmentById(id: string) {
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
        membership:business_memberships(id, user_id, role, membership_status),
        reports_to:staff_assignments!reports_to_assignment_id(
          id,
          assignment_type,
          is_primary,
          status,
          job_title:organization_job_titles(id, name, code, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
          membership:business_memberships(id, user_id, role)
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch staff assignment: ${error.message}`);
    return data;
  }

  static async createStaffAssignment(input: CreateStaffAssignmentInput, actorId?: string) {
    const parsed = createStaffAssignmentSchema.parse(input);
    const admin = createAdminClient();

    // Validate assignment entities
    const validation = await this.validateAssignmentEntities(
      parsed.businessId,
      parsed.businessMembershipId,
      parsed.jobTitleId,
      parsed.branchId,
      parsed.departmentId,
      parsed.unitId,
      parsed.positionId
    );

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid assignment entities');
    }

    const startsAtIso = typeof parsed.startsAt === 'string' ? parsed.startsAt : parsed.startsAt.toISOString();
    const endsAtIso = parsed.endsAt ? (typeof parsed.endsAt === 'string' ? parsed.endsAt : parsed.endsAt.toISOString()) : null;

    // Try executing via atomic RPC for concurrency & row locking protection
    const { data: rpcRes, error: rpcErr } = await admin.rpc('create_staff_assignment_atomic', {
      p_business_id: parsed.businessId,
      p_business_membership_id: parsed.businessMembershipId,
      p_job_title_id: parsed.jobTitleId,
      p_branch_id: parsed.branchId || null,
      p_department_id: parsed.departmentId || null,
      p_unit_id: parsed.unitId || null,
      p_position_id: parsed.positionId || null,
      p_assignment_type: parsed.assignmentType,
      p_is_primary: parsed.isPrimary,
      p_status: parsed.status,
      p_starts_at: startsAtIso,
      p_ends_at: endsAtIso,
      p_reports_to_id: parsed.reportsToAssignmentId || null,
      p_acting_for_id: parsed.actingForAssignmentId || null,
      p_reason: parsed.reason || null,
      p_actor_id: actorId || null,
    });

    if (!rpcErr && rpcRes && rpcRes.assignment_id) {
      const created = await this.getStaffAssignmentById(rpcRes.assignment_id);
      if (created) return created;
    }

    if (rpcErr) {
      throw new Error(rpcErr.message);
    }

    // Fallback direct insert if RPC not present
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
        assignment_type: parsed.assignmentType,
        is_primary: parsed.isPrimary,
        status: parsed.status,
        starts_at: startsAtIso,
        ends_at: endsAtIso,
        acting_for_assignment_id: parsed.actingForAssignmentId || null,
        reports_to_assignment_id: parsed.reportsToAssignmentId || null,
        reason: parsed.reason || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create staff assignment: ${error.message}`);

    // If manager was assigned, record reporting history
    if (parsed.reportsToAssignmentId) {
      await admin.from('organization_reporting_history').insert({
        business_id: parsed.businessId,
        assignment_id: data.id,
        previous_manager_assignment_id: null,
        new_manager_assignment_id: parsed.reportsToAssignmentId,
        reason: parsed.reason || 'Initial reporting manager assignment',
        changed_by: actorId || null,
        changed_at: data.starts_at,
      });
    }

    return data;
  }

  static async createAdditionalAssignment(input: CreateAdditionalAssignmentInput, actorId?: string) {
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

  static async endStaffAssignment(input: EndStaffAssignmentInput) {
    const parsed = endStaffAssignmentSchema.parse(input);
    const admin = createAdminClient();

    const endedAtStr = typeof parsed.endedAt === 'string' ? parsed.endedAt : parsed.endedAt.toISOString();

    // Preserve historical assignment_type and is_primary unchanged
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
    return data;
  }

  // ==========================================
  // 8. Atomic Transitions (Promotion / Transfer)
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

    // Fallback: If RPC is not present or returns error, execute safely via service logic
    if (rpcErr) {
      // Validate target position capacity if specified
      let finalJobTitleId = parsed.newJobTitleId;
      let finalBranchId = parsed.newBranchId || null;
      let finalDeptId = parsed.newDepartmentId || null;
      let finalUnitId = parsed.newUnitId || null;

      if (parsed.newPositionId) {
        const occ = await this.getPositionOccupancy(parsed.newPositionId, new Date(transitionTimeStr));
        if (occ.isFull) {
          throw new Error(`Target position has reached maximum headcount limit (${occ.occupiedCount} / ${occ.headcountLimit} occupied)`);
        }
        if (occ.status === 'frozen' || occ.status === 'archived') {
          throw new Error(`Target position is ${occ.status} and cannot accept new assignments`);
        }

        const { data: pos } = await admin
          .from('organization_positions')
          .select('job_title_id, branch_id, department_id, unit_id')
          .eq('id', parsed.newPositionId)
          .single();

        if (pos) {
          finalJobTitleId = pos.job_title_id;
          finalBranchId = pos.branch_id;
          finalDeptId = pos.department_id;
          finalUnitId = pos.unit_id;
        }
      }

      if (!finalJobTitleId) {
        throw new Error('Either a valid target position or job title must be specified for transition');
      }

      // Step 1: End current primary
      await this.endStaffAssignment({
        id: current.id,
        endedAt: transitionTimeStr,
        reason: parsed.reason || `Transitioned via ${parsed.transitionType}`,
      });

      // Step 2: Create new primary
      const newAssignment = await this.createStaffAssignment(
        {
          businessId: parsed.businessId,
          businessMembershipId: current.business_membership_id,
          branchId: finalBranchId,
          departmentId: finalDeptId,
          unitId: finalUnitId,
          positionId: parsed.newPositionId || null,
          jobTitleId: finalJobTitleId,
          assignmentType: 'primary',
          isPrimary: true,
          status: 'active',
          startsAt: transitionTimeStr,
          reportsToAssignmentId: parsed.newReportsToId || null,
          reason: parsed.reason || `Started via ${parsed.transitionType}`,
        },
        actorId
      );

      return {
        success: true,
        endedAssignmentId: current.id,
        newAssignmentId: newAssignment.id,
        transitionType: parsed.transitionType,
        transitionTime: transitionTimeStr,
      };
    }

    return rpcRes;
  }

  // ==========================================
  // 9. Reporting Engine (Direct Reports, Chain, Tree, History)
  // ==========================================

  static async getDirectReports(assignmentId: string, options?: { effectiveOnly?: boolean }) {
    const admin = createAdminClient();
    let query = admin
      .from('staff_assignments')
      .select(`
        *,
        job_title:organization_job_titles(id, name, code, is_management, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        position:organization_positions(id, position_code, name_override, headcount_limit),
        department:organization_departments(id, name, code),
        unit:organization_units(id, name, code),
        branch:branches(id, name, code),
        membership:business_memberships(id, user_id, role, membership_status)
      `)
      .eq('reports_to_assignment_id', assignmentId)
      .order('starts_at', { ascending: true });

    if (options?.effectiveOnly) {
      const nowIso = new Date().toISOString();
      query = query
        .eq('status', 'active')
        .lte('starts_at', nowIso)
        .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
        .is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch direct reports: ${error.message}`);
    return data || [];
  }

  static async getReportingChain(assignmentId: string, maxDepth: number = 50) {
    const chain: Record<string, unknown>[] = [];
    const visited = new Set<string>();
    let currentId: string | null = assignmentId;
    let depth = 0;

    while (currentId && depth < maxDepth) {
      if (visited.has(currentId)) {
        break; // Cycle safe
      }
      visited.add(currentId);

      const assignment = await this.getStaffAssignmentById(currentId);
      if (!assignment) break;

      chain.push(assignment);
      currentId = (assignment.reports_to_assignment_id as string) || null;
      depth++;
    }

    return chain;
  }

  static async getReportingTree(rootAssignmentId?: string, businessId?: string): Promise<ReportingTreeNode[]> {
    const admin = createAdminClient();

    // If rootAssignmentId specified, build tree starting from that node
    if (rootAssignmentId) {
      const root = await this.getStaffAssignmentById(rootAssignmentId);
      if (!root) return [];

      const buildSubtree = async (nodeAssignment: Record<string, unknown>): Promise<ReportingTreeNode> => {
        const directReports = await this.getDirectReports(nodeAssignment.id as string, { effectiveOnly: true });
        const childrenNodes: ReportingTreeNode[] = [];
        for (const child of directReports) {
          childrenNodes.push(await buildSubtree(child));
        }
        return {
          assignment: nodeAssignment,
          directReports: childrenNodes,
        };
      };

      const tree = await buildSubtree(root);
      return [tree];
    }

    // Otherwise, fetch all root active assignments for business where reports_to_assignment_id IS NULL
    if (!businessId) {
      throw new Error('businessId is required when rootAssignmentId is omitted');
    }

    const { data: roots, error } = await admin
      .from('staff_assignments')
      .select(`
        *,
        job_title:organization_job_titles(id, name, code, is_management, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        position:organization_positions(id, position_code, name_override, headcount_limit),
        department:organization_departments(id, name, code),
        unit:organization_units(id, name, code),
        branch:branches(id, name, code),
        membership:business_memberships(id, user_id, role, membership_status)
      `)
      .eq('business_id', businessId)
      .eq('status', 'active')
      .is('reports_to_assignment_id', null)
      .is('archived_at', null)
      .order('starts_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch root assignments: ${error.message}`);

    const buildSubtree = async (nodeAssignment: Record<string, unknown>): Promise<ReportingTreeNode> => {
      const directReports = await this.getDirectReports(nodeAssignment.id as string, { effectiveOnly: true });
      const childrenNodes: ReportingTreeNode[] = [];
      for (const child of directReports) {
        childrenNodes.push(await buildSubtree(child));
      }
      return {
        assignment: nodeAssignment,
        directReports: childrenNodes,
      };
    };

    const treeList: ReportingTreeNode[] = [];
    for (const root of roots || []) {
      treeList.push(await buildSubtree(root));
    }
    return treeList;
  }

  static async setReportingManager(input: SetReportingManagerInput, actorId?: string) {
    const parsed = setReportingManagerSchema.parse(input);
    const admin = createAdminClient();

    // Validate assignment
    const { data: assign, error: assignErr } = await admin
      .from('staff_assignments')
      .select('id, business_id, reports_to_assignment_id, status')
      .eq('id', parsed.assignmentId)
      .eq('business_id', parsed.businessId)
      .maybeSingle();

    if (assignErr || !assign) {
      throw new Error(`Staff assignment ${parsed.assignmentId} not found in business ${parsed.businessId}`);
    }

    const previousManagerId = assign.reports_to_assignment_id;
    const newManagerId = parsed.reportsToAssignmentId || null;

    if (previousManagerId === newManagerId) {
      return { success: true, unchanged: true };
    }

    // Try executing via atomic RPC
    const { data: rpcRes, error: rpcErr } = await admin.rpc('set_staff_reporting_manager_atomic', {
      p_business_id: parsed.businessId,
      p_assignment_id: parsed.assignmentId,
      p_new_reports_to_id: newManagerId,
      p_reason: parsed.reason || null,
      p_actor_id: actorId || null,
    });

    if (!rpcErr && rpcRes) {
      return rpcRes;
    }

    // Fallback: update directly
    const { data, error } = await admin
      .from('staff_assignments')
      .update({
        reports_to_assignment_id: newManagerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.assignmentId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update reporting manager: ${error.message}`);

    // Insert history record
    await admin.from('organization_reporting_history').insert({
      business_id: parsed.businessId,
      assignment_id: parsed.assignmentId,
      previous_manager_assignment_id: previousManagerId,
      new_manager_assignment_id: newManagerId,
      reason: parsed.reason || null,
      changed_by: actorId || null,
      changed_at: new Date().toISOString(),
    });

    return {
      success: true,
      assignmentId: data.id,
      previousManagerAssignmentId: previousManagerId,
      newManagerAssignmentId: newManagerId,
    };
  }

  static async getReportingHistory(assignmentId: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_reporting_history')
      .select(`
        *,
        previous_manager:staff_assignments!previous_manager_assignment_id(
          id,
          job_title:organization_job_titles(id, name, code),
          membership:business_memberships(id, user_id, role)
        ),
        new_manager:staff_assignments!new_manager_assignment_id(
          id,
          job_title:organization_job_titles(id, name, code),
          membership:business_memberships(id, user_id, role)
        )
      `)
      .eq('assignment_id', assignmentId)
      .order('changed_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch reporting history: ${error.message}`);
    return data || [];
  }

  // ==========================================
  // 10. Member Assignment History & Organization Profile
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
    const additionalAssignments = activeAssignments.filter((a) => !a.is_primary);

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

    if (primaryAssignment && primaryAssignment.branch_id) {
      if (!accessibleBranchIds.includes(primaryAssignment.branch_id as string)) {
        organizationBranchAccessMismatch = true;
      }
    }

    return {
      membership: member,
      primaryAssignment,
      additionalAssignments,
      effectiveAssignments,
      reportingManager,
      directReports,
      totalHistoricalAssignments: allAssignments.length,
      organizationBranchAccessMismatch,
      accessibleBranchIds,
    };
  }

  // ==========================================
  // 11. Organization Integrity Diagnostics
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
        reports_to_assignment_id,
        status,
        is_primary,
        starts_at,
        ends_at,
        job_title:organization_job_titles(id, name, hierarchy_level:organization_hierarchy_levels(id, name, rank)),
        position:organization_positions(id, headcount_limit, position_code),
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

    // 3. Check position occupancy
    const { data: positions } = await admin
      .from('organization_positions')
      .select('id, headcount_limit, position_code, name_override')
      .eq('business_id', businessId)
      .eq('status', 'active');

    const posOccupantCount = new Map<string, number>();
    for (const assign of assignments || []) {
      if (assign.position_id) {
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
}
