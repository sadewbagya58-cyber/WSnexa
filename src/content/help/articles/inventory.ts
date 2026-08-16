import { HelpArticle } from '../types';

export const inventoryArticles: HelpArticle[] = [
  {
    slug: 'inventory-quick-start',
    title: 'Inventory Quick Start Guide',
    description: 'Get started tracking raw ingredients, opening stock balances, and storage locations in minutes.',
    category: 'inventory-management',
    keywords: ['inventory', 'stock', 'ingredients', 'raw materials', 'quick start', 'onboarding'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['inventory.view'],
    contextRoutes: ['/dashboard/inventory'],
    gettingStarted: true,
    popular: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Open the Inventory Hub',
        instruction: 'Navigate to "Inventory Hub" from the sidebar menu to view your overall stock health, low-stock warnings, and valuation summary.',
      },
      {
        number: 2,
        title: 'Verify Default Storage Location',
        instruction: 'WSNexa automatically generates a default "Main Stock" location for your branch. You can create specialized locations like "Main Kitchen", "Cold Room", or "Bar Store" at any time under Storage Locations.',
      },
      {
        number: 3,
        title: 'Add Your First Ingredients',
        instruction: 'Click "+ Add Ingredient" to register raw food and beverage items with their base units (kg, g, L, ml, pcs) and optional opening quantities.',
      },
      {
        number: 4,
        title: 'Set Low Stock Thresholds',
        instruction: 'Specify a minimum par stock level for each ingredient so WSNexa can proactively alert you before kitchen lines run out.',
      },
    ],
    notes: [
      'Inventory items are defined at the business level so multiple branches share canonical ingredient names, while physical stock quantities remain strictly branch and location-isolated.',
    ],
    relatedArticles: [
      'adding-inventory-items-and-units',
      'understanding-storage-locations',
      'recording-stock-adjustments-and-waste',
    ],
    directAction: {
      label: 'Go to Inventory Hub',
      href: '/dashboard/inventory',
    },
  },
  {
    slug: 'adding-inventory-items-and-units',
    title: 'Adding Inventory Items & Units',
    description: 'How to register raw ingredients, packaging, unit conversions, and opening balances.',
    category: 'inventory-management',
    keywords: ['add item', 'base unit', 'kg', 'litre', 'ingredient', 'cost', 'opening stock'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['inventory.items.manage'],
    contextRoutes: ['/dashboard/inventory/items', '/dashboard/inventory/items/new'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Navigate to Stock Items',
        instruction: 'Go to "/dashboard/inventory/items" and click "+ Add Ingredient".',
      },
      {
        number: 2,
        title: 'Enter Item Name & Category',
        instruction: 'Provide the ingredient name (e.g. Chicken Breast, Whole Milk) and assign it to an inventory category.',
      },
      {
        number: 3,
        title: 'Select Base Measurement Unit',
        instruction: 'Choose the standard base unit (kg, g, L, ml, pcs). All stock balances and future recipe consumptions will be normalized to this unit.',
        tip: 'Choose the smallest practical storage unit for recipes, such as kg for meats or L for liquids.',
      },
      {
        number: 4,
        title: 'Enter Unit Cost & Minimum Par Level',
        instruction: 'Input the estimated cost per base unit and the minimum safety stock threshold.',
      },
      {
        number: 5,
        title: 'Enter Initial Opening Stock (Optional)',
        instruction: 'If you already have stock on hand, enter the current physical quantity and choose the storage location.',
      },
    ],
    notes: [
      'Cost per unit is visible only to users with the "View Inventory Costs & Valuation" permission.',
    ],
    relatedArticles: ['inventory-quick-start', 'understanding-stock-levels'],
    directAction: {
      label: 'Add Ingredient',
      href: '/dashboard/inventory/items/new',
    },
  },
  {
    slug: 'understanding-storage-locations',
    title: 'Managing Branch Storage Locations',
    description: 'Organize physical stock across walk-in freezers, dry stores, bar caches, and kitchen lines.',
    category: 'inventory-management',
    keywords: ['storage location', 'cold room', 'kitchen store', 'bar stock', 'freezer'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['inventory.locations.manage'],
    contextRoutes: ['/dashboard/inventory/locations'],
    estimatedReadMinutes: 2,
    steps: [
      {
        number: 1,
        title: 'Go to Storage Locations',
        instruction: 'Navigate to "/dashboard/inventory/locations" to view all configured storage areas in your active branch.',
      },
      {
        number: 2,
        title: 'Click "+ Add Storage Location"',
        instruction: 'Enter a recognizable name (e.g. Cold Room Chiller) and unique location code (e.g. COLD_ROOM).',
      },
      {
        number: 3,
        title: 'Assign Default Location Status',
        instruction: 'Mark a primary location as "Default Main Stock" if you want new item balances and general deliveries to route there by default.',
      },
    ],
    relatedArticles: ['inventory-quick-start', 'managing-stock-transfers'],
    directAction: {
      label: 'Manage Locations',
      href: '/dashboard/inventory/locations',
    },
  },
  {
    slug: 'recording-stock-adjustments-and-waste',
    title: 'Recording Stock Adjustments & Kitchen Waste',
    description: 'How to manually correct balances, record wholesale deliveries, and log kitchen spoilage.',
    category: 'inventory-management',
    keywords: ['stock adjustment', 'waste', 'spoilage', 'damaged', 'staff meal', 'delivery'],
    allowedRoles: ['business_owner', 'branch_manager', 'kitchen_staff'],
    requiredPermissions: ['inventory.adjust', 'inventory.waste.record'],
    contextRoutes: ['/dashboard/inventory/items', '/dashboard/inventory/waste'],
    popular: true,
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Select Item from Stock Items List',
        instruction: 'Find the ingredient on the Stock Items table and click the "Adjust" or "Waste" button.',
      },
      {
        number: 2,
        title: 'Choose Adjustment Type & Reason',
        instruction: 'For adjustments, select "+ Add Stock", "- Remove", or "= Set Count". For waste, select the reason (Spoiled, Expired, Prep Trimming, Overcooked, Dropped).',
      },
      {
        number: 3,
        title: 'Enter Quantity & Unit',
        instruction: 'Type the quantity and select the measurement unit. WSNexa will automatically convert compatible units (e.g. 500 g -> 0.5 kg).',
      },
      {
        number: 4,
        title: 'Commit Mutation',
        instruction: 'Click "Commit Adjustment" or "Record Waste". The stock balance updates atomically and an immutable movement ledger entry is logged.',
      },
    ],
    relatedArticles: ['performing-physical-stock-counts', 'inventory-quick-start'],
    directAction: {
      label: 'View Waste Log',
      href: '/dashboard/inventory/waste',
    },
  },
  {
    slug: 'performing-physical-stock-counts',
    title: 'Performing Physical Stock Counts & Audits',
    description: 'Conduct mobile-friendly physical stock counts, calculate variances, and reconcile balances.',
    category: 'inventory-management',
    keywords: ['stock count', 'physical audit', 'variance', 'reconciliation', 'blind count'],
    allowedRoles: ['business_owner', 'branch_manager', 'kitchen_staff'],
    requiredPermissions: ['inventory.counts.manage'],
    contextRoutes: ['/dashboard/inventory/counts'],
    estimatedReadMinutes: 4,
    steps: [
      {
        number: 1,
        title: 'Start a New Count Audit Sheet',
        instruction: 'Go to "/dashboard/inventory/counts/new", choose the target storage location, enter a title, and select whether to run a Blind Count.',
      },
      {
        number: 2,
        title: 'Use the Mobile-First Counter Interface',
        instruction: 'Walk through your shelves or walk-in cooler on a mobile phone or tablet, entering counted numbers using large numeric inputs.',
      },
      {
        number: 3,
        title: 'Submit Count Sheet',
        instruction: 'Once all items are audited, click "Submit Count" to send the audit sheet for manager review.',
      },
      {
        number: 4,
        title: 'Approve & Reconcile Variances',
        instruction: 'A manager with count approval permission reviews discrepancies and clicks "Approve & Reconcile" to automatically align system balances with the physical count.',
      },
    ],
    relatedArticles: ['recording-stock-adjustments-and-waste', 'understanding-stock-levels'],
    directAction: {
      label: 'Start Stock Count',
      href: '/dashboard/inventory/counts/new',
    },
  },
  {
    slug: 'managing-stock-transfers',
    title: 'Managing Same-Branch & Cross-Branch Stock Transfers',
    description: 'Dispatch stock between storage areas or across authorized sister outlets with receipt verification.',
    category: 'inventory-management',
    keywords: ['stock transfer', 'dispatch', 'receive', 'transit', 'cross branch'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['inventory.transfers.manage', 'inventory.transfers.receive'],
    contextRoutes: ['/dashboard/inventory/transfers'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Create a Draft Transfer',
        instruction: 'Go to "/dashboard/inventory/transfers/new", choose source/destination locations, and add the items and quantities to transfer.',
      },
      {
        number: 2,
        title: 'Dispatch Transfer',
        instruction: 'Click "Dispatch". Source stock is deducted immediately and the transfer is marked "In Transit".',
      },
      {
        number: 3,
        title: 'Acknowledge Inbound Receipt',
        instruction: 'When goods arrive at the destination location, authorized staff click "Receive Stock" to confirm quantities and add items to destination balances.',
      },
    ],
    relatedArticles: ['understanding-storage-locations', 'inventory-quick-start'],
    directAction: {
      label: 'View Stock Transfers',
      href: '/dashboard/inventory/transfers',
    },
  },
  {
    slug: 'understanding-stock-levels',
    title: 'Understanding Stock Levels & Health Insights',
    description: 'How WSNexa calculates real-time inventory balances, stock status badges, and health scores.',
    category: 'inventory-management',
    keywords: ['stock levels', 'health score', 'low stock', 'out of stock', 'par level'],
    allowedRoles: ['business_owner', 'branch_manager'],
    requiredPermissions: ['inventory.view'],
    contextRoutes: ['/dashboard/inventory', '/dashboard/inventory/items'],
    estimatedReadMinutes: 2,
    steps: [
      {
        number: 1,
        title: 'Healthy Stock (Green)',
        instruction: 'Current physical balance exceeds the minimum safety threshold.',
      },
      {
        number: 2,
        title: 'Low Stock Alert (Amber)',
        instruction: 'Current balance is at or below the minimum par level configured on the item.',
      },
      {
        number: 3,
        title: 'Out of Stock (Red)',
        instruction: 'Zero balance available across all storage locations in the active branch.',
      },
      {
        number: 4,
        title: 'Inventory Health Score',
        instruction: 'A 0–100 deterministic score reflecting your venue’s inventory stability based on active stockout penalties and par compliance.',
      },
    ],
    relatedArticles: ['inventory-quick-start', 'adding-inventory-items-and-units'],
    directAction: {
      label: 'View Inventory Health',
      href: '/dashboard/inventory',
    },
  },
];
