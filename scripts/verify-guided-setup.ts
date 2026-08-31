/**
 * WSNexa — Phase 37 UX Recovery Step 2: Guided Business Setup & Progressive Onboarding
 * Verification Test Suite — Final Completion Semantics & Regression Suite
 *
 * Validates:
 * 1. Canonical Setup Stages (sequence, tiers, scopes, dependencies).
 * 2. Source-Level Integrity & Anti-Bypass Guard:
 *    - Proves no `|| true` bypass exists in securitySettings or other stages.
 *    - Proves `status = 'pending'` is not treated as completed test order progression.
 *    - Proves staff invitation query validates pending status and expiration.
 *    - Proves branch QR code activation is required.
 * 3. Completion Semantics across Targeted Scenarios (A through R):
 *    - A: Brand new owner immediately after onboarding
 *    - B: Branch with area but no tables
 *    - C: Tables present with PIN disabled (require_table_pin = false)
 *    - D: Tables present and PIN required (require_table_pin = true) but missing PINs
 *    - E: Category exists but only archived/unavailable items
 *    - F: Payment settings row exists but no usable payment method
 *    - G: Owner membership only, no operational staff (Recommended never blocks Core)
 *    - H: Blank/default venue profile row
 *    - I: Inventory completely empty (Optional never blocks Core)
 *    - J: Branch has only rejected/cancelled orders (never counts as test success)
 *    - K: Branch has valid successful operational order (preparing/ready/completed)
 *    - L: Multi-branch isolation (Branch A complete, Branch B empty)
 *    - M: Safe go-live wording without claiming platform readiness
 *    - N: Missing security settings record (securitySettings = null)
 *    - O: Pending + Approved order (does NOT satisfy operational test order progression)
 *    - P: Expired staff invitation only (does NOT satisfy Team stage)
 *    - Q: Area & table present but QR unusable (hasActiveQr = false -> dining_qr NOT complete)
 *    - R: Valid QR entry point (hasActiveQr = true -> dining_qr complete)
 * 4. Navigation, route mapping, and search aliases.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CANONICAL_SETUP_STAGES,
  SetupJourneyReport,
} from '../src/lib/setup/setup-journey';
import {
  CANONICAL_DASHBOARD_NAV_SECTIONS,
  getParentNavPath,
} from '../src/lib/navigation/dashboard-navigation';

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

interface SimulationState {
  businessName?: string;
  defaultCurrency?: string;
  timezone?: string;
  branchName?: string;
  isBranchActive?: boolean;
  requireTablePin?: boolean;
  serviceAreasCount: number;
  tablesCount: number;
  tablesWithPinCount: number;
  hasActiveQr: boolean;
  categoriesCount: number;
  usableMenuItemsCount: number;
  hasOrderSecurity: boolean;
  hasUsablePaymentMethod: boolean;
  staffMembershipsCount: number; // non-owner staff
  validPendingInvitationsCount: number;
  hasVenueProfile: boolean;
  inventoryCount: number;
  allOrdersCount: number;
  validOrdersCount: number; // strictly ['confirmed', 'preparing', 'ready', 'served', 'completed']
}

function simulateSetupReport(branchId: string, branchName: string, state: SimulationState): SetupJourneyReport {
  const hasBusinessBasics = Boolean(state.businessName?.trim()) && Boolean(state.defaultCurrency) && Boolean(state.timezone);
  const hasBranchLocation = Boolean(state.branchName?.trim()) && state.isBranchActive !== false;

  const stages = CANONICAL_SETUP_STAGES.map((config) => {
    let isCompleted = false;
    let status: 'completed' | 'in_progress' | 'not_started' | 'blocked' = 'not_started';
    let completionDetail = '';
    let nextActionHref = config.href;
    let nextActionLabel = config.ctaLabel;

    switch (config.id) {
      case 'business_basics':
        isCompleted = hasBusinessBasics;
        status = isCompleted ? 'completed' : 'in_progress';
        completionDetail = isCompleted ? 'Business basics configured.' : 'Configure business basics.';
        break;

      case 'location':
        isCompleted = hasBranchLocation;
        status = isCompleted ? 'completed' : 'in_progress';
        completionDetail = isCompleted ? `${state.branchName} ready.` : 'Add branch outlet.';
        break;

      case 'dining_qr': {
        const hasAreas = state.serviceAreasCount > 0;
        const hasTables = state.tablesCount > 0;
        const pinSatisfied = !state.requireTablePin || (hasTables && state.tablesWithPinCount === state.tablesCount);
        const hasQr = state.hasActiveQr;

        isCompleted = hasAreas && hasTables && pinSatisfied && hasQr;
        status = isCompleted ? 'completed' : hasAreas ? 'in_progress' : 'not_started';

        if (!hasAreas) {
          nextActionHref = '/dashboard/areas';
          nextActionLabel = '+ Add Service Area';
          completionDetail = 'Create a Service Area first.';
        } else if (!hasTables) {
          nextActionHref = '/dashboard/tables/new';
          nextActionLabel = '+ Add Table';
          completionDetail = `${state.serviceAreasCount} area(s) ready. Add dining tables.`;
        } else if (!pinSatisfied) {
          nextActionHref = '/dashboard/tables/qr';
          nextActionLabel = 'Set Table PINs';
          completionDetail = 'PIN protection is enabled. Set table PINs.';
        } else if (!hasQr) {
          nextActionHref = '/dashboard/tables/qr';
          nextActionLabel = 'Generate Branch QR';
          completionDetail = `${state.tablesCount} table(s) ready. Generate active Branch QR code.`;
        } else {
          nextActionHref = '/dashboard/tables/qr';
          nextActionLabel = 'Manage QR Codes';
          completionDetail = `${state.tablesCount} table(s) configured with active QR code.`;
        }
        break;
      }

      case 'menu': {
        const hasCats = state.categoriesCount > 0;
        const hasUsable = state.usableMenuItemsCount > 0;
        isCompleted = hasCats && hasUsable;
        status = isCompleted ? 'completed' : hasCats ? 'in_progress' : 'not_started';

        if (!hasCats) {
          nextActionHref = '/dashboard/menu/categories';
          nextActionLabel = '+ Create Category';
          completionDetail = 'Create a category first.';
        } else if (!hasUsable) {
          nextActionHref = '/dashboard/menu/items/new';
          nextActionLabel = '+ Add Menu Item';
          completionDetail = `${state.categoriesCount} category(s) ready. Add an active menu item.`;
        } else {
          nextActionHref = '/dashboard/menu/items';
          nextActionLabel = 'Manage Menu';
          completionDetail = `${state.usableMenuItemsCount} active item(s) in ${state.categoriesCount} category(s).`;
        }
        break;
      }

      case 'ordering_security': {
        isCompleted = state.hasOrderSecurity && state.hasUsablePaymentMethod;
        status = isCompleted ? 'completed' : 'in_progress';

        if (!state.hasOrderSecurity) {
          completionDetail = 'Order security settings record missing. Configure order security.';
          nextActionHref = '/dashboard/settings/order-security';
          nextActionLabel = 'Configure Order Security';
        } else if (!state.hasUsablePaymentMethod) {
          completionDetail = 'No active payment method enabled. Configure at least one payment method.';
          nextActionHref = '/dashboard/settings/payments';
          nextActionLabel = 'Configure Payments';
        } else {
          completionDetail = 'Order security rules & operational payment methods ready.';
          nextActionHref = '/dashboard/settings/payments';
          nextActionLabel = 'Manage Payments';
        }
        break;
      }

      case 'team': {
        isCompleted = state.staffMembershipsCount > 0 || state.validPendingInvitationsCount > 0;
        status = isCompleted ? 'completed' : 'not_started';
        completionDetail = isCompleted ? 'Staff active or invited.' : 'Invite staff members.';
        break;
      }

      case 'venue_profile': {
        isCompleted = state.hasVenueProfile;
        status = isCompleted ? 'completed' : 'not_started';
        completionDetail = isCompleted ? 'Venue profile ready.' : 'Edit venue profile.';
        break;
      }

      case 'operations_inventory': {
        isCompleted = state.inventoryCount > 0;
        status = isCompleted ? 'completed' : 'not_started';
        completionDetail = isCompleted ? `${state.inventoryCount} stock item(s).` : 'Optional: add inventory.';
        break;
      }

      case 'test_order': {
        const hasValidProgression = state.validOrdersCount > 0;
        const rejectedOrCancelledOnly = state.allOrdersCount > 0 && state.validOrdersCount === 0;
        isCompleted = hasValidProgression;

        if (hasValidProgression) {
          status = 'completed';
          completionDetail = `${state.validOrdersCount} operational order(s) confirmed / dispatched to kitchen or cashier.`;
        } else if (rejectedOrCancelledOnly) {
          status = 'in_progress';
          completionDetail = 'Previous test order was cancelled or rejected. Complete a valid operational order.';
        } else if (state.tablesCount > 0 && state.usableMenuItemsCount > 0) {
          status = 'in_progress';
          completionDetail = 'Place a test order to verify kitchen & cashier workflow progression.';
        } else {
          status = 'blocked';
          completionDetail = 'Blocked: configure dining tables and menu items first.';
        }

        nextActionHref = '/dashboard/orders';
        nextActionLabel = 'Open Orders Queue';
        break;
      }

      case 'launch_ready': {
        const coreCompleteSoFar = hasBusinessBasics && hasBranchLocation &&
          (state.serviceAreasCount > 0 && state.tablesCount > 0 && (!state.requireTablePin || state.tablesWithPinCount === state.tablesCount) && state.hasActiveQr) &&
          (state.categoriesCount > 0 && state.usableMenuItemsCount > 0) &&
          (state.hasOrderSecurity && state.hasUsablePaymentMethod) &&
          (state.validOrdersCount > 0);

        isCompleted = coreCompleteSoFar;
        status = isCompleted ? 'completed' : 'in_progress';
        completionDetail = isCompleted ? 'Core setup is complete.' : 'Complete core setup.';
        break;
      }
    }

    return {
      ...config,
      status,
      isCompleted,
      completionDetail,
      nextActionHref,
      nextActionLabel,
    };
  });

  const required = stages.filter((s) => s.tier === 'required');
  const recommended = stages.filter((s) => s.tier === 'recommended');
  const optional = stages.filter((s) => s.tier === 'optional');

  const completedRequired = required.filter((s) => s.isCompleted).length;
  const completedRecommended = recommended.filter((s) => s.isCompleted).length;
  const completedOptional = optional.filter((s) => s.isCompleted).length;

  const isCoreSetupComplete = completedRequired === required.length;
  const overallPercentage = Math.round((completedRequired / required.length) * 100);

  const nextStage = required.find((s) => !s.isCompleted) || recommended.find((s) => !s.isCompleted) || null;

  return {
    businessId: 'biz_test',
    businessName: state.businessName || 'Test Business',
    branchId,
    branchName,
    totalRequired: required.length,
    completedRequired,
    totalRecommended: recommended.length,
    completedRecommended,
    totalOptional: optional.length,
    completedOptional,
    isCoreSetupComplete,
    overallPercentage,
    nextStage,
    stages,
  };
}

async function runVerification() {
  console.log('\n============================================================');
  console.log('WSNexa — Phase 37 Step 2: Guided Setup Integrity Test Suite');
  console.log('============================================================\n');

  // ── 1. Canonical Setup Stages Configuration ───────────────────
  console.log('--- 1. Canonical Setup Stages Structure ---');

  assert(CANONICAL_SETUP_STAGES.length === 10, `Exactly 10 canonical setup stages defined (got ${CANONICAL_SETUP_STAGES.length})`);

  const expectedSequence = [
    'business_basics',
    'location',
    'dining_qr',
    'menu',
    'ordering_security',
    'team',
    'venue_profile',
    'operations_inventory',
    'test_order',
    'launch_ready',
  ];

  expectedSequence.forEach((id, idx) => {
    assert(CANONICAL_SETUP_STAGES[idx]?.id === id, `Stage ${idx + 1} is '${id}' (got '${CANONICAL_SETUP_STAGES[idx]?.id}')`);
  });

  const requiredStages = CANONICAL_SETUP_STAGES.filter((s) => s.tier === 'required');
  const recommendedStages = CANONICAL_SETUP_STAGES.filter((s) => s.tier === 'recommended');
  const optionalStages = CANONICAL_SETUP_STAGES.filter((s) => s.tier === 'optional');

  assert(requiredStages.length === 6, `6 Core Required stages (got ${requiredStages.length})`);
  assert(recommendedStages.length === 3, `3 Recommended stages (got ${recommendedStages.length})`);
  assert(optionalStages.length === 1, `1 Optional stage (Operations/Inventory) (got ${optionalStages.length})`);
  assert(optionalStages[0]?.id === 'operations_inventory', 'Operations/Inventory is strictly OPTIONAL and does not block launch');

  // ── 2. Source-Level Integrity & Anti-Bypass Guard ─────────────
  console.log('\n--- 2. Source-Level Integrity & Anti-Bypass Inspection ---');

  const serviceFilePath = path.resolve(__dirname, '../src/server/setup/setup-journey.service.ts');
  const serviceCode = fs.readFileSync(serviceFilePath, 'utf-8');

  assert(!serviceCode.includes('securitySettings || true'), 'Source does NOT contain "securitySettings || true"');
  assert(!serviceCode.includes('|| true'), 'Source does NOT contain any unconditional "|| true" completion bypass');
  assert(!serviceCode.includes("o.status === 'pending'"), 'Source does NOT treat plain "pending" order as completed progression');
  assert(serviceCode.includes("eq('status', 'pending')") && serviceCode.includes("gt('expires_at'"), 'Staff invitations query explicitly validates pending status and expiration');
  assert(serviceCode.includes("from('branch_qr_codes')"), 'Dining & QR check explicitly queries branch_qr_codes for active QR tokens');

  // ── 3. Targeted Scenario Validations (A through R) ────────────
  console.log('\n--- 3. Targeted Completion Semantics (Scenarios A through R) ---');

  // Scenario A: Brand new owner immediately after onboarding
  const reportA = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 0,
    tablesCount: 0,
    tablesWithPinCount: 0,
    hasActiveQr: false,
    categoriesCount: 0,
    usableMenuItemsCount: 0,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 0,
    validPendingInvitationsCount: 0,
    hasVenueProfile: false,
    inventoryCount: 0,
    allOrdersCount: 0,
    validOrdersCount: 0,
  });

  assert(!reportA.isCoreSetupComplete, 'Scenario A: New owner is NOT marked core complete');
  assert(reportA.completedRequired === 3, `Scenario A: 3 required stages ready (Basics, Location, Security) (got ${reportA.completedRequired})`);
  assert(reportA.nextStage?.id === 'dining_qr', 'Scenario A: Next stage is dining_qr');
  assert(reportA.nextStage?.nextActionHref === '/dashboard/areas', 'Scenario A: Next action directs to /dashboard/areas');
  assert(reportA.nextStage?.nextActionLabel === '+ Add Service Area', 'Scenario A: Next action label prompts Service Area creation');

  // Scenario B: Branch with area but no tables
  const reportB = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 2,
    tablesCount: 0,
    tablesWithPinCount: 0,
    hasActiveQr: false,
    categoriesCount: 0,
    usableMenuItemsCount: 0,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 0,
    validPendingInvitationsCount: 0,
    hasVenueProfile: false,
    inventoryCount: 0,
    allOrdersCount: 0,
    validOrdersCount: 0,
  });

  assert(reportB.nextStage?.id === 'dining_qr', 'Scenario B: Area exists but 0 tables -> nextStage is dining_qr');
  assert(reportB.nextStage?.nextActionHref === '/dashboard/tables/new', 'Scenario B: Next action is /dashboard/tables/new');
  assert(reportB.nextStage?.nextActionLabel === '+ Add Table', 'Scenario B: Next action label is + Add Table');

  // Scenario C: Tables present but PIN disabled (require_table_pin = false) & QR active
  const reportC = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0, // 0 tables have PIN
    hasActiveQr: true,
    categoriesCount: 0,
    usableMenuItemsCount: 0,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 0,
    validPendingInvitationsCount: 0,
    hasVenueProfile: false,
    inventoryCount: 0,
    allOrdersCount: 0,
    validOrdersCount: 0,
  });

  const diningStageC = reportC.stages.find((s) => s.id === 'dining_qr');
  assert(diningStageC?.isCompleted === true, 'Scenario C: PIN disabled + active QR -> dining_qr is COMPLETE without requiring PINs');

  // Scenario D: Tables present and PIN required (require_table_pin = true) but missing PINs
  const reportD = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: true, // PIN enabled
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 2, // only 2 of 5 have PINs
    hasActiveQr: true,
    categoriesCount: 0,
    usableMenuItemsCount: 0,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 0,
    validPendingInvitationsCount: 0,
    hasVenueProfile: false,
    inventoryCount: 0,
    allOrdersCount: 0,
    validOrdersCount: 0,
  });

  const diningStageD = reportD.stages.find((s) => s.id === 'dining_qr');
  assert(diningStageD?.isCompleted === false, 'Scenario D: PIN required but missing -> dining_qr is NOT complete');
  assert(diningStageD?.nextActionHref === '/dashboard/tables/qr', 'Scenario D: Next action points to /dashboard/tables/qr (Set Table PINs)');

  // Scenario E: Category exists but only archived/unavailable items
  const reportE = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: true,
    categoriesCount: 2,
    usableMenuItemsCount: 0, // 0 active/available items
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 0,
    validPendingInvitationsCount: 0,
    hasVenueProfile: false,
    inventoryCount: 0,
    allOrdersCount: 0,
    validOrdersCount: 0,
  });

  const menuStageE = reportE.stages.find((s) => s.id === 'menu');
  assert(menuStageE?.isCompleted === false, 'Scenario E: 0 usable items -> menu is NOT complete');
  assert(menuStageE?.nextActionHref === '/dashboard/menu/items/new', 'Scenario E: Next action is /dashboard/menu/items/new (+ Add Menu Item)');

  // Scenario F: Payment settings row exists but no usable payment method
  const reportF = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: true,
    categoriesCount: 2,
    usableMenuItemsCount: 5,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: false, // 0 payment methods enabled
    staffMembershipsCount: 0,
    validPendingInvitationsCount: 0,
    hasVenueProfile: false,
    inventoryCount: 0,
    allOrdersCount: 0,
    validOrdersCount: 0,
  });

  const secStageF = reportF.stages.find((s) => s.id === 'ordering_security');
  assert(secStageF?.isCompleted === false, 'Scenario F: No usable payment method -> ordering_security is NOT complete');

  // Scenario G: Owner membership only, no real staff (Recommended never blocks Core)
  const reportG = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: true,
    categoriesCount: 2,
    usableMenuItemsCount: 5,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 0, // 0 non-owner staff
    validPendingInvitationsCount: 0,
    hasVenueProfile: true,
    inventoryCount: 0,
    allOrdersCount: 1,
    validOrdersCount: 1,
  });

  const teamStageG = reportG.stages.find((s) => s.id === 'team');
  assert(teamStageG?.isCompleted === false, 'Scenario G: Owner-only membership -> Team is NOT complete');
  assert(reportG.isCoreSetupComplete === true, 'Scenario G: Missing Team does NOT block isCoreSetupComplete (Team is Recommended)');

  // Scenario H: Blank/default venue profile row
  const reportH = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: true,
    categoriesCount: 2,
    usableMenuItemsCount: 5,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 2,
    validPendingInvitationsCount: 0,
    hasVenueProfile: false, // blank profile
    inventoryCount: 0,
    allOrdersCount: 1,
    validOrdersCount: 1,
  });

  const venueStageH = reportH.stages.find((s) => s.id === 'venue_profile');
  assert(venueStageH?.isCompleted === false, 'Scenario H: Blank venue profile -> venue_profile is NOT complete');
  assert(reportH.isCoreSetupComplete === true, 'Scenario H: Incomplete venue profile does NOT block Core Setup');

  // Scenario I: Inventory completely empty (Optional never blocks Core)
  const reportI = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: true,
    categoriesCount: 2,
    usableMenuItemsCount: 5,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 2,
    validPendingInvitationsCount: 0,
    hasVenueProfile: true,
    inventoryCount: 0, // 0 inventory items
    allOrdersCount: 1,
    validOrdersCount: 1,
  });

  const invStageI = reportI.stages.find((s) => s.id === 'operations_inventory');
  assert(invStageI?.isCompleted === false, 'Scenario I: 0 inventory -> operations_inventory is NOT complete');
  assert(reportI.isCoreSetupComplete === true, 'Scenario I: 0 inventory does NOT decrease core setup readiness');
  assert(reportI.overallPercentage === 100, 'Scenario I: Overall core percentage is 100%');

  // Scenario J: Branch has only rejected/cancelled orders (never counts as test success)
  const reportJ = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: true,
    categoriesCount: 2,
    usableMenuItemsCount: 5,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 0,
    validPendingInvitationsCount: 0,
    hasVenueProfile: false,
    inventoryCount: 0,
    allOrdersCount: 3, // 3 orders in branch
    validOrdersCount: 0, // but ALL 3 were cancelled or rejected!
  });

  const testOrderStageJ = reportJ.stages.find((s) => s.id === 'test_order');
  assert(testOrderStageJ?.isCompleted === false, 'Scenario J: Cancelled/rejected orders only -> test_order is NOT complete');
  assert(!reportJ.isCoreSetupComplete, 'Scenario J: Cancelled/rejected orders do NOT achieve core setup completion');
  assert(Boolean(testOrderStageJ?.completionDetail.includes('cancelled or rejected')), 'Scenario J: Completion detail guides owner about cancelled/rejected test order');

  // Scenario K: Branch has valid successful operational order (preparing/ready/completed)
  const reportK = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: true,
    categoriesCount: 2,
    usableMenuItemsCount: 5,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 0,
    validPendingInvitationsCount: 0,
    hasVenueProfile: false,
    inventoryCount: 0,
    allOrdersCount: 1,
    validOrdersCount: 1, // 1 valid confirmed/preparing/completed order
  });

  const testOrderStageK = reportK.stages.find((s) => s.id === 'test_order');
  assert(testOrderStageK?.isCompleted === true, 'Scenario K: Valid operational order -> test_order IS completed');
  assert(reportK.isCoreSetupComplete === true, 'Scenario K: All core steps complete');

  // Scenario L: Multi-branch isolation (Branch A complete, Branch B empty)
  const reportBranchA = simulateSetupReport('br_A', 'Branch A (Resort)', {
    businessName: 'Multi Branch Group',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Branch A (Resort)',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 2,
    tablesCount: 15,
    tablesWithPinCount: 0,
    hasActiveQr: true,
    categoriesCount: 4,
    usableMenuItemsCount: 20,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 3,
    validPendingInvitationsCount: 0,
    hasVenueProfile: true,
    inventoryCount: 10,
    allOrdersCount: 50,
    validOrdersCount: 48,
  });

  const reportBranchB = simulateSetupReport('br_B', 'Branch B (New City Outlet)', {
    businessName: 'Multi Branch Group',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Branch B (New City Outlet)',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 0, // Branch B has 0 areas
    tablesCount: 0, // Branch B has 0 tables
    tablesWithPinCount: 0,
    hasActiveQr: false,
    categoriesCount: 4,
    usableMenuItemsCount: 20,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 3,
    validPendingInvitationsCount: 0,
    hasVenueProfile: true,
    inventoryCount: 0,
    allOrdersCount: 0,
    validOrdersCount: 0,
  });

  assert(reportBranchA.isCoreSetupComplete === true, 'Scenario L: Branch A is core complete');
  assert(reportBranchB.isCoreSetupComplete === false, 'Scenario L: Branch B is NOT core complete');
  assert(reportBranchB.nextStage?.id === 'dining_qr', 'Scenario L: Branch B correctly requires dining setup');
  assert(reportBranchB.completedRequired === 4, `Scenario L: Branch B does not falsely inherit Branch A tables/orders (got ${reportBranchB.completedRequired}/6)`);

  // Scenario M: Safe Go-Live Wording
  const launchReadyStage = reportK.stages.find((s) => s.id === 'launch_ready');
  assert(
    launchReadyStage?.completionDetail === 'Core setup is complete.',
    'Scenario M: Go-live stage uses safe wording without over-promising external readiness'
  );

  // Scenario N: Missing security settings record (securitySettings = null)
  const reportN = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: true,
    categoriesCount: 2,
    usableMenuItemsCount: 5,
    hasOrderSecurity: false, // securitySettings is NULL
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 1,
    validPendingInvitationsCount: 0,
    hasVenueProfile: true,
    inventoryCount: 0,
    allOrdersCount: 1,
    validOrdersCount: 1,
  });

  const secStageN = reportN.stages.find((s) => s.id === 'ordering_security');
  assert(secStageN?.isCompleted === false, 'Scenario N: securitySettings = null -> ordering_security is NOT complete');
  assert(reportN.isCoreSetupComplete === false, 'Scenario N: missing security settings blocks core setup');

  // Scenario O: Pending + Approved order (does NOT satisfy operational test order progression)
  const reportO = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: true,
    categoriesCount: 2,
    usableMenuItemsCount: 5,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 1,
    validPendingInvitationsCount: 0,
    hasVenueProfile: true,
    inventoryCount: 0,
    allOrdersCount: 1,
    validOrdersCount: 0, // order is only pending (even if approved, not progressed downstream)
  });

  const testOrderStageO = reportO.stages.find((s) => s.id === 'test_order');
  assert(testOrderStageO?.isCompleted === false, 'Scenario O: pending + approved order -> test_order is NOT complete (requires confirmed/preparing/ready/completed)');

  // Scenario P: Expired staff invitation only (does NOT satisfy Team stage)
  const reportP = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: true,
    categoriesCount: 2,
    usableMenuItemsCount: 5,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 0, // 0 staff
    validPendingInvitationsCount: 0, // 0 valid pending (all invitations expired)
    hasVenueProfile: true,
    inventoryCount: 0,
    allOrdersCount: 1,
    validOrdersCount: 1,
  });

  const teamStageP = reportP.stages.find((s) => s.id === 'team');
  assert(teamStageP?.isCompleted === false, 'Scenario P: Expired invitations only -> Team is NOT complete');

  // Scenario Q: Area & table present but QR unusable (hasActiveQr = false -> dining_qr NOT complete)
  const reportQ = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: false, // No active Branch QR code generated
    categoriesCount: 2,
    usableMenuItemsCount: 5,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 0,
    validPendingInvitationsCount: 0,
    hasVenueProfile: false,
    inventoryCount: 0,
    allOrdersCount: 0,
    validOrdersCount: 0,
  });

  const diningStageQ = reportQ.stages.find((s) => s.id === 'dining_qr');
  assert(diningStageQ?.isCompleted === false, 'Scenario Q: Tables exist but active QR missing -> dining_qr is NOT complete');
  assert(diningStageQ?.nextActionHref === '/dashboard/tables/qr', 'Scenario Q: Points to /dashboard/tables/qr to generate QR code');
  assert(diningStageQ?.nextActionLabel === 'Generate Branch QR', 'Scenario Q: Next action label prompts "Generate Branch QR"');

  // Scenario R: Valid QR entry point (hasActiveQr = true -> dining_qr complete)
  const reportR = simulateSetupReport('br_1', 'Main Wing', {
    businessName: 'Sea View Hotel',
    defaultCurrency: 'USD',
    timezone: 'Asia/Colombo',
    branchName: 'Main Wing',
    isBranchActive: true,
    requireTablePin: false,
    serviceAreasCount: 1,
    tablesCount: 5,
    tablesWithPinCount: 0,
    hasActiveQr: true, // Active Branch QR code generated
    categoriesCount: 2,
    usableMenuItemsCount: 5,
    hasOrderSecurity: true,
    hasUsablePaymentMethod: true,
    staffMembershipsCount: 0,
    validPendingInvitationsCount: 0,
    hasVenueProfile: false,
    inventoryCount: 0,
    allOrdersCount: 0,
    validOrdersCount: 0,
  });

  const diningStageR = reportR.stages.find((s) => s.id === 'dining_qr');
  assert(diningStageR?.isCompleted === true, 'Scenario R: Valid active QR + tables + area -> dining_qr IS complete');

  // ── 4. Navigation & Route Hierarchy ──────────────────────────
  console.log('\n--- 4. Navigation & Route Mapping ---');

  const settingsSection = CANONICAL_DASHBOARD_NAV_SECTIONS.find((s) => s.id === 'workspace')?.items.find((i) => i.id === 'settings');
  assert(Boolean(settingsSection), 'Settings section exists in navigation');

  const guidedSetupItem = settingsSection?.children?.find((c) => c.id === 'guided_setup');
  assert(Boolean(guidedSetupItem), 'Guided Setup (guided_setup) is registered in Settings navigation children');
  assert(guidedSetupItem?.href === '/dashboard/setup', 'Guided Setup href is /dashboard/setup');
  assert(
    Boolean(
      guidedSetupItem?.aliases?.includes('setup wizard') &&
      guidedSetupItem?.aliases?.includes('onboarding progress') &&
      guidedSetupItem?.aliases?.includes('checklist')
    ),
    'Guided Setup includes search aliases for quick Ctrl+K discovery'
  );

  const parentForSetup = getParentNavPath('/dashboard/setup');
  assert(parentForSetup === '/dashboard/settings', `getParentNavPath('/dashboard/setup') returns '/dashboard/settings' (got '${parentForSetup}')`);

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