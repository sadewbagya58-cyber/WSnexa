/**
 * WSNexa — Mobile Settings UI QA Verification Suite
 *
 * Validates:
 * 1. ISSUE #1 — Order Security Engine Overflow & Clipping:
 *    - All containers use w-full min-w-0 break-words to prevent horizontal overflow.
 *    - Subtitle and descriptions wrap cleanly without fixed-width desktop overflow.
 *    - Toggle rows use flex items-start sm:items-center min-w-0 flex-1 to prevent badge clipping.
 * 2. ISSUE #2 — Security Presets Mobile UX:
 *    - Preserves all 4 presets: Low Security, Balanced, High Security, Custom.
 *    - Uses compact 2x2 responsive grid on mobile (grid-cols-2 lg:grid-cols-4).
 *    - Reduces excessive vertical padding (p-2.5 sm:p-3.5) while maintaining min-h-[44px] touch targets.
 *    - Selected state uses high-contrast ring-1 ring-zinc-950 and dark styling.
 * 3. ISSUE #3 — Branch Payment Methods Mobile UX:
 *    - Payment method cards use w-full min-w-0 with responsive padding (p-3.5 sm:p-5).
 *    - Text containers have min-w-0 flex-1 break-words and break-all for method keys.
 *    - Inputs use w-full min-w-0.
 *    - Save button wraps to w-full on mobile with minimum 44px touch target.
 */

import * as fs from 'fs';
import * as path from 'path';

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
  console.log('       WSNexa — QA Mobile UI Verification Suite (Settings)      ');
  console.log('================================================================\n');

  const rootDir = process.cwd();
  const orderSecurityPageSrc = fs.readFileSync(path.join(rootDir, 'src/app/dashboard/settings/order-security/page.tsx'), 'utf-8');
  const orderSecurityComponentSrc = fs.readFileSync(path.join(rootDir, 'src/components/settings/order-security-settings.tsx'), 'utf-8');
  const paymentsPageSrc = fs.readFileSync(path.join(rootDir, 'src/app/dashboard/settings/payments/page.tsx'), 'utf-8');
  const paymentsComponentSrc = fs.readFileSync(path.join(rootDir, 'src/components/settings/branch-payment-settings.tsx'), 'utf-8');

  // ── 1. Issue #1: Order Security Engine Overflow & Clipping ────────────────────
  console.log('--- 1. Issue #1: Order Security Engine Overflow Prevention ---');

  assert(orderSecurityPageSrc.includes('w-full min-w-0'), 'Issue 1: OrderSecurityPage root container includes w-full min-w-0');
  assert(orderSecurityComponentSrc.includes('w-full max-w-4xl mx-auto space-y-5 sm:space-y-6 min-w-0'), 'Issue 1: OrderSecuritySettings root container has min-w-0');
  assert(orderSecurityComponentSrc.includes('break-words'), 'Issue 1: Subtitles and descriptions use break-words to prevent text overflow');
  assert(orderSecurityComponentSrc.includes('min-w-0 flex-1'), 'Issue 1: Granular control rows use min-w-0 flex-1 for text areas');
  assert(orderSecurityComponentSrc.includes('items-start sm:items-center'), 'Issue 1: Granular control rows align items-start on mobile to prevent status badge clipping');
  assert(orderSecurityComponentSrc.includes('w-full sm:w-auto') && orderSecurityComponentSrc.includes('Save Security Settings'), 'Issue 1: Submit button adapts to full-width on mobile');

  // ── 2. Issue #2: Security Presets Mobile UX ──────────────────────────────────
  console.log('\n--- 2. Issue #2: Security Presets Mobile Presentation ---');

  assert(orderSecurityComponentSrc.includes('grid-cols-2 lg:grid-cols-4'), 'Issue 2: Presets use compact 2x2 grid on mobile (grid-cols-2 lg:grid-cols-4)');
  assert(orderSecurityComponentSrc.includes('handleApplyPreset(\'low\')'), 'Issue 2: Low Security preset preserved');
  assert(orderSecurityComponentSrc.includes('handleApplyPreset(\'balanced\')'), 'Issue 2: Balanced Security preset preserved');
  assert(orderSecurityComponentSrc.includes('handleApplyPreset(\'high\')'), 'Issue 2: High Security preset preserved');
  assert(orderSecurityComponentSrc.includes('setActivePreset(\'custom\')'), 'Issue 2: Custom Security preset preserved');
  assert(orderSecurityComponentSrc.includes('p-2.5 sm:p-3.5'), 'Issue 2: Presets use compact padding (p-2.5 sm:p-3.5) on mobile');
  assert(orderSecurityComponentSrc.includes('min-h-[44px] touch-manipulation'), 'Issue 2: Presets maintain minimum 44px touch targets with touch-manipulation');
  assert(orderSecurityComponentSrc.includes('ring-1 ring-zinc-950'), 'Issue 2: Selected preset state clearly emphasized with ring styling');

  // ── 3. Issue #3: Branch Payment Methods Mobile UX ─────────────────────────────
  console.log('\n--- 3. Issue #3: Branch Payment Methods Mobile UX ---');

  assert(paymentsPageSrc.includes('w-full min-w-0'), 'Issue 3: BranchPaymentsPage root container includes w-full min-w-0');
  assert(paymentsComponentSrc.includes('w-full max-w-4xl mx-auto space-y-5 sm:space-y-6 min-w-0'), 'Issue 3: BranchPaymentSettings root container has min-w-0');
  assert(paymentsComponentSrc.includes('p-3.5 sm:p-5'), 'Issue 3: Payment method cards use compact mobile padding (p-3.5 sm:p-5)');
  assert(paymentsComponentSrc.includes('min-w-0 flex-1'), 'Issue 3: Payment method titles use min-w-0 flex-1');
  assert(paymentsComponentSrc.includes('break-all'), 'Issue 3: Method key includes break-all to prevent monospaced overflow');
  assert(paymentsComponentSrc.includes('w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950 min-h-[44px]'), 'Issue 3: Form inputs use full-width styling on mobile');
  assert(paymentsComponentSrc.includes('w-full sm:w-auto') && paymentsComponentSrc.includes('Save Method Labels'), 'Issue 3: Save button spans full-width on mobile');
  assert(paymentsComponentSrc.includes('h-9 w-9 sm:h-10 sm:w-10'), 'Issue 3: Payment icon scales gracefully on mobile');

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
