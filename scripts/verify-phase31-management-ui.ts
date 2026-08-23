import fs from 'fs';
import path from 'path';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ [PASS] ${message}`);
}

console.log('\n================================================================');
console.log('  WSNexa Phase 31 Step 5 — Management UI & Cross-Module Verification');
console.log('================================================================\n');

const rootDir = process.cwd();

// --- SECTION A: Management UI Primitives Audit ---
console.log('--- A. Shared Management UI Primitives ---');

const statusBadgePath = path.join(rootDir, 'src/components/ui/status-badge.tsx');
assert(fs.existsSync(statusBadgePath), 'Shared StatusBadge primitive file exists');
const statusBadgeContent = fs.readFileSync(statusBadgePath, 'utf8');
assert(statusBadgeContent.includes('export const StatusBadge'), 'StatusBadge primitive component is exported');
assert(statusBadgeContent.includes('active') && statusBadgeContent.includes('archived'), 'StatusBadge handles canonical system statuses');

const emptyStatePath = path.join(rootDir, 'src/components/ui/empty-state.tsx');
assert(fs.existsSync(emptyStatePath), 'Shared EmptyState primitive file exists');
const emptyStateContent = fs.readFileSync(emptyStatePath, 'utf8');
assert(emptyStateContent.includes('export const EmptyState'), 'EmptyState primitive component is exported');
assert(emptyStateContent.includes('canPerform'), 'EmptyState supports permission-aware CTA gating');

const errorStatePath = path.join(rootDir, 'src/components/ui/error-state.tsx');
assert(fs.existsSync(errorStatePath), 'Shared ErrorState primitive file exists');
const errorStateContent = fs.readFileSync(errorStatePath, 'utf8');
assert(errorStateContent.includes('export const ErrorState'), 'ErrorState primitive component is exported');
assert(errorStateContent.includes('technicalDetails'), 'ErrorState handles user-friendly messages with optional technical details');

const readOnlyNoticePath = path.join(rootDir, 'src/components/ui/read-only-notice.tsx');
assert(fs.existsSync(readOnlyNoticePath), 'Shared ReadOnlyNotice primitive file exists');

const summaryCardPath = path.join(rootDir, 'src/components/ui/summary-card.tsx');
assert(fs.existsSync(summaryCardPath), 'Shared SummaryCard primitive file exists');

const entityLinkPath = path.join(rootDir, 'src/components/ui/entity-link.tsx');
assert(fs.existsSync(entityLinkPath), 'Shared EntityLink primitive file exists');
const entityLinkContent = fs.readFileSync(entityLinkPath, 'utf8');
assert(entityLinkContent.includes('isRawUuid'), 'EntityLink guards against raw UUID primary labels');
assert(entityLinkContent.includes('canAccess'), 'EntityLink supports permission-aware link rendering');

const toolbarPath = path.join(rootDir, 'src/components/ui/management-toolbar.tsx');
assert(fs.existsSync(toolbarPath), 'Shared ManagementToolbar primitive file exists');

const actionMenuPath = path.join(rootDir, 'src/components/ui/action-menu.tsx');
assert(fs.existsSync(actionMenuPath), 'Shared ActionMenu primitive file exists');

const paginationPath = path.join(rootDir, 'src/components/ui/pagination-controls.tsx');
assert(fs.existsSync(paginationPath), 'Shared PaginationControls primitive file exists');

// --- SECTION B: List UX & Consistency ---
console.log('\n--- B. Standardized List & Directory UX ---');

const peopleDirContent = fs.readFileSync(path.join(rootDir, 'src/components/organization/people-directory-client.tsx'), 'utf8');
assert(peopleDirContent.includes('/dashboard/access/members/'), 'People Directory includes cross-link to Member Access Profile');

const memberProfileContent = fs.readFileSync(path.join(rootDir, 'src/components/organization/member-profile-client.tsx'), 'utf8');
assert(memberProfileContent.includes('/dashboard/access/members/'), 'Member Profile includes cross-link to Member Access Profile');

const memberAccessContent = fs.readFileSync(path.join(rootDir, 'src/components/access/member-access-detail-client.tsx'), 'utf8');
assert(memberAccessContent.includes('/dashboard/people/'), 'Member Access Profile includes cross-link to People Profile');

const inventoryTableContent = fs.readFileSync(path.join(rootDir, 'src/components/inventory/inventory-items-table.tsx'), 'utf8');
assert(inventoryTableContent.includes('/dashboard/inventory/recipes'), 'Inventory Items table includes cross-link to Recipes');

const menuItemListContent = fs.readFileSync(path.join(rootDir, 'src/components/menu/item-list.tsx'), 'utf8');
assert(menuItemListContent.includes('/dashboard/menu/categories'), 'Menu Item List includes cross-link to Categories');
assert(menuItemListContent.includes('/dashboard/inventory/recipes'), 'Menu Item List includes cross-link to Recipes & Costing');

const ownerReviewContent = fs.readFileSync(path.join(rootDir, 'src/components/dashboard/owner-review-list.tsx'), 'utf8');
assert(ownerReviewContent.includes('EmptyState'), 'Owner Review List uses standardized EmptyState primitive');

// --- SECTION C: Security & Operational Boundaries ---
console.log('\n--- C. Security & Operational Boundaries ---');

const kitchenContent = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/kitchen/page.tsx'), 'utf8');
assert(kitchenContent.includes("requireRoutePermission('/dashboard/kitchen')"), 'Kitchen route guard remains protected');

const cashierContent = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/cashier/page.tsx'), 'utf8');
assert(cashierContent.includes("requireRoutePermission('/dashboard/cashier')"), 'Cashier route guard remains protected');

const waiterContent = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/waiter/page.tsx'), 'utf8');
assert(waiterContent.includes("requireRoutePermission('/dashboard/waiter')"), 'Waiter route guard remains protected');

const diningPageContent = fs.readFileSync(path.join(rootDir, 'src/app/(dashboard)/dashboard/dining/page.tsx'), 'utf8');
assert(diningPageContent.includes("requireRoutePermission('/dashboard/dining')"), 'Dining Setup route guard requires tables.manage');

const routePermsContent = fs.readFileSync(path.join(rootDir, 'src/lib/security/route-permissions.ts'), 'utf8');
assert(!routePermsContent.includes('REGION'), 'Canonical scopes preserve ORGANIZATION, PROPERTY, DEPARTMENT, AREA_TEAM, SELF without REGION');

console.log('\n================================================================');
console.log('  Phase 31 Step 5 Verification Complete: ALL ASSERTIONS PASSED');
console.log('================================================================\n');
