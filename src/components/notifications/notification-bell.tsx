'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/use-notifications';
import { Badge } from '@/components/ui/badge';
import { NotificationDTO } from '@/server/services/notification.service';

interface NotificationBellProps {
  userId: string;
  businessId: string;
}

function formatRelativeTime(dateIso: string): string {
  try {
    const now = Date.now();
    const past = new Date(dateIso).getTime();
    const diffSec = Math.floor((now - past) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
  } catch {
    return 'Recently';
  }
}

function sanitizeInternalUrl(url: string): string {
  if (!url || typeof url !== 'string') return '/dashboard';
  const trimmed = url.trim();

  // Strictly enforce internal dashboard/customer routes only
  if (trimmed.startsWith('/dashboard') || trimmed.startsWith('/customer')) {
    return trimmed;
  }
  return '/dashboard';
}



export const NotificationBell: React.FC<NotificationBellProps> = ({ userId, businessId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications(
    userId,
    businessId
  );

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = async (n: NotificationDTO) => {
    if (n.readAt === null) {
      await markAsRead(n.id);
    }
    setIsOpen(false);
    const safeUrl = sanitizeInternalUrl(n.actionUrl);
    router.push(safeUrl);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        aria-label="Staff Notifications"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl p-2 text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200 touch-manipulation active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 transition-colors"
      >
        <svg className="h-5 w-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          role="region"
          aria-label="Notifications Panel"
          className="absolute right-0 mt-2 w-80 xs:w-96 rounded-2xl border border-zinc-200 bg-white p-0 shadow-2xl z-50 overflow-hidden font-sans antialiased animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 bg-zinc-50/80">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-zinc-950">Notifications</h3>
              {unreadCount > 0 && (
                <Badge variant="neutral" className="text-[10px]">
                  {unreadCount} unread
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="text-[11px] font-bold text-zinc-600 hover:text-zinc-950 hover:underline touch-manipulation focus-visible:outline-none"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List Content */}
          <div className="max-h-96 overflow-y-auto divide-y divide-zinc-100">
            {loading ? (
              <div className="p-6 space-y-3">
                <div className="h-4 w-3/4 bg-zinc-100 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-zinc-100 rounded animate-pulse" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-1">
                <p className="text-xs font-bold text-zinc-700">All caught up!</p>
                <p className="text-[11px] text-zinc-400">No recent operational notifications.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = n.readAt === null;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleNotificationClick(n)}
                    className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors touch-manipulation focus-visible:outline-none ${
                      isUnread ? 'bg-amber-50/40 hover:bg-amber-50/80' : 'hover:bg-zinc-50'
                    }`}
                  >
                    {/* Priority / Unread Dot */}
                    <div className="pt-0.5 shrink-0 flex items-center gap-1.5">
                      {isUnread ? (
                        <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" title="Unread" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-transparent shrink-0" />
                      )}
                    </div>

                    {/* Notification Body */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-zinc-900 truncate">
                          {n.title}
                        </span>
                        <span className="text-[10px] font-medium text-zinc-400 shrink-0">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      {n.branchName && (
                        <div className="pt-0.5">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-100 text-zinc-600">
                            🏢 {n.branchName}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
