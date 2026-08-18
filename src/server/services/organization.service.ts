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
  UpdateStaffAssignmentInput,
  EndStaffAssignmentInput,
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
  updateStaffAssignmentSchema,
  endStaffAssignmentSchema,
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
      return { valid: false, error: `Business membership ${membershipId} does not belong to business ${businessId}` };
    }

    // Check job title
    const { data: jt } = await admin
      .from('organization_job_titles')
      .select('id, business_id')
      .eq('id', jobTitleId)
      .maybeSingle();

    if (!jt || jt.business_id !== businessId) {
      return { valid: false, error: `Job title ${jobTitleId} does not belong to business ${businessId}` };
    }

    // Check branch
    if (branchId) {
      const validBranch = await this.validateBranchBelongsToBusiness(branchId, businessId);
      if (!validBranch) return { valid: false, error: `Branch ${branchId} does not belong to business ${businessId}` };
    }

    // Check department
    if (departmentId) {
      const validDept = await this.validateDepartmentBelongsToBusiness(departmentId, businessId);
      if (!validDept) return { valid: false, error: `Department ${departmentId} does not belong to business ${businessId}` };
    }

    // Check unit
    if (unitId) {
      const { data: u } = await admin
        .from('organization_units')
        .select('id, business_id, department_id')
        .eq('id', unitId)
        .maybeSingle();

      if (!u || u.business_id !== businessId) {
        return { valid: false, error: `Unit ${unitId} does not belong to business ${businessId}` };
      }
      if (departmentId && u.department_id !== departmentId) {
        return { valid: false, error: `Unit ${unitId} does not belong to department ${departmentId}` };
      }
    }

    // Check position
    if (positionId) {
      const validPos = await this.validatePositionHierarchy(positionId, businessId);
      if (!validPos) return { valid: false, error: `Position ${positionId} does not belong to business ${businessId}` };
    }

    return { valid: true };
  }

  // ==========================================
  // 2. Organization Hierarchy Levels
  // ==========================================

  static async ensureDefaultHierarchyLevels(businessId: string): Promise<void> {
    const admin = createAdminClient();
    const rows = DEFAULT_ORGANIZATION_HIERARCHY_LEVELS.map((lvl) => ({
      business_id: businessId,
      rank: lvl.rank,
      name: lvl.name,
      is_management: lvl.isManagement,
      is_active: true,
    }));

    await admin
      .from('organization_hierarchy_levels')
      .upsert(rows, { onConflict: 'business_id,rank', ignoreDuplicates: true });
  }

  static async getHierarchyLevels(businessId: string, options?: { activeOnly?: boolean }) {
    const admin = createAdminClient();
    let query = admin
      .from('organization_hierarchy_levels')
      .select('*')
      .eq('business_id', businessId)
      .order('rank', { ascending: true });

    if (options?.activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch hierarchy levels: ${error.message}`);
    return data || [];
  }

  static async getHierarchyLevelById(id: string) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organization_hierarchy_levels')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch hierarchy level: ${error.message}`);
    return data;
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

  // ==========================================
  // 3. Departments
  // ==========================================

  static async getDepartments(businessId: string, options?: { branchId?: string | null; activeOnly?: boolean }) {
    const admin = createAdminClient();
    let query = admin
      .from('organization_departments')
      .select('*, branch:branches(id, name, code)')
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
      .select('*, branch:branches(id, name, code), parent:organization_departments(id, name, code)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch department: ${error.message}`);
    return data;
  }

  static async createDepartment(input: CreateDepartmentInput) {
    const parsed = createDepartmentSchema.parse(input);
    const admin = createAdminClient();

    // Verify branch tenant if provided
    if (parsed.branchId) {
      const validBranch = await this.validateBranchBelongsToBusiness(parsed.branchId, parsed.businessId);
      if (!validBranch) throw new Error(`Branch ${parsed.branchId} does not belong to business ${parsed.businessId}`);
    }

    // Verify parent department tenant if provided
    if (parsed.parentDepartmentId) {
      const validParent = await this.validateDepartmentBelongsToBusiness(parsed.parentDepartmentId, parsed.businessId);
      if (!validParent) throw new Error(`Parent department ${parsed.parentDepartmentId} does not belong to business ${parsed.businessId}`);
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
    if (parsed.name !== undefined) updatePayload.name = parsed.name;
    if (parsed.code !== undefined) updatePayload.code = parsed.code;
    if (parsed.departmentType !== undefined) updatePayload.department_type = parsed.departmentType;
    if (parsed.branchId !== undefined) updatePayload.branch_id = parsed.branchId;
    if (parsed.parentDepartmentId !== undefined) updatePayload.parent_department_id = parsed.parentDepartmentId;
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

  static async getUnits(businessId: string, options?: { departmentId?: string; branchId?: string | null; activeOnly?: boolean }) {
    const admin = createAdminClient();
    let query = admin
      .from('organization_units')
      .select('*, department:organization_departments(id, name, code), branch:branches(id, name, code)')
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
      .select('*, department:organization_departments(id, name, code), branch:branches(id, name, code), parent:organization_units(id, name, code)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch unit: ${error.message}`);
    return data;
  }

  static async createUnit(input: CreateOrganizationUnitInput) {
    const parsed = createOrganizationUnitSchema.parse(input);
    const admin = createAdminClient();

    // Validate department
    const validDept = await this.validateDepartmentBelongsToBusiness(parsed.departmentId, parsed.businessId);
    if (!validDept) throw new Error(`Department ${parsed.departmentId} does not belong to business ${parsed.businessId}`);

    // Validate branch if provided
    if (parsed.branchId) {
      const validBranch = await this.validateBranchBelongsToBusiness(parsed.branchId, parsed.businessId);
      if (!validBranch) throw new Error(`Branch ${parsed.branchId} does not belong to business ${parsed.businessId}`);
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

  static async updateUnit(input: UpdateOrganizationUnitInput) {
    const parsed = updateOrganizationUnitSchema.parse(input);
    const admin = createAdminClient();

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (parsed.name !== undefined) updatePayload.name = parsed.name;
    if (parsed.code !== undefined) updatePayload.code = parsed.code;
    if (parsed.unitType !== undefined) updatePayload.unit_type = parsed.unitType;
    if (parsed.branchId !== undefined) updatePayload.branch_id = parsed.branchId;
    if (parsed.departmentId !== undefined) updatePayload.department_id = parsed.departmentId;
    if (parsed.parentUnitId !== undefined) updatePayload.parent_unit_id = parsed.parentUnitId;
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

    if (error) throw new Error(`Failed to archive organization unit: ${error.message}`);
    return data;
  }

  // ==========================================
  // 5. Job Titles
  // ==========================================

  static async getJobTitles(businessId: string, options?: { hierarchyLevelId?: string; activeOnly?: boolean }) {
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

    // Verify hierarchy level belongs to business
    const { data: hl } = await admin
      .from('organization_hierarchy_levels')
      .select('id, business_id')
      .eq('id', parsed.hierarchyLevelId)
      .maybeSingle();

    if (!hl || hl.business_id !== parsed.businessId) {
      throw new Error(`Hierarchy level ${parsed.hierarchyLevelId} does not belong to business ${parsed.businessId}`);
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
  // 6. Positions
  // ==========================================

  static async getPositions(businessId: string, options?: { branchId?: string | null; departmentId?: string; status?: string; activeOnly?: boolean }) {
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

  static async createPosition(input: CreatePositionInput) {
    const parsed = createPositionSchema.parse(input);
    const admin = createAdminClient();

    // Validate job title
    const validJt = await this.validateJobTitleBelongsToBusiness(parsed.jobTitleId, parsed.businessId);
    if (!validJt) throw new Error(`Job title ${parsed.jobTitleId} does not belong to business ${parsed.businessId}`);

    // Validate branch
    if (parsed.branchId) {
      const validBranch = await this.validateBranchBelongsToBusiness(parsed.branchId, parsed.businessId);
      if (!validBranch) throw new Error(`Branch ${parsed.branchId} does not belong to business ${parsed.businessId}`);
    }

    // Validate department
    if (parsed.departmentId) {
      const validDept = await this.validateDepartmentBelongsToBusiness(parsed.departmentId, parsed.businessId);
      if (!validDept) throw new Error(`Department ${parsed.departmentId} does not belong to business ${parsed.businessId}`);
    }

    // Validate unit
    if (parsed.unitId) {
      if (!parsed.departmentId) {
        const { data: u } = await admin.from('organization_units').select('department_id').eq('id', parsed.unitId).maybeSingle();
        if (u) parsed.departmentId = u.department_id;
      }
      const validUnit = await this.validateUnitBelongsToDepartment(parsed.unitId, parsed.departmentId!, parsed.businessId);
      if (!validUnit) throw new Error(`Unit ${parsed.unitId} is invalid for department ${parsed.departmentId}`);
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
  // 7. Staff Assignments
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
        membership:business_memberships(id, user_id, role, membership_status)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch staff assignment: ${error.message}`);
    return data;
  }

  static async createStaffAssignment(input: CreateStaffAssignmentInput) {
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

    // If marked as primary and active, ensure no other active primary assignment exists for this membership
    if (parsed.isPrimary && parsed.status === 'active') {
      const { data: existingPrimary } = await admin
        .from('staff_assignments')
        .select('id')
        .eq('business_membership_id', parsed.businessMembershipId)
        .eq('is_primary', true)
        .eq('status', 'active')
        .maybeSingle();

      if (existingPrimary) {
        throw new Error(
          'Business membership already has an active primary assignment. End or transfer the existing primary assignment before creating a new one.'
        );
      }
    }

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
        starts_at: typeof parsed.startsAt === 'string' ? parsed.startsAt : parsed.startsAt.toISOString(),
        ends_at: parsed.endsAt ? (typeof parsed.endsAt === 'string' ? parsed.endsAt : parsed.endsAt.toISOString()) : null,
        acting_for_assignment_id: parsed.actingForAssignmentId || null,
        reports_to_assignment_id: parsed.reportsToAssignmentId || null,
        reason: parsed.reason || null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create staff assignment: ${error.message}`);
    return data;
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
}
