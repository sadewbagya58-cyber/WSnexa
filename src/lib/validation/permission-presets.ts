import { PermissionKey } from '@/lib/validation/permission';

export interface RolePreset {
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    key: 'cashier',
    name: 'Cashier',
    description: 'Front-of-house billing, order viewing, payment recording, and receipt printing.',
    permissions: [
      'orders.view',
      'cashier.access',
      'payments.record',
      'payments.view',
      'receipts.print',
      'menu.view',
      'tables.view',
      'reports.view',
    ],
  },
  {
    key: 'kitchen_staff',
    name: 'Kitchen Staff',
    description: 'Back-of-house ticket display queue access and kitchen status updates.',
    permissions: ['orders.view', 'kitchen.access', 'kitchen.update'],
  },
  {
    key: 'waiter',
    name: 'Waiter',
    description: 'Guest table service requests, assistance management, and menu/table visibility.',
    permissions: [
      'orders.view',
      'waiter.requests.view',
      'waiter.requests.manage',
      'menu.view',
      'tables.view',
    ],
  },
  {
    key: 'branch_manager',
    name: 'Branch Manager',
    description: 'Operational manager with full branch-scoped management permissions.',
    permissions: [
      'orders.view',
      'orders.update_status',
      'orders.cancel',
      'kitchen.access',
      'kitchen.update',
      'cashier.access',
      'payments.record',
      'payments.view',
      'receipts.print',
      'waiter.requests.view',
      'waiter.requests.manage',
      'menu.view',
      'menu.manage',
      'tables.view',
      'tables.manage',
      'qr.manage',
      'staff.view',
      'reports.view',
      'reports.export',
    ],
  },
  {
    key: 'supervisor',
    name: 'Supervisor',
    description: 'Floor supervisor with menu catalog, table, and sales reporting access.',
    permissions: [
      'orders.view',
      'orders.update_status',
      'menu.view',
      'menu.manage',
      'tables.view',
      'tables.manage',
      'reports.view',
    ],
  },
];

export function getPermissionsForPreset(presetKey: string): PermissionKey[] {
  const preset = ROLE_PRESETS.find((p) => p.key === presetKey);
  return preset ? [...preset.permissions] : [];
}
