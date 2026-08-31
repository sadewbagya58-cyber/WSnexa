import { HelpArticle } from '../types';

export const KITCHEN_OPERATIONS_ARTICLES: HelpArticle[] = [
  {
    slug: 'kitchen-queue-kds-overview',
    title: 'Kitchen Queue & Kitchen Display System (KDS) Guide',
    titleSiEn: 'Kitchen Queue සහ Kitchen Display System (KDS) භාවිතය',
    description: 'Learn how kitchen chefs view digital order tickets, item modifiers, preparation times, and dietary notes.',
    descriptionSiEn: 'මුළුතැන්ගෙයි කණ්ඩායම order tickets, modifiers, කාලය සහ විශේෂ උපදෙස් බලාගන්නා ආකාරය.',
    category: 'kitchen-operations',
    keywords: ['kitchen', 'kds', 'kitchen queue', 'tickets', 'cook time', 'chef screen'],
    popular: true,
    contextRoutes: ['/dashboard/kitchen'],
    estimatedReadMinutes: 3,
    steps: [
      {
        number: 1,
        title: 'Open Kitchen Queue',
        titleSiEn: 'Kitchen Queue එක open කරන්න',
        instruction: 'Kitchen team members navigate to Kitchen in the sidebar or directly access /dashboard/kitchen.',
        instructionSiEn: 'Kitchen team එක sidebar එකෙන් Kitchen තෝරා හෝ /dashboard/kitchen වෙත යයි.',
      },
      {
        number: 2,
        title: 'Read Incoming Tickets',
        titleSiEn: 'Incoming Tickets පරීක්ෂා කිරීම',
        instruction: 'Each ticket card displays Table Number, Guest notes, Order Time, Items, and Modifier Add-ons (e.g. "No Onions", "Extra Spicy").',
        instructionSiEn: 'සෑම ticket එකකම Table Number, Items, Modifiers (උදා. "No Onions", "Extra Spicy") සහ විශේෂ සටහන් පැහැදිලිව පෙන්වයි.',
      },
      {
        number: 3,
        title: 'Update Status to Preparing and Ready',
        titleSiEn: 'Status එක PREPARING සහ READY ලෙස සලකුණු කරන්න',
        instruction: 'Tap "🍳 Start Preparing" when cooking begins. Tap "🔔 Mark Ready to Serve" when the dish is ready for waitstaff pickup.',
        instructionSiEn: 'පිසීම ආරම්භ කළ විට "🍳 Start Preparing" ද, පිළිගැන්වීමට සූදානම් වූ විට "🔔 Mark Ready to Serve" ද click කරන්න.',
      },
    ],
    notes: [
      'Kitchen screens update in realtime with an optional sound chime toggle in the header ("New Order Chime On" / "Sound Muted").',
    ],
    notesSiEn: [
      'නව orders පැමිණෙන විට screen එක realtime update වන අතර header එකෙහි sound chime toggle එකක් ("New Order Chime On" / "Sound Muted") ඇත.',
    ],
    relatedArticles: ['updating-preparation-status', 'how-customer-orders-flow', 'troubleshooting-order-not-reaching-kitchen'],
    directAction: {
      label: 'Open Kitchen Queue',
      labelSiEn: 'Kitchen Queue වෙත යන්න',
      href: '/dashboard/kitchen',
    },
  },
  {
    slug: 'updating-preparation-status',
    title: 'How to Update Order Preparation Status in Kitchen',
    titleSiEn: 'Kitchen එකෙන් Order Preparation Status update කරන්නේ කෙසේද?',
    description: 'Learn the lifecycle buttons on the Kitchen ticket: Confirmed → In Preparation → Ready to Serve → Completed.',
    descriptionSiEn: 'Kitchen ticket එකෙහි Confirmed සිට Preparing, Ready සහ Completed දක්වා status update කරන පියවර.',
    category: 'kitchen-operations',
    keywords: ['preparation status', 'kitchen tickets', 'ready for pickup', 'cooking timer'],
    contextRoutes: ['/dashboard/kitchen'],
    estimatedReadMinutes: 2,
    steps: [
      {
        number: 1,
        title: 'Start Cooking (In Preparation)',
        titleSiEn: 'Start Cooking click කරන්න',
        instruction: 'Click the blue "🍳 Start Preparing" button to transition the order status to preparing.',
        instructionSiEn: 'නිල් පැහැති "🍳 Start Preparing" button එක click කර order status එක preparing තත්ත්වයට පත්කරන්න.',
      },
      {
        number: 2,
        title: 'Food Ready to Serve (Ready to Serve)',
        titleSiEn: 'Food Ready වූ විට සලකුණු කරන්න',
        instruction: 'When plated, tap "🔔 Mark Ready to Serve" to mark the ticket ready for pickup.',
        instructionSiEn: 'කෑම සකස් කර අවසන් වූ විට "🔔 Mark Ready to Serve" click කර ready තත්ත්වයට පත්කරන්න.',
      },
    ],
    relatedArticles: ['kitchen-queue-kds-overview', 'waiter-terminal-overview'],
    directAction: {
      label: 'View Kitchen Queue',
      labelSiEn: 'Kitchen Queue බලන්න',
      href: '/dashboard/kitchen',
    },
  },
];

