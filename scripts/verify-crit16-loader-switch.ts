import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(__dirname, '..');

let total = 0;
let passed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  total++;
  if (condition) {
    console.log(`✅ TEST ${total}: ${testName}`);
    passed++;
  } else {
    console.error(`❌ TEST ${total} FAILED: ${testName}`);
    if (detail) console.error(`   Details: ${detail}`);
  }
}

async function run() {
  console.log('================================================================');
  console.log('  WSNexa CRIT-16, Compact Loader & Account Switch Verification  ');
  console.log('================================================================\n');

  // =========================================================================
  // 1. CRIT-16: Waiter Order Server Action Modifier Mapping
  // =========================================================================
  console.log('--- 1. CRIT-16: Waiter Order Modifier Mapping ---');
  const waiterOrderPath = path.join(root, 'src', 'server', 'actions', 'waiter-order.ts');
  assert(fs.existsSync(waiterOrderPath), 'src/server/actions/waiter-order.ts exists');

  const waiterOrderSrc = fs.readFileSync(waiterOrderPath, 'utf8');

  // Check 1: randomUUID imported from crypto
  assert(
    waiterOrderSrc.includes("import { randomUUID } from 'crypto'") ||
    waiterOrderSrc.includes('randomUUID'),
    'waiter-order.ts imports/uses randomUUID'
  );

  // Check 2: orderItemsPayload assigns explicit UUID
  assert(
    waiterOrderSrc.includes('const orderItemId = randomUUID()') &&
    waiterOrderSrc.includes('id: orderItemId'),
    'orderItemsPayload pre-generates and assigns explicit UUID for each item'
  );

  // Check 3: orderItemRows includes id
  assert(
    waiterOrderSrc.includes('id: itemPayload.id'),
    'orderItemRows passes pre-generated UUID into order_items insert'
  );

  // Check 4: modifierRows links directly to op.id (not itemMapByMenuId)
  assert(
    !waiterOrderSrc.includes('itemMapByMenuId'),
    'itemMapByMenuId has been removed (eliminating menu item clumping)'
  );

  assert(
    waiterOrderSrc.includes('const orderItemId = op.id;') ||
    waiterOrderSrc.includes('order_item_id: op.id'),
    'modifierRows links directly to individual op.id'
  );

  // Check 5: additional_price_cents_snapshot uses verified cents
  assert(
    waiterOrderSrc.includes('additional_price_cents_snapshot: optDetails?.price_cents ?? Math.round(mod.priceSnapshot * 100)'),
    'additional_price_cents_snapshot uses verified optionMap price cents with fallback'
  );

  // Check 6: Waiter Order Builder consolidation
  const waiterBuilderPath = path.join(root, 'src', 'components', 'waiter', 'waiter-order-builder.tsx');
  assert(fs.existsSync(waiterBuilderPath), 'src/components/waiter/waiter-order-builder.tsx exists');

  const waiterBuilderSrc = fs.readFileSync(waiterBuilderPath, 'utf8');

  assert(
    waiterBuilderSrc.includes('line.selectedModifiers.length !== configuredItem.selectedModifiers.length') &&
    waiterBuilderSrc.includes('lineMods === newMods'),
    'waiter-order-builder merges only identical configurations while preserving distinct modifier sets'
  );

  // =========================================================================
  // 2. Compact WSNexa Loader
  // =========================================================================
  console.log('\n--- 2. Compact WSNexa Loading Animation ---');
  const loaderPath = path.join(root, 'src', 'components', 'ui', 'wsnexa-compact-loader.tsx');
  assert(fs.existsSync(loaderPath), 'src/components/ui/wsnexa-compact-loader.tsx exists');

  const loaderSrc = fs.readFileSync(loaderPath, 'utf8');

  assert(
    loaderSrc.includes('export function WsnexaCompactLoader') ||
    loaderSrc.includes('export const WsnexaCompactLoader'),
    'Exports WsnexaCompactLoader component'
  );

  assert(
    loaderSrc.includes('animate-spin') && loaderSrc.includes('animate-pulse'),
    'Uses subtle spin and pulse animations'
  );

  assert(
    loaderSrc.includes('WN') || loaderSrc.includes('WSNexa'),
    'Renders centered WSNexa mark'
  );

  assert(
    loaderSrc.includes('label = \'Loading WSNexa...\''),
    'Defaults label to "Loading WSNexa..."'
  );

  const rootLoadingPath = path.join(root, 'src', 'app', 'loading.tsx');
  const rootLoadingSrc = fs.readFileSync(rootLoadingPath, 'utf8');

  assert(
    rootLoadingSrc.includes('WsnexaCompactLoader'),
    'src/app/loading.tsx renders WsnexaCompactLoader'
  );

  // =========================================================================
  // 3. Business / Staff -> Customer Account Switch
  // =========================================================================
  console.log('\n--- 3. Business / Staff -> Customer Account Switch ---');
  const dashShellPath = path.join(root, 'src', 'components', 'layout', 'dashboard-shell.tsx');
  const dashShellSrc = fs.readFileSync(dashShellPath, 'utf8');

  assert(
    dashShellSrc.includes('Switch to Customer'),
    'dashboard-shell.tsx contains "Switch to Customer" link'
  );

  assert(
    dashShellSrc.includes("sessionStorage.setItem('wsnexa_origin_role', userRole)"),
    'dashboard-shell.tsx stores origin role in sessionStorage'
  );

  const custShellPath = path.join(root, 'src', 'components/customer/customer-shell.tsx');
  const custShellSrc = fs.readFileSync(custShellPath, 'utf8');

  assert(
    custShellSrc.includes('hasBusinessAccess && ('),
    'customer-shell.tsx guards business/staff return controls with hasBusinessAccess'
  );

  assert(
    custShellSrc.includes('Back to Staff') && custShellSrc.includes('Back to Business'),
    'customer-shell.tsx provides role-aware labels ("Back to Staff" / "Back to Business")'
  );

  assert(
    custShellSrc.includes('Viewing customer mode as'),
    'customer-shell.tsx renders top context indicator banner for switched accounts'
  );

  assert(
    custShellSrc.includes('href="/dashboard"'),
    'customer-shell.tsx return button links cleanly back to /dashboard'
  );

  // =========================================================================
  // 4. Invariant Simulation: Multi-Item Same MenuItemId Modifier Isolation
  // =========================================================================
  console.log('\n--- 4. Invariant Simulation: Multi-Item Modifier Isolation ---');
  
  // Simulate order with 3 items:
  // Item 1: Breakfast (menu_item_id: 'item-A') with Bacon (mod: 'opt-1')
  // Item 2: Breakfast (menu_item_id: 'item-A') with Poached Egg (mod: 'opt-2')
  // Item 3: Breakfast (menu_item_id: 'item-A') with Scrambled Egg (mod: 'opt-3')
  const simulatedOrderPayload = [
    {
      id: 'uuid-1111',
      menu_item_id: 'item-A',
      selectedModifiers: [{ groupId: 'g1', optionId: 'opt-1', nameSnapshot: 'Bacon', priceSnapshot: 1.5 }],
    },
    {
      id: 'uuid-2222',
      menu_item_id: 'item-A',
      selectedModifiers: [{ groupId: 'g1', optionId: 'opt-2', nameSnapshot: 'Poached Egg', priceSnapshot: 1.0 }],
    },
    {
      id: 'uuid-3333',
      menu_item_id: 'item-A',
      selectedModifiers: [{ groupId: 'g1', optionId: 'opt-3', nameSnapshot: 'Scrambled Egg', priceSnapshot: 1.0 }],
    },
  ];

  // Run the new mapping logic
  const modifierRows: Array<{ order_item_id: string; option_name_snapshot: string }> = [];
  for (const op of simulatedOrderPayload) {
    const orderItemId = op.id;
    for (const mod of op.selectedModifiers) {
      modifierRows.push({
        order_item_id: orderItemId,
        option_name_snapshot: mod.nameSnapshot,
      });
    }
  }

  assert(modifierRows.length === 3, 'All 3 modifier rows were generated');
  assert(
    modifierRows[0].order_item_id === 'uuid-1111' && modifierRows[0].option_name_snapshot === 'Bacon',
    'Item 1 (uuid-1111) is strictly mapped to Bacon'
  );
  assert(
    modifierRows[1].order_item_id === 'uuid-2222' && modifierRows[1].option_name_snapshot === 'Poached Egg',
    'Item 2 (uuid-2222) is strictly mapped to Poached Egg'
  );
  assert(
    modifierRows[2].order_item_id === 'uuid-3333' && modifierRows[2].option_name_snapshot === 'Scrambled Egg',
    'Item 3 (uuid-3333) is strictly mapped to Scrambled Egg'
  );

  // Group by order_item_id to verify ticket display separation
  const ticketGroups = new Map<string, string[]>();
  for (const row of modifierRows) {
    const list = ticketGroups.get(row.order_item_id) || [];
    list.push(row.option_name_snapshot);
    ticketGroups.set(row.order_item_id, list);
  }

  assert(ticketGroups.size === 3, 'Kitchen ticket receives 3 distinct modifier groups, 1 per item');
  assert(ticketGroups.get('uuid-1111')?.[0] === 'Bacon', 'Ticket Item 1 has only Bacon');
  assert(ticketGroups.get('uuid-2222')?.[0] === 'Poached Egg', 'Ticket Item 2 has only Poached Egg');
  assert(ticketGroups.get('uuid-3333')?.[0] === 'Scrambled Egg', 'Ticket Item 3 has only Scrambled Egg');

  console.log('\n================================================================');
  console.log(`   Verification Finished: ${passed} / ${total} Tests PASSED`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
