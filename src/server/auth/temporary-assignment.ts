import 'server-only';
import type { AuthorizationContext, EffectiveStaffAssignment } from '@/types/authorization.types';

export interface TemporaryAssignmentInput {
  status: string;
  startsAt?: string | null;
  starts_at?: string | null;
  endsAt?: string | null;
  ends_at?: string | null;
}

export interface TemporaryAuthorityTrace {
  assignmentId: string;
  assignmentType: 'acting' | 'secondment' | 'temporary';
  effective: boolean;
  source: 'acting_assignment' | 'secondment' | 'temporary';
  actingForAssignmentId?: string | null;
  sourceAssignmentId?: string | null;
  target: {
    branchId: string | null;
    departmentId: string | null;
    organizationUnitId: string | null;
    positionId: string | null;
  };
  startsAt: string;
  endsAt: string | null;
  reason?: string | null;
}

/**
 * Authoritative temporal validity evaluation for temporary staff assignments.
 *
 * An acting assignment, secondment, or temporary assignment is effective ONLY when:
 * 1. status is 'active' (not 'ended', 'cancelled', or 'scheduled')
 * 2. starts_at <= referenceTime (inclusive boundary at start)
 * 3. ends_at is null OR referenceTime <= ends_at (inclusive boundary at end)
 *
 * @param assignment The staff assignment record (domain object or DB row)
 * @param referenceTime The authoritative server/database time (defaults to new Date())
 */
export function isTemporaryAssignmentEffective(
  assignment: TemporaryAssignmentInput,
  referenceTime: Date = new Date()
): boolean {
  if (!assignment || assignment.status !== 'active') {
    return false;
  }

  const startsAtRaw = assignment.startsAt ?? assignment.starts_at;
  const endsAtRaw = assignment.endsAt ?? assignment.ends_at;

  const nowTime = referenceTime.getTime();

  // 1. Starts at check
  if (startsAtRaw) {
    const startTime = new Date(startsAtRaw).getTime();
    if (isNaN(startTime) || startTime > nowTime) {
      return false;
    }
  }

  // 2. Ends at check
  if (endsAtRaw) {
    const endTime = new Date(endsAtRaw).getTime();
    if (isNaN(endTime) || endTime < nowTime) {
      return false;
    }
  }

  return true;
}

/**
 * Generates an explainable server-side provenance trace for all temporary assignments
 * in the given authorization context.
 */
export function explainTemporaryAuthority(
  context: AuthorizationContext,
  referenceTime: Date = new Date()
): TemporaryAuthorityTrace[] {
  const traces: TemporaryAuthorityTrace[] = [];

  const candidateAssignments: EffectiveStaffAssignment[] = [
    ...(context.actingAssignments || []),
    ...(context.secondments || []),
    ...(context.staffAssignments || []).filter((a) => a.assignmentType === 'temporary'),
  ];

  // De-duplicate by assignment id
  const seenIds = new Set<string>();

  for (const a of candidateAssignments) {
    if (seenIds.has(a.id)) continue;
    seenIds.add(a.id);

    const isEffective = isTemporaryAssignmentEffective(a, referenceTime);
    const source: 'acting_assignment' | 'secondment' | 'temporary' =
      a.assignmentType === 'acting'
        ? 'acting_assignment'
        : a.assignmentType === 'secondment'
        ? 'secondment'
        : 'temporary';

    traces.push({
      assignmentId: a.id,
      assignmentType: a.assignmentType as 'acting' | 'secondment' | 'temporary',
      effective: isEffective,
      source,
      actingForAssignmentId: a.actingForAssignmentId || null,
      sourceAssignmentId: a.sourceAssignmentId || null,
      target: {
        branchId: a.branchId,
        departmentId: a.departmentId,
        organizationUnitId: a.organizationUnitId,
        positionId: a.positionId,
      },
      startsAt: a.startsAt,
      endsAt: a.endsAt,
    });
  }

  return traces;
}
