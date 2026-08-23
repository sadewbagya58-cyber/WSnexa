import React from 'react';
import { Badge } from '@/components/ui/badge';

export type SystemStatusType =
  | 'active'
  | 'inactive'
  | 'archived'
  | 'pending'
  | 'invited'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'paid'
  | 'partially_paid'
  | 'unpaid'
  | 'draft'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'published'
  | 'unpublished'
  | 'low_stock'
  | 'out_of_stock'
  | string;

interface StatusBadgeProps {
  status: SystemStatusType;
  customLabel?: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, customLabel, className }) => {
  const normalized = (status || '').toLowerCase().trim();

  let variant: 'success' | 'warning' | 'destructive' | 'neutral' = 'neutral';
  let label = customLabel || status || 'Unknown';
  let icon: string | null = null;

  switch (normalized) {
    case 'active':
    case 'published':
    case 'completed':
    case 'paid':
    case 'approved':
    case 'ready':
      variant = 'success';
      icon = '✓';
      if (!customLabel) {
        label = normalized === 'paid' ? 'Fully Paid' : normalized.charAt(0).toUpperCase() + normalized.slice(1);
      }
      break;

    case 'pending':
    case 'invited':
    case 'accepted':
    case 'preparing':
    case 'partially_paid':
    case 'draft':
    case 'low_stock':
      variant = 'warning';
      icon = '⏳';
      if (!customLabel) {
        if (normalized === 'partially_paid') label = 'Partially Paid';
        else if (normalized === 'low_stock') label = 'Low Stock';
        else label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
      }
      break;

    case 'inactive':
    case 'archived':
    case 'cancelled':
    case 'unpaid':
    case 'rejected':
    case 'suspended':
    case 'out_of_stock':
    case 'unpublished':
      variant = 'destructive';
      icon = '✕';
      if (!customLabel) {
        if (normalized === 'out_of_stock') label = 'Out of Stock';
        else if (normalized === 'unpaid') label = 'Unpaid';
        else label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
      }
      break;

    default:
      variant = 'neutral';
      if (!customLabel) {
        label = normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }
      break;
  }

  return (
    <Badge variant={variant} className={className}>
      <span className="flex items-center gap-1">
        {icon && <span className="text-[10px] opacity-75">{icon}</span>}
        <span>{label}</span>
      </span>
    </Badge>
  );
};
