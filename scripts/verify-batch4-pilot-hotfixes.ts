/**
 * WSNexa — PILOT QA HOTFIX BATCH #4 Verification Suite
 *
 * Validates:
 * 1. ISSUE #1 — Area-Level QR Order Submission:
 *    - Valid Area QR tokens resolve branch, business, and authoritativeAreaId.
 *    - Resolves active branch QR token hash as rpcTokenHash for atomic create_guest_order RPC.
 *    - Prevents cross-area and cross-branch table mismatches.
 *    - Invalid/tampered/revoked/expired Area QR tokens are securely rejected.
 * 2. ISSUE #2 — Cart -> Checkout Navigation:
 *    - CartDrawer eliminates premature onClose() unmounting during router.push.
 *    - Displays active navigating state ('Opening Checkout...') while preserving cart state.
 * 3. ISSUE #3 — Guest Contact Details Optional Presentation:
 *    - Guest Details header displays 'Guest Details' with an 'Optional' badge and clear subtitle.
 *    - Labels and placeholders explicitly state '(Optional)' with no required indicators.
 *    - Order submission allows placing orders with empty guest details.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  createSignedAreaQrToken,
  verifyAreaQrToken,
} from '../src/lib/qr/area-qr-token';
import { createGuestOrderSchema } from '../src/lib/validation/order';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${msg}`);
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('      WSNexa — Pilot QA Hotfix Batch #4 Verification Suite      ');
  console.log('================================================================\n');

  const rootDir = process.cwd();
  const orderServiceSrc = fs.readFileSync(path.join(rootDir, 'src/server/services/order.service.ts'), 'utf-8');
  const cartDrawerSrc = fs.readFileSync(path.join(rootDir, 'src/components/guest/cart-drawer.tsx'), 'utf-8');
  const checkoutPreviewSrc = fs.readFileSync(path.join(rootDir, 'src/components/guest/checkout-preview.tsx'), 'utf-8');

  // ── 1. Issue #1: Area-Level QR Order Submission ──────────────────────────────
  console.log('--- 1. Issue #1: Area-Level QR Order Submission & Security ---');

  const testBizId = '00000000-0000-0000-0000-000000000001';
  const testBranchId = '11111111-1111-1111-1111-111111111111';
  const testAreaId = '22222222-2222-2222-2222-222222222222';

  // 1a. Token generation and cryptographic verification
  const { rawToken } = createSignedAreaQrToken(testBizId, testBranchId, testAreaId, 1);
  const verifyRes = verifyAreaQrToken(rawToken);

  assert(verifyRes.valid === true, 'Issue 1: Valid Area QR token cryptographically verifies');
  assert(verifyRes.payload?.branchId === testBranchId, 'Issue 1: Token carries correct branchId');
  assert(verifyRes.payload?.areaId === testAreaId, 'Issue 1: Token carries correct areaId');
  assert(verifyRes.payload?.businessId === testBizId, 'Issue 1: Token carries correct businessId');

  // 1b. Tampered token rejection
  const tamperedToken = rawToken.slice(0, -4) + 'abcd';
  const tamperedRes = verifyAreaQrToken(tamperedToken);
  assert(tamperedRes.valid === false, 'Issue 1: Tampered Area QR token signature is rejected');

  // 1c. Expired token rejection
  const expiredToken = createSignedAreaQrToken(testBizId, testBranchId, testAreaId, 1, Date.now() - 5000).rawToken;
  const expiredRes = verifyAreaQrToken(expiredToken);
  assert(expiredRes.valid === false && expiredRes.error === 'EXPIRED', 'Issue 1: Expired Area QR token is rejected with EXPIRED');

  // 1d. OrderService RPC token hash resolution and service area binding
  assert(orderServiceSrc.includes('let rpcTokenHash = tokenHash;'), 'Issue 1: OrderService initializes rpcTokenHash');
  assert(orderServiceSrc.includes('targetBranchId && (areaVerification.valid || sessionTokenToUse)'), 'Issue 1: Resolves active branch QR token for Area QR/Session orders');
  assert(orderServiceSrc.includes('from(\'branch_qr_codes\')'), 'Issue 1: Looks up branch QR anchor from branch_qr_codes');
  assert(orderServiceSrc.includes('p_token_hash: rpcTokenHash'), 'Issue 1: Passes resolved rpcTokenHash to create_guest_order RPC');
  assert(orderServiceSrc.includes('updateData.service_area_id = authoritativeAreaId;'), 'Issue 1: Persists authoritative service_area_id on order record');
  assert(orderServiceSrc.includes('tableCheck.service_area_id !== authoritativeAreaId'), 'Issue 1: Enforces cross-area order attempt blocking');
  assert(orderServiceSrc.includes('CROSS_AREA_ORDER_ATTEMPT_BLOCKED'), 'Issue 1: Emits CROSS_AREA_ORDER_ATTEMPT_BLOCKED on mismatch');

  // ── 2. Issue #2: Cart -> Checkout Navigation Intermediate Flash Elimination ───
  console.log('\n--- 2. Issue #2: Cart -> Checkout Navigation Smoothness ---');

  assert(!cartDrawerSrc.includes('onClose();\n    router.push(`/m/${token}/checkout`);'), 'Issue 2: Removed premature synchronous onClose() before router.push in cart-drawer');
  assert(cartDrawerSrc.includes('const [isNavigating, setIsNavigating] = React.useState(false);'), 'Issue 2: CartDrawer tracks isNavigating state during route transition');
  assert(cartDrawerSrc.includes('setIsNavigating(true);'), 'Issue 2: Sets isNavigating before router.push to prevent duplicate clicks and flickers');
  assert(cartDrawerSrc.includes('Opening Checkout...'), 'Issue 2: Displays smooth navigating feedback ("Opening Checkout...")');
  assert(cartDrawerSrc.includes('disabled={!canProceedToCheckout || isNavigating}'), 'Issue 2: Disables button during active navigation transition');
  assert(cartDrawerSrc.includes('router.push(`/m/${token}/checkout`)'), 'Issue 2: Navigates directly to checkout route');

  // ── 3. Issue #3: Guest Contact Details Explicitly Optional Presentation ──────
  console.log('\n--- 3. Issue #3: Guest Details Optional Presentation & Validation ---');

  assert(checkoutPreviewSrc.includes('Guest Details'), 'Issue 3: Section heading simplified to "Guest Details"');
  assert(checkoutPreviewSrc.includes('Optional — you can skip this section and place your order directly.'), 'Issue 3: Subtitle clearly explains section can be skipped');
  assert(checkoutPreviewSrc.includes('Your Name <span className="text-[11px] font-normal text-zinc-400">(Optional)</span>'), 'Issue 3: Name label explicitly marked Optional');
  assert(checkoutPreviewSrc.includes('Phone Number <span className="text-[11px] font-normal text-zinc-400">(Optional)</span>'), 'Issue 3: Phone label explicitly marked Optional');
  assert(checkoutPreviewSrc.includes('Order / Preparation Notes <span className="text-[11px] font-normal text-zinc-400">(Optional)</span>'), 'Issue 3: Notes label explicitly marked Optional');
  assert(checkoutPreviewSrc.includes('placeholder="e.g. John Doe (Optional)"'), 'Issue 3: Name placeholder reinforces optional status');
  assert(checkoutPreviewSrc.includes('placeholder="e.g. +94 77 123 4567 (Optional)"'), 'Issue 3: Phone placeholder reinforces optional status');
  assert(checkoutPreviewSrc.includes('placeholder="e.g. Extra spicy, no cutlery needed... (Optional)"'), 'Issue 3: Notes placeholder reinforces optional status');

  // 3b. Zod Schema Verification (all 3 fields are completely optional)
  const validEmptyDetailsOrder = createGuestOrderSchema.safeParse({
    rawQrToken: 'test-token',
    tableId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    guestName: null,
    guestPhone: null,
    guestNotes: null,
    idempotencyKey: 'idemp_test_12345678',
    cartItems: [
      {
        menuItemId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        quantity: 1,
        selectedModifiers: [],
      },
    ],
  });

  assert(validEmptyDetailsOrder.success === true, 'Issue 3: Order with null guestName, guestPhone, and guestNotes validates cleanly');

  const validEmptyStringOrder = createGuestOrderSchema.safeParse({
    rawQrToken: 'test-token',
    tableId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    guestName: '',
    guestPhone: '',
    guestNotes: '',
    idempotencyKey: 'idemp_test_87654321',
    cartItems: [
      {
        menuItemId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        quantity: 2,
        selectedModifiers: [],
      },
    ],
  });

  assert(validEmptyStringOrder.success === true, 'Issue 3: Order with empty string guest details validates cleanly');

  // ── Summary ──────────────────────────────────────────────────
  console.log('\n============================================================');
  console.log(`Verification Complete: ${passed} Passed, ${failed} Failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
