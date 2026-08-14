-- Migration: 20260814120000_permissions_v2_catalog.sql
-- Description: Insert granular V2 action permission keys and update built-in role template grants

-- 1. Seed/Upsert Granular Permissions V2 Catalog
INSERT INTO public.permissions (key, name, description, category, risk_level) VALUES
  -- Orders
  ('orders.view', 'View Active Orders', 'View live operational guest orders', 'Orders', 'low'),
  ('orders.create', 'Create Orders', 'Create guest or table orders', 'Orders', 'medium'),
  ('orders.update_status', 'Update Order Status', 'Update order progress (e.g. preparing, ready, completed)', 'Orders', 'medium'),
  ('orders.cancel', 'Cancel Orders', 'Cancel or void active orders', 'Orders', 'high'),
  ('orders.history.view', 'View Order History', 'View historical completed/cancelled order records', 'Orders', 'low'),

  -- Waiter
  ('waiter.access', 'Access Waiter Workspace', 'Access waiter service center and table operations', 'Waiter', 'low'),
  ('waiter.requests.view', 'View Waiter Requests', 'View guest table calls and assistance requests', 'Waiter', 'low'),
  ('waiter.requests.manage', 'Manage Waiter Requests', 'Acknowledge, clear, or resolve waiter requests and pending orders', 'Waiter', 'low'),
  ('waiter.orders.create', 'Create Waiter Table Orders', 'Place orders on behalf of guests from waiter workspace', 'Waiter', 'medium'),

  -- Kitchen
  ('kitchen.access', 'Access Kitchen KDS', 'Access Kitchen Display System queue', 'Kitchen', 'low'),
  ('kitchen.orders.view', 'View Kitchen Tickets', 'View active kitchen ticket items', 'Kitchen', 'low'),
  ('kitchen.update', 'Update Kitchen Ticket', 'Mark kitchen preparation states (in_preparation, ready)', 'Kitchen', 'medium'),

  -- Cashier & Payments
  ('cashier.access', 'Access Cashier POS', 'Access cashier billing terminal and order settlements', 'Cashier & Payments', 'medium'),
  ('payments.view', 'View Payment Logs', 'View transaction history and billing audit logs', 'Cashier & Payments', 'medium'),
  ('payments.record', 'Record Payments', 'Process cash, card, or counter payments and mark orders paid', 'Cashier & Payments', 'high'),
  ('payments.void', 'Void Payments', 'Void un-settled transaction records', 'Cashier & Payments', 'high'),
  ('payments.refund', 'Refund Payments', 'Process customer payment refunds', 'Cashier & Payments', 'critical'),
  ('receipts.print', 'Print Receipts', 'Generate and print guest payment receipts', 'Cashier & Payments', 'low'),

  -- Menu & Modifiers
  ('menu.view', 'View Menu Catalog', 'View menu categories, items, pricing, and options', 'Menu Catalog', 'low'),
  ('menu.items.create', 'Create Menu Items', 'Create new menu items', 'Menu Catalog', 'medium'),
  ('menu.items.edit', 'Edit Menu Item Details', 'Edit item name, description, category, and image', 'Menu Catalog', 'medium'),
  ('menu.price.update', 'Update Menu Prices', 'Modify item base prices and modifier option prices', 'Menu Catalog', 'high'),
  ('menu.availability.update', 'Toggle Item Stock Status', 'Toggle menu item availability (in stock / sold out)', 'Menu Catalog', 'low'),
  ('menu.items.delete', 'Delete Menu Items', 'Archive or delete menu items', 'Menu Catalog', 'high'),
  ('menu.categories.manage', 'Manage Categories', 'Create, edit, reorder, or delete menu categories', 'Menu Catalog', 'medium'),
  ('menu.modifiers.manage', 'Manage Modifiers', 'Create, edit, and attach modifier groups and options', 'Menu Catalog', 'medium'),

  -- Dining & Tables
  ('tables.view', 'View Dining Tables', 'View table visual layout, capacity, and occupancy status', 'Dining & Tables', 'low'),
  ('tables.status.update', 'Update Table Status', 'Mark table operational status (available, occupied, reserved)', 'Dining & Tables', 'low'),
  ('tables.create', 'Create Dining Tables', 'Create single or bulk dining tables', 'Dining & Tables', 'medium'),
  ('tables.edit', 'Edit Table Layout', 'Edit table details, capacity, and area assignment', 'Dining & Tables', 'medium'),
  ('tables.delete', 'Delete Dining Tables', 'Remove dining tables from branch layout', 'Dining & Tables', 'high'),

  -- Service Areas
  ('areas.view', 'View Service Areas', 'View dining service areas and table groupings', 'Dining & Tables', 'low'),
  ('areas.manage', 'Manage Service Areas', 'Create, edit, or delete dining service areas', 'Dining & Tables', 'medium'),

  -- QR Cards & Security
  ('qr.view', 'View Table QR Codes', 'View table QR codes and cards', 'Dining & Tables', 'low'),
  ('qr.generate', 'Generate QR Code Cards', 'Download and print table QR ordering cards', 'Dining & Tables', 'medium'),
  ('qr.security.reset', 'Reset Table Security PINs', 'Regenerate table security PINs and QR tokens', 'Dining & Tables', 'high'),

  -- Reports & Analytics
  ('reports.view', 'View Operational Reports', 'View operational order counts and daily summaries', 'Reports & Analytics', 'low'),
  ('reports.financial.view', 'View Financial Analytics', 'View detailed sales, revenue breakdowns, and profit metrics', 'Reports & Analytics', 'high'),
  ('reports.export', 'Export Sales Reports', 'Export sales analytics data to CSV/Excel', 'Reports & Analytics', 'medium'),

  -- Team & Staff
  ('staff.view', 'View Staff Roster', 'View team members list and branch assignments', 'Team & Staff', 'low'),
  ('staff.invite', 'Invite Staff Members', 'Send email invitations to new team members', 'Team & Staff', 'medium'),
  ('staff.edit', 'Edit Staff Details', 'Update staff member profile information', 'Team & Staff', 'medium'),
  ('staff.suspend', 'Suspend/Reactivate Staff', 'Suspend or restore staff membership access', 'Team & Staff', 'high'),
  ('staff.role.assign', 'Assign Member Roles', 'Assign built-in or custom roles to staff', 'Team & Staff', 'high'),
  ('staff.branch.assign', 'Assign Member Branches', 'Assign member access to specific branches', 'Team & Staff', 'medium'),
  ('staff.area.assign', 'Assign Service Areas', 'Assign waiters to specific dining service areas', 'Team & Staff', 'medium'),

  -- Roles & Permissions Administration
  ('roles.view', 'View Roles Catalog', 'View built-in role presets and custom roles', 'Team & Staff', 'low'),
  ('roles.manage', 'Manage Custom Roles', 'Create, edit, or archive custom roles', 'Team & Staff', 'critical'),
  ('permissions.override.manage', 'Manage Member Overrides', 'Set explicit allow/deny permission overrides per member', 'Team & Staff', 'critical'),

  -- Branch Management
  ('branches.view', 'View Branch Directory', 'View branch locations and details', 'Branches', 'low'),
  ('branches.operational.manage', 'Manage Branch Operations', 'Configure branch ordering modes and operational hours', 'Branches', 'medium'),
  ('branches.manage', 'Manage Branch Entities', 'Create new branches, edit legal settings, or archive branches', 'Branches', 'critical'),

  -- Business Settings
  ('business.view', 'View Business Details', 'View business profile and legal entity details', 'Business Settings', 'low'),
  ('business.settings.manage', 'Manage Business Settings', 'Edit legal business details, currency, and timezone', 'Business Settings', 'critical'),

  -- Public Venue Profile
  ('venue_profile.view', 'View Venue Profile', 'View public venue presentation settings', 'Venue Profile', 'low'),
  ('venue_profile.manage', 'Manage Venue Profile', 'Edit public venue bio, media, hours, and branding', 'Venue Profile', 'medium'),

  -- Reviews & Reputation
  ('reviews.view', 'View Customer Reviews', 'View customer dining reviews and feedback', 'Reviews & Reputation', 'low'),
  ('reviews.respond', 'Respond to Reviews', 'Publish official business responses to customer reviews', 'Reviews & Reputation', 'medium'),
  ('reviews.moderate', 'Moderate Reviews', 'Flag or request review moderation', 'Reviews & Reputation', 'medium'),
  ('reputation.view', 'View Reputation Analytics', 'View rating analytics, rankings, and reputation trends', 'Reviews & Reputation', 'low'),
  ('reputation.export', 'Export Reputation Data', 'Export customer review analytics', 'Reviews & Reputation', 'medium'),

  -- Loyalty & Rewards
  ('loyalty.view', 'View Loyalty Program', 'View loyalty program overview and statistics', 'Loyalty & Rewards', 'low'),
  ('loyalty.manage', 'Manage Loyalty Program', 'Configure loyalty earn rates, rules, and tiers', 'Loyalty & Rewards', 'high'),
  ('loyalty.rewards.manage', 'Manage Rewards Catalog', 'Create, edit, or activate redeemable customer rewards', 'Loyalty & Rewards', 'medium'),
  ('loyalty.customers.view', 'View Loyalty Customers', 'View customer loyalty points directory', 'Loyalty & Rewards', 'low'),
  ('loyalty.points.adjust', 'Adjust Customer Points', 'Manually grant or deduct customer loyalty points', 'Loyalty & Rewards', 'high'),

  -- Order Security Engine
  ('order_security.view', 'View Security Settings', 'View order security engine status and policy levels', 'Order Security Engine', 'medium'),
  ('order_security.manage', 'Manage Security Engine', 'Configure anti-fake order security levels and geo radius', 'Order Security Engine', 'critical'),

  -- Owner Only
  ('owner.transfer', 'Transfer Business Ownership', 'Transfer primary business ownership to another user', 'Owner Operations', 'critical')

ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  risk_level = EXCLUDED.risk_level;

-- 2. Backfill Built-in Role Template Grants in public.role_permissions
-- Cashier
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('cashier', 'orders.view'),
  ('cashier', 'orders.history.view'),
  ('cashier', 'cashier.access'),
  ('cashier', 'payments.view'),
  ('cashier', 'payments.record'),
  ('cashier', 'receipts.print'),
  ('cashier', 'menu.view'),
  ('cashier', 'tables.view'),
  ('cashier', 'reports.view')
ON CONFLICT DO NOTHING;

-- Kitchen Staff
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('kitchen_staff', 'orders.view'),
  ('kitchen_staff', 'kitchen.access'),
  ('kitchen_staff', 'kitchen.orders.view'),
  ('kitchen_staff', 'kitchen.update'),
  ('kitchen_staff', 'menu.view')
ON CONFLICT DO NOTHING;

-- Waiter
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('waiter', 'orders.view'),
  ('waiter', 'waiter.access'),
  ('waiter', 'waiter.requests.view'),
  ('waiter', 'waiter.requests.manage'),
  ('waiter', 'waiter.orders.create'),
  ('waiter', 'menu.view'),
  ('waiter', 'tables.view'),
  ('waiter', 'tables.status.update')
ON CONFLICT DO NOTHING;

-- Branch Manager
INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('branch_manager', 'orders.view'),
  ('branch_manager', 'orders.create'),
  ('branch_manager', 'orders.update_status'),
  ('branch_manager', 'orders.cancel'),
  ('branch_manager', 'orders.history.view'),
  ('branch_manager', 'waiter.access'),
  ('branch_manager', 'waiter.requests.view'),
  ('branch_manager', 'waiter.requests.manage'),
  ('branch_manager', 'waiter.orders.create'),
  ('branch_manager', 'kitchen.access'),
  ('branch_manager', 'kitchen.orders.view'),
  ('branch_manager', 'kitchen.update'),
  ('branch_manager', 'cashier.access'),
  ('branch_manager', 'payments.view'),
  ('branch_manager', 'payments.record'),
  ('branch_manager', 'receipts.print'),
  ('branch_manager', 'menu.view'),
  ('branch_manager', 'menu.items.create'),
  ('branch_manager', 'menu.items.edit'),
  ('branch_manager', 'menu.price.update'),
  ('branch_manager', 'menu.availability.update'),
  ('branch_manager', 'menu.items.delete'),
  ('branch_manager', 'menu.categories.manage'),
  ('branch_manager', 'menu.modifiers.manage'),
  ('branch_manager', 'tables.view'),
  ('branch_manager', 'tables.status.update'),
  ('branch_manager', 'tables.create'),
  ('branch_manager', 'tables.edit'),
  ('branch_manager', 'tables.delete'),
  ('branch_manager', 'areas.view'),
  ('branch_manager', 'areas.manage'),
  ('branch_manager', 'qr.view'),
  ('branch_manager', 'qr.generate'),
  ('branch_manager', 'staff.view'),
  ('branch_manager', 'staff.invite'),
  ('branch_manager', 'staff.edit'),
  ('branch_manager', 'staff.suspend'),
  ('branch_manager', 'staff.role.assign'),
  ('branch_manager', 'staff.area.assign'),
  ('branch_manager', 'reports.view'),
  ('branch_manager', 'reports.financial.view'),
  ('branch_manager', 'reports.export')
ON CONFLICT DO NOTHING;

-- 3. Migration helper function to map legacy permissions for existing custom roles
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Expand custom roles with legacy 'menu.manage'
  FOR rec IN SELECT DISTINCT custom_role_id, business_id FROM public.role_permissions WHERE permission_key = 'menu.manage' AND custom_role_id IS NOT NULL LOOP
    INSERT INTO public.role_permissions (custom_role_id, business_id, permission_key) VALUES
      (rec.custom_role_id, rec.business_id, 'menu.items.create'),
      (rec.custom_role_id, rec.business_id, 'menu.items.edit'),
      (rec.custom_role_id, rec.business_id, 'menu.price.update'),
      (rec.custom_role_id, rec.business_id, 'menu.availability.update'),
      (rec.custom_role_id, rec.business_id, 'menu.items.delete'),
      (rec.custom_role_id, rec.business_id, 'menu.categories.manage'),
      (rec.custom_role_id, rec.business_id, 'menu.modifiers.manage')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Expand custom roles with legacy 'waiter.requests.view'
  FOR rec IN SELECT DISTINCT custom_role_id, business_id FROM public.role_permissions WHERE permission_key = 'waiter.requests.view' AND custom_role_id IS NOT NULL LOOP
    INSERT INTO public.role_permissions (custom_role_id, business_id, permission_key) VALUES
      (rec.custom_role_id, rec.business_id, 'waiter.access'),
      (rec.custom_role_id, rec.business_id, 'waiter.orders.create')
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Expand custom roles with legacy 'staff.manage'
  FOR rec IN SELECT DISTINCT custom_role_id, business_id FROM public.role_permissions WHERE permission_key = 'staff.manage' AND custom_role_id IS NOT NULL LOOP
    INSERT INTO public.role_permissions (custom_role_id, business_id, permission_key) VALUES
      (rec.custom_role_id, rec.business_id, 'staff.invite'),
      (rec.custom_role_id, rec.business_id, 'staff.edit'),
      (rec.custom_role_id, rec.business_id, 'staff.suspend'),
      (rec.custom_role_id, rec.business_id, 'staff.role.assign'),
      (rec.custom_role_id, rec.business_id, 'staff.branch.assign'),
      (rec.custom_role_id, rec.business_id, 'staff.area.assign'),
      (rec.custom_role_id, rec.business_id, 'roles.view'),
      (rec.custom_role_id, rec.business_id, 'roles.manage'),
      (rec.custom_role_id, rec.business_id, 'permissions.override.manage')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
