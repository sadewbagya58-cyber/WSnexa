import { HelpArticle } from '../types';

export const MENU_MANAGEMENT_ARTICLES: HelpArticle[] = [
  {
    slug: 'creating-menu-categories',
    title: 'Creating & Organizing Menu Categories',
    description: 'Structure your food and beverage catalog into clear, customer-friendly categories like Appetizers, Mains, Beverages, and Desserts.',
    category: 'menu-management',
    keywords: ['menu', 'categories', 'add category', 'reorder', 'drinks', 'food catalog', 'sections'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['menu.categories.manage'],
    contextRoutes: ['/dashboard/menu/categories', '/dashboard/menu'],
    popular: true,
    gettingStarted: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Open Menu Categories',
        instruction: 'From the dashboard sidebar under "MENU", click "Categories" (/dashboard/menu/categories).',
      },
      {
        number: 2,
        title: 'Click "+ Add Category"',
        instruction: 'Click the "+ Add Category" button in the upper right corner to open the creation modal.',
      },
      {
        number: 3,
        title: 'Enter Category Details',
        instruction: 'Provide a clear Category Name (e.g., "Specialty Coffee", "Stone-Fired Pizzas") and an optional short description.',
      },
      {
        number: 4,
        title: 'Set Display Order',
        instruction: 'Categories are presented on customer QR menus and waiter tablets in the exact order specified. Lower numbers appear first.',
        tip: 'Place high-margin appetizers and popular house specialties at the top of your list.',
      },
      {
        number: 5,
        title: 'Save Category',
        instruction: 'Click "Save Category". The new category will immediately become available when creating menu items.',
      },
    ],
    notes: [
      'Empty categories without active items will not clutter the public guest menu until you add at least one item.',
    ],
    relatedArticles: ['adding-menu-items-and-pricing', 'managing-modifiers-and-options', 'canonical-menu-principle'],
    directAction: {
      label: 'Manage Categories',
      href: '/dashboard/menu/categories',
    },
  },
  {
    slug: 'adding-menu-items-and-pricing',
    title: 'Adding Menu Items, Pricing & Photo Uploads',
    description: 'Add dishes, drinks, and combos with descriptions, pricing in LKR, dietary tags, and high-quality food photography.',
    category: 'menu-management',
    keywords: ['add item', 'menu items', 'pricing', 'photos', 'upload image', 'descriptions', 'dietary'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['menu.items.create'],
    contextRoutes: ['/dashboard/menu/items/new', '/dashboard/menu/items'],
    popular: true,
    gettingStarted: true,
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Navigate to New Menu Item',
        instruction: 'Click "Menu Items" (/dashboard/menu/items) in the sidebar and click "+ Add Item" or navigate directly to "/dashboard/menu/items/new".',
      },
      {
        number: 2,
        title: 'Fill in Item Details',
        instruction: 'Enter Item Name, select its Parent Category, and write an appetizing Description highlighting key ingredients.',
      },
      {
        number: 3,
        title: 'Set Base Price',
        instruction: 'Enter the Price in LKR (e.g. 1500). If you offer add-ons or sizes, you will attach modifier pricing in the next step.',
      },
      {
        number: 4,
        title: 'Upload Food Photo (Optional)',
        instruction: 'Upload a clear JPG, PNG, or WEBP image. High-quality food imagery dramatically increases guest ordering conversions on mobile QR menus.',
      },
      {
        number: 5,
        title: 'Save Item',
        instruction: 'Click "Create Menu Item". The item is immediately live across your digital catalog.',
      },
    ],
    notes: [
      'You can toggle items on/off or mark them Sold Out anytime from the main Menu Items list.',
    ],
    relatedArticles: ['creating-menu-categories', 'managing-modifiers-and-options', 'managing-sold-out-and-availability'],
    directAction: {
      label: 'Add Menu Item',
      href: '/dashboard/menu/items/new',
    },
  },
  {
    slug: 'managing-modifiers-and-options',
    title: 'Managing Item Modifiers, Add-ons & Custom Choices',
    description: 'Configure customizable options like drink sizes, cooking preferences, side dishes, and extra toppings with price adjustments.',
    category: 'menu-management',
    keywords: ['modifiers', 'add-ons', 'toppings', 'options', 'choices', 'customization', 'sizes'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['menu.modifiers.manage'],
    contextRoutes: ['/dashboard/menu/items'],
    popular: true,
    estimatedReadMinutes: 5,
    steps: [
      {
        number: 1,
        title: 'Open Item Modifiers Editor',
        instruction: 'Go to "/dashboard/menu/items", locate your dish or beverage, and click the "Modifiers" action button.',
      },
      {
        number: 2,
        title: 'Add Modifier Group',
        instruction: 'Click "+ Add Modifier Group" and provide a title (e.g. "Choose Milk Option", "Meat Temperature", "Extra Toppings").',
      },
      {
        number: 3,
        title: 'Configure Selection Rules',
        instruction: 'Set Selection Type to "Single Selection" (radio buttons, e.g. Small / Large) or "Multiple Selection" (checkboxes, e.g. Extra Cheese, Mushrooms). Specify if selection is "Required" or "Optional".',
      },
      {
        number: 4,
        title: 'Add Individual Modifier Options & Prices',
        instruction: 'For each option, enter the Option Name and Additional Price (cents / LKR). For example: "Oat Milk (+200 LKR)" or "Extra Bacon (+350 LKR)". Options with no extra charge can be set to 0.',
      },
      {
        number: 5,
        title: 'Save & Test in Menu Preview',
        instruction: 'Save your modifier group. Customers and waiters will now see interactive option selectors when adding this item to cart.',
      },
    ],
    notes: [
      'Selected modifiers are printed clearly on Kitchen Display tickets and itemized on Cashier receipts.',
    ],
    relatedArticles: ['adding-menu-items-and-pricing', 'canonical-menu-principle', 'reading-kitchen-tickets-and-modifiers'],
    directAction: {
      label: 'View Menu Items',
      href: '/dashboard/menu/items',
    },
  },
  {
    slug: 'managing-sold-out-and-availability',
    title: 'Managing Sold Out Status & Live Item Availability',
    description: 'Instantly mark items as Sold Out during busy service shifts to prevent guests from ordering unavailable dishes.',
    category: 'menu-management',
    keywords: ['sold out', 'out of stock', 'availability', '86 item', 'disable item', 'inventory'],
    allowedRoles: ['business_owner', 'branch_manager', 'kitchen_staff'],
    requiredPermissions: ['menu.availability.update'],
    contextRoutes: ['/dashboard/menu/items'],
    popular: true,
    estimatedReadMinutes: 2,
    steps: [
      {
        number: 1,
        title: 'Open Menu Items List',
        instruction: 'Go to "Menu Items" (/dashboard/menu/items) in the sidebar.',
      },
      {
        number: 2,
        title: 'Toggle Item Availability',
        instruction: 'Find the item in your list and click the "Available / Sold Out" switch. When toggled to "Sold Out", the item is immediately disabled for customer QR ordering and waiter ordering.',
      },
      {
        number: 3,
        title: 'Restore Availability',
        instruction: 'Once fresh stock arrives, simply toggle the switch back to "Available". The item will be instantly re-enabled across all digital menus.',
      },
    ],
    notes: [
      'Kitchen staff with menu availability permissions can 86 items directly from the kitchen terminal.',
    ],
    relatedArticles: ['adding-menu-items-and-pricing', 'canonical-menu-principle', 'kitchen-queue-overview'],
    directAction: {
      label: 'Manage Availability',
      href: '/dashboard/menu/items',
    },
  },
  {
    slug: 'canonical-menu-principle',
    title: 'Understanding the Canonical Menu Principle',
    description: 'Why WSNexa uses a single unified menu source for customer QR ordering, waiter mobile POS, and kitchen dispatch.',
    category: 'menu-management',
    keywords: ['canonical menu', 'single source of truth', 'unified catalog', 'pricing sync'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Manage Your Menu Once',
        instruction: 'In traditional POS systems, menus must be updated separately across cash registers, paper prints, and tablet apps. WSNexa maintains a single canonical catalog.',
      },
      {
        number: 2,
        title: 'Automatic Multi-Channel Synchronization',
        instruction: 'When you change a dish price, description, or modifier options, the update is instantly reflected on guest QR menus, Waiter POS tablets, and Kitchen Display tickets simultaneously.',
      },
      {
        number: 3,
        title: 'Zero Order Price Discrepancies',
        instruction: 'Because all orders route through the same canonical server pricing engine, price calculations, taxes, and modifier add-ons are 100% mathematically consistent across every channel.',
      },
    ],
    notes: [
      'You never need to sync databases or export catalog files manually.',
    ],
    relatedArticles: ['creating-menu-categories', 'adding-menu-items-and-pricing', 'managing-modifiers-and-options'],
    directAction: {
      label: 'View Menu Overview',
      href: '/dashboard/menu',
    },
  },
];
