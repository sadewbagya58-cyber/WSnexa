'use server';

import { createClient } from '@/lib/supabase/server';
import { AdminCreateVenueInput, SuperAdminVenueService } from '../services/super-admin-venue.service';
import { revalidatePath } from 'next/cache';

export async function listAdminVenuesAction(searchQuery?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Unauthorized.', data: [] };

  const isSuperAdmin = await SuperAdminVenueService.verifySuperAdminAuthority(user.id);
  if (!isSuperAdmin) {
    return { success: false, message: 'Forbidden: Super Admin authority required.', data: [] };
  }

  const data = await SuperAdminVenueService.listAllVenues(searchQuery);
  return { success: true, message: 'Venues retrieved successfully.', data };
}

export async function createAdminVenueAction(input: AdminCreateVenueInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Unauthorized.' };

  const result = await SuperAdminVenueService.createVenueAsAdmin(input, user.id);

  if (result.success) {
    revalidatePath('/admin/venues');
    revalidatePath('/explore');
    if (result.slug) revalidatePath(`/venues/${result.slug}`);
  }

  return result;
}

export async function toggleAdminPublishAction(venueProfileId: string, isPublished: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: 'Unauthorized.' };

  const result = await SuperAdminVenueService.togglePublishAsAdmin(venueProfileId, isPublished, user.id);

  if (result.success) {
    revalidatePath('/admin/venues');
    revalidatePath('/explore');
  }

  return result;
}
