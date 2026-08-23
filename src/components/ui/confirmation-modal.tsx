'use client';

import React from 'react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  isDestructive?: boolean;
  isLoading?: boolean;
  blockedAction?: {
    actionLabel: string;
    actionHref?: string;
    onAction?: () => void;
  };
}

export function ConfirmationModal({
  isOpen,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  isDestructive = false,
  isLoading = false,
  blockedAction,
}: ConfirmationModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 space-y-4 text-zinc-950 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${
                blockedAction
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : isDestructive
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
              }`}
            >
              {blockedAction ? '⚠️' : isDestructive ? '🗑️' : 'ℹ️'}
            </div>
            <h3 id="confirmation-modal-title" className="text-base font-extrabold tracking-tight text-zinc-950">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-zinc-400 hover:text-zinc-600 font-bold text-sm touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 rounded-lg"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <p className="text-xs text-zinc-600 leading-relaxed">{description}</p>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex min-h-[44px] items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 active:bg-zinc-300 touch-manipulation transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          {blockedAction ? (
            blockedAction.actionHref ? (
              <a
                href={blockedAction.actionHref}
                className="flex min-h-[44px] items-center justify-center px-4 py-2.5 rounded-xl text-xs font-extrabold bg-zinc-950 text-white hover:bg-zinc-800 active:bg-zinc-900 touch-manipulation transition-colors text-center"
              >
                {blockedAction.actionLabel}
              </a>
            ) : (
              <button
                type="button"
                onClick={blockedAction.onAction}
                className="flex min-h-[44px] items-center justify-center px-4 py-2.5 rounded-xl text-xs font-extrabold bg-zinc-950 text-white hover:bg-zinc-800 active:bg-zinc-900 touch-manipulation transition-colors"
              >
                {blockedAction.actionLabel}
              </button>
            )
          ) : (
            onConfirm && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex min-h-[44px] items-center justify-center px-4 py-2.5 rounded-xl text-xs font-extrabold text-white touch-manipulation transition-all disabled:opacity-50 ${
                  isDestructive
                    ? 'bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-xs'
                    : 'bg-zinc-950 hover:bg-zinc-800 active:bg-zinc-900 shadow-xs'
                }`}
              >
                {isLoading ? 'Processing...' : confirmLabel}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
