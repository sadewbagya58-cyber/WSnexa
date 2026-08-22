import { createAdminClient } from '@/lib/supabase/server';

export interface UploadVenueImageParams {
  userId?: string;
  businessId: string;
  imageType: 'logo' | 'cover';
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

export interface UploadVenueImageResult {
  success: boolean;
  message?: string;
  publicUrl?: string;
  storagePath?: string;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MAX_SIZE_BYTES = {
  logo: 5 * 1024 * 1024, // 5 MB
  cover: 8 * 1024 * 1024, // 8 MB
};

export class VenueMediaService {
  /**
   * Upload logo or cover photo to Supabase Storage with strict tenant and permission validation.
   */
  static async uploadImage({
    businessId,
    imageType,
    fileBuffer,
    mimeType,
    fileSizeBytes,
  }: UploadVenueImageParams): Promise<UploadVenueImageResult> {
    try {
      // 1. MIME type validation
      if (!ALLOWED_MIME_TYPES.includes(mimeType.toLowerCase())) {
        return {
          success: false,
          message: 'Invalid file format. Only JPG, PNG, and WEBP images are allowed.',
        };
      }

      // 2. File size validation
      const maxAllowed = MAX_SIZE_BYTES[imageType];
      if (fileSizeBytes > maxAllowed) {
        const maxMb = maxAllowed / (1024 * 1024);
        return {
          success: false,
          message: `File size exceeds the ${maxMb} MB maximum limit.`,
        };
      }

      // 3. Server-side permission validation
      const { can, resolveAuthorizationContext } = await import('@/server/auth');
      let authContext;
      try {
        authContext = await resolveAuthorizationContext();
      } catch {
        return {
          success: false,
          message: 'Unauthorized session.',
        };
      }

      if (!authContext || authContext.businessId !== businessId) {
        return {
          success: false,
          message: 'Tenant mismatch or unauthorized business context.',
        };
      }

      const hasPerm = await can({
        context: authContext,
        permission: 'venue_profile.manage',
      });

      if (!hasPerm) {
        return {
          success: false,
          message: 'You do not have permission to upload photos for this venue.',
        };
      }

      const admin = createAdminClient();

      // Ensure storage bucket exists
      const { data: bucket } = await admin.storage.getBucket('venue-media');
      if (!bucket) {
        await admin.storage.createBucket('venue-media', {
          public: true,
          fileSizeLimit: 8388608,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
        });
      }

      // 4. Fetch existing profile to get current image URL for safe replacement
      const { data: existingProfile } = await admin
        .from('venue_public_profiles')
        .select('id, logo_url, cover_image_url')
        .eq('business_id', businessId)
        .maybeSingle();

      const oldUrl = imageType === 'logo' ? existingProfile?.logo_url : existingProfile?.cover_image_url;

      // 5. Generate secure server-side storage path
      const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1] || 'webp';
      const fileUuid = crypto.randomUUID();
      const storagePath = `businesses/${businessId}/venue-profile/${imageType}/${fileUuid}.${ext}`;

      // 6. Upload file to Supabase Storage
      const { error: uploadErr } = await admin.storage
        .from('venue-media')
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadErr) {
        return {
          success: false,
          message: 'Failed to upload photo to storage. Please try again.',
        };
      }

      // 7. Get public URL
      const { data: publicUrlData } = admin.storage.from('venue-media').getPublicUrl(storagePath);
      const publicUrl = publicUrlData.publicUrl;

      // 8. Update database safely
      const updateField = imageType === 'logo' ? { logo_url: publicUrl } : { cover_image_url: publicUrl };

      if (existingProfile) {
        await admin
          .from('venue_public_profiles')
          .update({ ...updateField, updated_at: new Date().toISOString() })
          .eq('business_id', businessId);
      }

      // 9. Remove obsolete old image AFTER successful upload & DB update
      if (oldUrl && oldUrl.includes('/venue-media/')) {
        await this.deleteStorageObjectByUrl(admin, oldUrl);
      }

      return {
        success: true,
        message: `${imageType === 'logo' ? 'Venue logo' : 'Cover photo'} uploaded successfully.`,
        publicUrl,
        storagePath,
      };
    } catch {
      return {
        success: false,
        message: 'An unexpected error occurred while processing photo upload.',
      };
    }
  }

  /**
   * Remove logo or cover photo reference and delete storage object.
   */
  static async removeImage(
    userId: string,
    businessId: string,
    imageType: 'logo' | 'cover'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { can, resolveAuthorizationContext } = await import('@/server/auth');
      let authContext;
      try {
        authContext = await resolveAuthorizationContext();
      } catch {
        return {
          success: false,
          message: 'Unauthorized session.',
        };
      }

      if (!authContext || authContext.businessId !== businessId) {
        return {
          success: false,
          message: 'Tenant mismatch or unauthorized business context.',
        };
      }

      const hasPerm = await can({
        context: authContext,
        permission: 'venue_profile.manage',
      });

      if (!hasPerm) {
        return {
          success: false,
          message: 'You do not have permission to remove photos for this venue.',
        };
      }

      const admin = createAdminClient();

      const { data: existingProfile } = await admin
        .from('venue_public_profiles')
        .select('id, logo_url, cover_image_url')
        .eq('business_id', businessId)
        .maybeSingle();

      if (!existingProfile) {
        return { success: true, message: 'Photo removed successfully.' };
      }

      const oldUrl = imageType === 'logo' ? existingProfile.logo_url : existingProfile.cover_image_url;

      // Clear profile DB reference
      const updateField = imageType === 'logo' ? { logo_url: null } : { cover_image_url: null };
      await admin
        .from('venue_public_profiles')
        .update({ ...updateField, updated_at: new Date().toISOString() })
        .eq('business_id', businessId);

      // Safely delete storage object
      if (oldUrl && oldUrl.includes('/venue-media/')) {
        await this.deleteStorageObjectByUrl(admin, oldUrl);
      }

      return {
        success: true,
        message: `${imageType === 'logo' ? 'Venue logo' : 'Cover photo'} removed successfully.`,
      };
    } catch {
      return {
        success: false,
        message: 'An unexpected error occurred while removing photo.',
      };
    }
  }

  /**
   * Helper to delete storage object from public URL safely.
   */
  private static async deleteStorageObjectByUrl(admin: ReturnType<typeof createAdminClient>, url: string) {
    try {
      const parts = url.split('/venue-media/');
      if (parts.length < 2) return;
      const rawPath = parts[1];
      // Strip query parameters if present
      const cleanPath = rawPath.split('?')[0];
      await admin.storage.from('venue-media').remove([cleanPath]);
    } catch {
      // Ignore storage cleanup failures
    }
  }
}
