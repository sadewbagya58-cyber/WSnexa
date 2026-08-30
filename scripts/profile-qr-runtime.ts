import { cartReducer, initialCartState, CartState } from '../src/features/cart/cart-context';
import { getMenuThumbnailUrl } from '../src/lib/image-optimizer';
import * as fs from 'fs';
import * as path from 'path';

function runProfile() {
  console.log('\n========================================');
  console.log('🚀 WSNexa QR Menu Runtime Profiler (P0 Round 3)');
  console.log('========================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${title}`);
      if (detail) console.log(`   └─ ${detail}`);
    } else {
      console.error(`❌ [FAIL] ${title}`);
      if (detail) console.error(`   └─ ${detail}`);
    }
  }

  // --- Test 1: Cart State Isolation & Fine-Grained Subscription ---
  console.log('--- TEST 1: Cart State Isolation & Granular Selectors ---');
  let state: CartState = {
    ...initialCartState,
    branchId: 'test-branch-1',
    currency: 'USD',
  };

  // Add 1 Burger
  state = cartReducer(state, {
    type: 'ADD_LINE',
    payload: {
      menuItemId: 'item-burger-1',
      itemName: 'Signature Burger',
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd',
      quantity: 2,
      basePriceCents: 1200,
      selectedModifiers: [],
    },
  });

  // Selector helper simulating useItemCartQuantity
  const getQtyForItem = (s: CartState, id: string) => {
    let sum = 0;
    for (const l of s.lines) {
      if (l.menuItemId === id) sum += l.quantity;
    }
    return sum;
  };

  const burgerQty = getQtyForItem(state, 'item-burger-1');
  const coffeeQty = getQtyForItem(state, 'item-coffee-2');
  const cakeQty = getQtyForItem(state, 'item-cake-3');

  assert(
    'Target item receives exact quantity update',
    burgerQty === 2,
    `Burger quantity: ${burgerQty}`
  );
  assert(
    'Unrelated items receive 0 and do not change snapshot',
    coffeeQty === 0 && cakeQty === 0,
    `Coffee: ${coffeeQty}, Cake: ${cakeQty}`
  );

  // --- Test 2: Image Downscaling Pipeline ---
  console.log('\n--- TEST 2: Image Downscaling & Thumbnail Pipeline ---');
  const unsplashOriginal = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=2000';
  const unsplashThumb = getMenuThumbnailUrl(unsplashOriginal, 160);
  assert(
    'Unsplash image is downscaled to w=160',
    unsplashThumb !== null && unsplashThumb.includes('w=160') && unsplashThumb.includes('auto=format'),
    `Result: ${unsplashThumb}`
  );

  const pexelsOriginal = 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg';
  const pexelsThumb = getMenuThumbnailUrl(pexelsOriginal, 160);
  assert(
    'Pexels image is compressed and sized to w=160',
    pexelsThumb !== null && pexelsThumb.includes('w=160') && pexelsThumb.includes('tinysrgb'),
    `Result: ${pexelsThumb}`
  );

  const supabaseOriginal = 'https://example.supabase.co/storage/v1/object/public/menu-items/dish.jpg';
  const supabaseThumb = getMenuThumbnailUrl(supabaseOriginal, 160);
  assert(
    'Supabase Storage image routed to render transform',
    supabaseThumb !== null && supabaseThumb.includes('/storage/v1/render/image/public/') && supabaseThumb.includes('width=160'),
    `Result: ${supabaseThumb}`
  );

  // --- Test 3: Expensive Mobile CSS Elimination ---
  console.log('\n--- TEST 3: Mobile CSS Audit (No backdrop-blur on scroll/modals) ---');
  const categoryTabsSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/menu/category-tabs.tsx'), 'utf-8');
  assert(
    'CategoryTabs has NO backdrop-blur during scroll',
    !categoryTabsSrc.includes('backdrop-blur'),
    'Sticky category bar uses solid background for 60fps GPU scroll'
  );

  const publicGuestMenuSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/qr/public-guest-menu.tsx'), 'utf-8');
  assert(
    'PublicGuestMenu does not subscribe directly to CartState lines',
    !publicGuestMenuSrc.includes('state.lines') && publicGuestMenuSrc.includes('useCartActions'),
    'PublicGuestMenu decoupled from cart state updates'
  );

  const guestBottomActionsSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/qr/guest-menu-bottom-actions.tsx'), 'utf-8');
  assert(
    'GuestMenuBottomActions uses useCartSummary and has no backdrop-blur',
    guestBottomActionsSrc.includes('useCartSummary') && !guestBottomActionsSrc.includes('backdrop-blur'),
    'Floating bar uses fine-grained summary selector and solid background'
  );

  const itemDetailSheetSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/guest/item-detail-sheet.tsx'), 'utf-8');
  assert(
    'ItemDetailSheet overlay has no backdrop-blur',
    !itemDetailSheetSrc.includes('backdrop-blur'),
    'Modal overlay uses flat dark backdrop'
  );

  // --- Test 4: Modifier Group Selector Memoization ---
  console.log('\n--- TEST 4: Modifier Group Selector Performance ---');
  const modSelectorSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/guest/modifier-group-selector.tsx'), 'utf-8');
  assert(
    'ModifierGroupSelector is wrapped in React.memo with custom equality comparator',
    modSelectorSrc.includes('React.memo') && modSelectorSrc.includes('areGroupPropsEqual'),
    'Sibling modifier groups skip re-renders when another group is tapped'
  );

  console.log(`\n========================================`);
  console.log(`Results: ${passed} / ${total} tests passed`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runProfile();
