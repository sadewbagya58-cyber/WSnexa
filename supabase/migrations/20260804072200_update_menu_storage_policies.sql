-- Migration: Update Menu Item Image Storage Policies for Tenant Scoping
-- Version: 20260804072200

-- Update storage RLS policies for tenant-scoped menu item paths:
-- path format: menu-items/{business_id}/{branch_id}/{menu_item_id}/{generated_file_name}

DROP POLICY IF EXISTS "Authenticated Upload to Menu Item Images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete from Menu Item Images" ON storage.objects;

CREATE POLICY "Authenticated Tenant Upload to Menu Item Images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'business-assets' 
    AND (storage.foldername(name))[1] = 'menu-items'
    AND public.auth_has_branch_access(((storage.foldername(name))[3])::uuid)
  );

CREATE POLICY "Authenticated Tenant Delete from Menu Item Images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'business-assets' 
    AND (storage.foldername(name))[1] = 'menu-items'
    AND public.auth_has_branch_access(((storage.foldername(name))[3])::uuid)
  );
