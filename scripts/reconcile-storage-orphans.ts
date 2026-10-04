import { createAdminClient } from '@/lib/supabase/server';

/**
 * Storage Orphan Reconciliation Script
 * Scans bucket 'bank-transfer-receipts' for unreferenced files created > 24 hours ago
 * and purges them to prevent storage bloat and dangling uploads.
 */
export async function reconcileStorageOrphans(): Promise<{
  scannedCount: number;
  orphanCount: number;
  purgedCount: number;
  errors: string[];
}> {
  const admin = createAdminClient();
  const BUCKET = 'bank-transfer-receipts';
  const errors: string[] = [];

  let scannedCount = 0;
  let orphanCount = 0;
  let purgedCount = 0;

  try {
    // 1. List objects in receipts folder
    const { data: objects, error: listError } = await admin.storage
      .from(BUCKET)
      .list('receipts', { limit: 1000 });

    if (listError) {
      errors.push(`Failed to list storage objects: ${listError.message}`);
      return { scannedCount, orphanCount, purgedCount, errors };
    }

    if (!objects || objects.length === 0) {
      return { scannedCount, orphanCount, purgedCount, errors };
    }

    // Process nested files by recursion or folder scanning
    const candidatePaths: string[] = [];
    for (const item of objects) {
      if (item.id === null) {
        // Folder (business_id)
        const { data: subItems } = await admin.storage
          .from(BUCKET)
          .list(`receipts/${item.name}`, { limit: 1000 });

        if (subItems) {
          for (const subItem of subItems) {
            if (subItem.id === null) {
              // Folder (payment_id)
              const { data: files } = await admin.storage
                .from(BUCKET)
                .list(`receipts/${item.name}/${subItem.name}`, { limit: 1000 });

              if (files) {
                for (const f of files) {
                  if (f.name && f.created_at) {
                    scannedCount++;
                    const ageMs = Date.now() - new Date(f.created_at).getTime();
                    // Older than 24 hours
                    if (ageMs > 24 * 60 * 60 * 1000) {
                      candidatePaths.push(`receipts/${item.name}/${subItem.name}/${f.name}`);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // 2. Query matching proof records in database
    if (candidatePaths.length > 0) {
      const { data: proofs, error: pError } = await admin
        .from('business_subscription_proofs')
        .select('file_path')
        .in('file_path', candidatePaths);

      if (pError) {
        errors.push(`Failed to query proofs: ${pError.message}`);
        return { scannedCount, orphanCount, purgedCount, errors };
      }

      const verifiedPaths = new Set(proofs?.map((p) => p.file_path) || []);
      const orphansToDelete = candidatePaths.filter((path) => !verifiedPaths.has(path));

      orphanCount = orphansToDelete.length;

      if (orphansToDelete.length > 0) {
        const { data: removed, error: removeErr } = await admin.storage
          .from(BUCKET)
          .remove(orphansToDelete);

        if (removeErr) {
          errors.push(`Failed to remove orphans: ${removeErr.message}`);
        } else {
          purgedCount = removed?.length || orphansToDelete.length;
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Unexpected error: ${msg}`);
  }

  return { scannedCount, orphanCount, purgedCount, errors };
}

// Allow direct CLI execution
if (require.main === module) {
  reconcileStorageOrphans()
    .then((result) => {
      console.log('Reconciliation completed:', JSON.stringify(result, null, 2));
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
