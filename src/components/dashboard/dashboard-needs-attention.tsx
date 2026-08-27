import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardAttentionItem } from '@/server/navigation/dashboard-today-data';

interface DashboardNeedsAttentionProps {
  items: DashboardAttentionItem[];
}

export const DashboardNeedsAttention: React.FC<DashboardNeedsAttentionProps> = ({ items }) => {
  // If nothing needs action, hide the entire attention section to prevent alarm fatigue
  if (!items || items.length === 0) {
    return null;
  }

  const getSeverityStyles = (severity: DashboardAttentionItem['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          card: 'border-red-200 bg-red-50/40',
          badgeVariant: 'destructive' as const,
          badgeText: 'Action Required',
          actionBtn: 'text-red-700 bg-white border border-red-200 hover:bg-red-50',
          icon: '🚨',
        };
      case 'warning':
        return {
          card: 'border-amber-200 bg-amber-50/30',
          badgeVariant: 'warning' as const,
          badgeText: 'Needs Attention',
          actionBtn: 'text-amber-800 bg-white border border-amber-200 hover:bg-amber-50',
          icon: '⚠️',
        };
      case 'info':
      default:
        return {
          card: 'border-blue-200 bg-blue-50/30',
          badgeVariant: 'neutral' as const,
          badgeText: 'Setup',
          actionBtn: 'text-blue-700 bg-white border border-blue-200 hover:bg-blue-50',
          icon: 'ℹ️',
        };
    }
  };

  return (
    <section aria-label="Items Requiring Attention" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
            Needs Attention ({items.length})
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const styles = getSeverityStyles(item.severity);
          return (
            <Card
              key={item.id}
              className={`p-4 transition-all shadow-xs flex flex-col justify-between ${styles.card}`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm shrink-0">{styles.icon}</span>
                    <h3 className="text-xs font-bold text-zinc-950 truncate">{item.title}</h3>
                  </div>
                  <Badge variant={styles.badgeVariant} className="text-[10px] uppercase shrink-0">
                    {styles.badgeText}
                  </Badge>
                </div>
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-3 pt-2.5 border-t border-zinc-200/50 flex justify-end">
                <Link
                  href={item.href}
                  className={`inline-flex min-h-[36px] items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-colors shadow-2xs ${styles.actionBtn}`}
                >
                  {item.actionLabel}
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
