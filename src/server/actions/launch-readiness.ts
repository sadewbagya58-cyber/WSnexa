'use server';

import { createClient } from '@/lib/supabase/server';
import { SuperAdminVenueService } from '@/server/services/super-admin-venue.service';
import { LaunchReadinessService, PlatformHealthReport } from '@/server/services/launch-readiness.service';
import { PilotOnboardingService, InitializePilotInput, PilotOnboardingResult } from '@/server/services/pilot-onboarding.service';

/**
 * Server action to run platform launch readiness diagnostics.
 * Strictly protected by Super Admin authority.
 */
export async function runLaunchDiagnosticsAction(): Promise<{
  success: boolean;
  report?: PlatformHealthReport;
  message?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Authentication required.' };
    }

    const isSuperAdmin = await SuperAdminVenueService.verifySuperAdminAuthority(user.id);
    if (!isSuperAdmin) {
      return { success: false, message: 'Forbidden: Super Admin authority required.' };
    }

    const report = await LaunchReadinessService.getHealthReport();
    return { success: true, report };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: `Diagnostics failed: ${msg}` };
  }
}

/**
 * Server action to initialize a pilot venue template.
 * Strictly protected by Super Admin authority.
 */
export async function createPilotVenueAction(input: InitializePilotInput): Promise<PilotOnboardingResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, message: 'Authentication required.' };
    }

    const isSuperAdmin = await SuperAdminVenueService.verifySuperAdminAuthority(user.id);
    if (!isSuperAdmin) {
      return { success: false, message: 'Forbidden: Super Admin authority required.' };
    }

    return await PilotOnboardingService.initializePilot(input, user.id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, message: `Pilot creation action error: ${msg}` };
  }
}
