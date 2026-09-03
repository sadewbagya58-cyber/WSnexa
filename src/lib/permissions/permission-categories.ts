import { FormattedPermission } from '@/types/authorization.types';

export interface PermissionCategoryMeta {
  id: string;
  name: string;
  icon: string;
  badgeStyle: string;
}

export const PERMISSION_CATEGORIES: PermissionCategoryMeta[] = [
  { id: 'Organization', name: 'Organization', icon: '🏢', badgeStyle: 'bg-blue-50 text-blue-800 border-blue-200' },
  { id: 'Staff & People', name: 'Staff & People', icon: '👥', badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { id: 'Branches', name: 'Branches', icon: '📍', badgeStyle: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  { id: 'Orders', name: 'Orders', icon: '🛒', badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'Kitchen', name: 'Kitchen', icon: '🍳', badgeStyle: 'bg-orange-50 text-orange-800 border-orange-200' },
  { id: 'Menu', name: 'Menu', icon: '🍽️', badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200' },
  { id: 'Inventory', name: 'Inventory', icon: '📦', badgeStyle: 'bg-teal-50 text-teal-800 border-teal-200' },
  { id: 'Purchasing', name: 'Purchasing', icon: '🛍️', badgeStyle: 'bg-cyan-50 text-cyan-800 border-cyan-200' },
  { id: 'Suppliers', name: 'Suppliers', icon: '🚚', badgeStyle: 'bg-sky-50 text-sky-800 border-sky-200' },
  { id: 'QR / Tables', name: 'QR / Tables', icon: '📱', badgeStyle: 'bg-purple-50 text-purple-800 border-purple-200' },
  { id: 'Waiter', name: 'Waiter', icon: '🛎️', badgeStyle: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  { id: 'Reservations', name: 'Reservations', icon: '📅', badgeStyle: 'bg-violet-50 text-violet-800 border-violet-200' },
  { id: 'Customers', name: 'Customers', icon: '👤', badgeStyle: 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' },
  { id: 'Loyalty', name: 'Loyalty', icon: '🎁', badgeStyle: 'bg-pink-50 text-pink-800 border-pink-200' },
  { id: 'Reports', name: 'Reports', icon: '📊', badgeStyle: 'bg-slate-50 text-slate-800 border-slate-200' },
  { id: 'Reviews / Reputation', name: 'Reviews / Reputation', icon: '⭐', badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'Business / Venue', name: 'Business / Venue', icon: '🏛️', badgeStyle: 'bg-zinc-100 text-zinc-800 border-zinc-200' },
  { id: 'Other / Miscellaneous', name: 'Other / Miscellaneous', icon: '⚙️', badgeStyle: 'bg-zinc-50 text-zinc-700 border-zinc-200' },
];

export function resolvePermissionCategory(perm: { key: string; category?: string }): string {
  const key = perm.key.toLowerCase();

  if (key.startsWith('organization.') || key.startsWith('positions.')) return 'Organization';
  if (
    key.startsWith('staff.') ||
    key.startsWith('people.') ||
    key.startsWith('roles.') ||
    key.startsWith('permissions.') ||
    key.startsWith('invitations.') ||
    key === 'owner.transfer'
  ) {
    return 'Staff & People';
  }
  if (key.startsWith('branches.')) return 'Branches';
  if (key.startsWith('kitchen.')) return 'Kitchen';
  if (key.startsWith('menu.')) return 'Menu';
  if (key.startsWith('orders.') || key.startsWith('order_security.')) return 'Orders';
  if (key.startsWith('inventory.') || key.startsWith('recipes.')) return 'Inventory';
  if (key.startsWith('purchasing.')) return 'Purchasing';
  if (key.startsWith('suppliers.')) return 'Suppliers';
  if (key.startsWith('tables.') || key.startsWith('qr.') || key.startsWith('areas.')) return 'QR / Tables';
  if (key.startsWith('waiter.')) return 'Waiter';
  if (key.startsWith('reservations.')) return 'Reservations';
  if (key.startsWith('customers.')) return 'Customers';
  if (key.startsWith('loyalty.')) return 'Loyalty';
  if (key.startsWith('reports.')) return 'Reports';
  if (key.startsWith('reviews.') || key.startsWith('reputation.')) return 'Reviews / Reputation';
  if (key.startsWith('business.')) return 'Business / Venue';

  if (perm.category && perm.category.trim().length > 0 && perm.category !== 'General') {
    return perm.category;
  }

  return 'Other / Miscellaneous';
}

export function groupPermissionsByCategory(
  catalog: FormattedPermission[]
): Record<string, FormattedPermission[]> {
  const grouped: Record<string, FormattedPermission[]> = {};

  // Initialize known categories in defined priority order
  for (const cat of PERMISSION_CATEGORIES) {
    grouped[cat.name] = [];
  }

  for (const perm of catalog) {
    const category = resolvePermissionCategory(perm);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(perm);
  }

  // Remove empty categories
  for (const key of Object.keys(grouped)) {
    if (grouped[key].length === 0) {
      delete grouped[key];
    }
  }

  return grouped;
}
