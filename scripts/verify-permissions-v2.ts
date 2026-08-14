import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';

// Bypass server-only guard
try {
  /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */
  // @ts-ignore
  require.cache[require.resolve('server-only')] = {
    id: require.resolve('server-only'),
    filename: require.resolve('server-only'),
    loaded: true,
    exports: {},
  };
} catch {}

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = value;
      }
    }
  }
}

async function verifyPermissionsV2() {
  console.log('=== WSNexa Permissions & Access Control V2 Verification Suite ===\n');

  const permModulePath = pathToFileURL(path.join(process.cwd(), 'src/lib/validation/permission.ts')).href;
  const { permissionKeyEnum, ownerOnlyPermissions } = await import(permModulePath);

  const presetsModulePath = pathToFileURL(path.join(process.cwd(), 'src/lib/validation/permission-presets.ts')).href;
  const { ROLE_PRESETS } = await import(presetsModulePath);

  const routeModulePath = pathToFileURL(path.join(process.cwd(), 'src/lib/security/route-permissions.ts')).href;
  const { getRequiredPermissionForRoute } = await import(routeModulePath);

  const serviceModulePath = pathToFileURL(path.join(process.cwd(), 'src/server/services/permission.service.ts')).href;
  const { PermissionService } = await import(serviceModulePath);
  console.log('  Testing PermissionService load:', typeof PermissionService.hasPermission === 'function');

  const supabaseModulePath = pathToFileURL(path.join(process.cwd(), 'src/lib/supabase/server.ts')).href;
  const { createAdminClient } = await import(supabaseModulePath);
  const admin = createAdminClient();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ ${testName}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // 1. Catalog integrity
  console.log('1. Testing Granular Permission Catalog Invariants...');
  const catalogKeys = permissionKeyEnum.options;
  assert(catalogKeys.length >= 60, `Catalog contains ${catalogKeys.length} granular keys (expected >= 60)`);
  assert(catalogKeys.includes('waiter.orders.create'), 'Catalog contains waiter.orders.create');
  assert(catalogKeys.includes('menu.price.update'), 'Catalog contains menu.price.update');
  assert(catalogKeys.includes('menu.availability.update'), 'Catalog contains menu.availability.update');

  // 2. Owner-only boundary
  console.log('\n2. Testing Owner-Only Security Boundaries...');
  assert(ownerOnlyPermissions.includes('business.settings.manage'), 'business.settings.manage is owner-only');
  assert(ownerOnlyPermissions.includes('owner.transfer'), 'owner.transfer is owner-only');
  assert(ownerOnlyPermissions.includes('branches.manage'), 'branches.manage is owner-only');
  assert(ownerOnlyPermissions.includes('roles.manage'), 'roles.manage is owner-only');

  // 3. Built-in Role Presets
  console.log('\n3. Testing Role Preset Mapping...');
  const waiterPreset = ROLE_PRESETS.find((p: { key: string }) => p.key === 'waiter');
  assert(!!waiterPreset, 'Waiter preset exists');
  assert(waiterPreset?.permissions.includes('waiter.orders.create') ?? false, 'Waiter preset has waiter.orders.create');
  assert(!(waiterPreset?.permissions.includes('business.settings.manage') ?? true), 'Waiter preset excludes business.settings.manage');

  const cashierPreset = ROLE_PRESETS.find((p: { key: string }) => p.key === 'cashier');
  assert(cashierPreset?.permissions.includes('cashier.access') ?? false, 'Cashier preset has cashier.access');

  // 4. Route Permission Guard Resolution
  console.log('\n4. Testing Route Permission Resolution...');
  assert(getRequiredPermissionForRoute('/dashboard/waiter/order') === 'waiter.orders.create', '/dashboard/waiter/order requires waiter.orders.create');
  assert(getRequiredPermissionForRoute('/dashboard/menu/categories') === 'menu.categories.manage', '/dashboard/menu/categories requires menu.categories.manage');
  assert(getRequiredPermissionForRoute('/dashboard/business') === 'business.settings.manage', '/dashboard/business requires business.settings.manage');

  // 5. Database Schema Inspection
  console.log('\n5. Inspecting Supabase Public Permissions Table...');
  const { data: dbPerms, error: dbErr } = await admin.from('permissions').select('key, category, risk_level');
  assert(!dbErr, 'Queried public.permissions without errors');
  assert((dbPerms?.length || 0) >= 60, `DB permissions row count: ${dbPerms?.length} (expected >= 60)`);

  const { data: dbRolePerms } = await admin.from('role_permissions').select('role_key, permission_key').eq('role_key', 'waiter');
  const waiterDbKeys = (dbRolePerms || []).map((r: { permission_key: string }) => r.permission_key);
  assert(waiterDbKeys.includes('waiter.orders.create'), 'DB waiter role permissions include waiter.orders.create');

  console.log(`\n==================================================`);
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

verifyPermissionsV2().catch((err) => {
  console.error(err);
  process.exit(1);
});
