'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { archiveRecipeAction } from '@/server/actions/recipe';

interface RecipeDetailActionsProps {
  recipeId: string;
  isActive: boolean;
  canManage?: boolean;
}

export function RecipeDetailActions({
  recipeId,
  isActive,
  canManage = true,
}: RecipeDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleArchive = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await archiveRecipeAction(recipeId);
      if (res.success) {
        setShowConfirm(false);
        router.refresh();
      } else {
        setErrorMsg(res.message || 'Failed to archive recipe.');
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={isActive ? 'success' : 'neutral'} className="font-bold text-xs">
        {isActive ? '● ACTIVE' : 'ARCHIVED'}
      </Badge>

      {canManage && (
        <>
          <Link
            href={`/dashboard/inventory/recipes/${recipeId}/edit`}
            className="flex min-h-[38px] items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-900 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 active:bg-zinc-100 transition-colors shadow-2xs"
          >
            ✏️ Edit Recipe
          </Link>

          {isActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowConfirm(true)}
              disabled={isPending}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              Archive
            </Button>
          )}
        </>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 space-y-4">
            <h3 className="text-base font-extrabold text-zinc-950">Archive Recipe?</h3>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Archiving this recipe will deactivate it so it is no longer used for automatic inventory deductions on future orders. Historical orders will not be affected.
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
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleArchive}
                disabled={isPending}
                className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isPending ? 'Archiving…' : 'Yes, Archive'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
