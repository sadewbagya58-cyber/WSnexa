'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { archiveRecipeAction, activateRecipeAction } from '@/server/actions/recipe';

interface RecipeCardActionsProps {
  recipeId: string;
  recipeName: string;
  menuItemName?: string | null;
  isActive: boolean;
  canManage?: boolean;
}

export function RecipeCardActions({
  recipeId,
  recipeName,
  menuItemName,
  isActive,
  canManage = true,
}: RecipeCardActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmMode, setConfirmMode] = useState<'archive' | 'activate' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleArchive = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await archiveRecipeAction(recipeId);
      if (res.success) {
        setConfirmMode(null);
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to archive recipe.');
      }
    });
  };

  const handleActivate = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await activateRecipeAction(recipeId);
      if (res.success) {
        setConfirmMode(null);
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to activate recipe.');
      }
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-100">
        <span
          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
            isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          {isActive ? '● ACTIVE' : 'ARCHIVED'}
        </span>

        <div className="flex items-center gap-1.5">
          <Link
            href={`/dashboard/inventory/recipes/${recipeId}`}
            className="px-2.5 py-1 text-xs font-bold text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            View BOM →
          </Link>

          {canManage && (
            <>
              <Link
                href={`/dashboard/inventory/recipes/${recipeId}/edit`}
                className="px-2 py-1 text-xs font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors"
              >
                Edit
              </Link>

              {isActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setConfirmMode('archive');
                  }}
                  disabled={isPending}
                  className="px-2 py-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  Archive
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setConfirmMode('activate');
                  }}
                  disabled={isPending}
                  className="px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                >
                  Set Active
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <h3 className="text-base font-extrabold text-zinc-950">
              {confirmMode === 'activate' ? 'Set as Active BOM?' : 'Archive Recipe BOM?'}
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              {confirmMode === 'activate' ? (
                <>
                  Activating <strong>&ldquo;{recipeName}&rdquo;</strong> will make it the primary active BOM for{' '}
                  <strong>{menuItemName ? `"${menuItemName}"` : 'this recipe'}</strong>. Any currently active recipe for this menu item will be automatically archived.
                </>
              ) : (
                <>
                  Archiving <strong>&ldquo;{recipeName}&rdquo;</strong> will deactivate it so it is no longer used for automatic inventory deductions on future orders. Historical orders will remain intact.
                </>
              )}
            </p>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmMode(null)}
                disabled={isPending}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              {confirmMode === 'activate' ? (
                <Button
                  size="sm"
                  onClick={handleActivate}
                  disabled={isPending}
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isPending ? 'Activating…' : 'Yes, Set Active'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleArchive}
                  disabled={isPending}
                  className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isPending ? 'Archiving…' : 'Yes, Archive'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
