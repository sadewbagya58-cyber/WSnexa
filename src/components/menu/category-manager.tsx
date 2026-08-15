'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { createMenuCategoryAction, updateMenuCategoryAction, archiveMenuCategoryAction } from '@/server/actions/menu';

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

interface CategoryManagerProps {
  initialCategories: CategoryItem[];
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ initialCategories }) => {
  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Edit Category state
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editOrder, setEditOrder] = useState<number>(0);
  const [editActive, setEditActive] = useState(true);

  // Delete / Blocked Modal state
  const [deletingCategory, setDeletingCategory] = useState<CategoryItem | null>(null);
  const [blockedItemCount, setBlockedItemCount] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await createMenuCategoryAction({
      name: name.trim(),
      description: description.trim() || undefined,
      displayOrder: categories.length,
      isActive: true,
    });

    if (!res.success) {
      setErrorMsg(res.message || 'Failed to create category.');
    } else {
      setSuccessMsg(`Category "${name.trim()}" created successfully.`);
      setName('');
      setDescription('');
      window.location.reload();
    }
    setLoading(false);
  };

  const handleOpenEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setEditName(cat.name);
    setEditDesc(cat.description || '');
    setEditOrder(cat.display_order);
    setEditActive(cat.is_active);
    setErrorMsg(null);
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editName.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const res = await updateMenuCategoryAction({
      id: editingCategory.id,
      name: editName.trim(),
      description: editDesc.trim() || undefined,
      displayOrder: editOrder,
      isActive: editActive,
    });

    if (res.success) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategory.id
            ? {
                ...c,
                name: editName.trim(),
                description: editDesc.trim() || null,
                display_order: editOrder,
                is_active: editActive,
              }
            : c
        )
      );
      setSuccessMsg(`Category "${editName.trim()}" updated successfully.`);
      setEditingCategory(null);
    } else {
      setErrorMsg(res.message || 'Failed to update category.');
    }
    setLoading(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;

    setIsDeleting(true);
    setErrorMsg(null);

    const res = await archiveMenuCategoryAction(deletingCategory.id);

    if (res.success) {
      setCategories((prev) => prev.filter((c) => c.id !== deletingCategory.id));
      setSuccessMsg(`Category "${deletingCategory.name}" deleted successfully.`);
      setDeletingCategory(null);
      setBlockedItemCount(null);
    } else {
      if (res.data?.itemCount && res.data.itemCount > 0) {
        setBlockedItemCount(res.data.itemCount);
      } else {
        setErrorMsg(res.message || 'Failed to delete category.');
        setDeletingCategory(null);
      }
    }
    setIsDeleting(false);
  };

  return (
    <div className="space-y-6">
      {/* Feedback Messages */}
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          {successMsg}
        </div>
      )}

      {/* Category Creation Form */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-zinc-950">Add New Category</h2>
        <form onSubmit={handleCreateCategory} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            required
            placeholder="Category Name (e.g. Appetizers, Main Courses)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-950 focus:outline-hidden"
          />
          <input
            type="text"
            placeholder="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex-1 min-h-[44px] rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-950 focus:outline-hidden"
          />
          <Button type="submit" disabled={loading} className="min-h-[44px]">
            {loading ? 'Creating...' : '+ Create Category'}
          </Button>
        </form>
      </Card>

      {/* Category List */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <Card key={cat.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-950">{cat.name}</span>
                <Badge variant={cat.is_active ? 'success' : 'neutral'}>
                  {cat.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-[10px] font-mono text-zinc-400">Order: {cat.display_order}</span>
              </div>
              {cat.description && (
                <p className="text-xs text-zinc-500">{cat.description}</p>
              )}
              <p className="text-[11px] font-mono text-zinc-400">Slug: {cat.slug}</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleOpenEdit(cat)}
                className="flex-1 sm:flex-none flex min-h-[44px] items-center justify-center px-4 py-2 rounded-lg text-xs font-bold bg-zinc-100 text-zinc-900 hover:bg-zinc-200 active:bg-zinc-300 border border-zinc-200 touch-manipulation transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeletingCategory(cat);
                  setBlockedItemCount(null);
                }}
                className="flex-1 sm:flex-none flex min-h-[44px] items-center justify-center px-4 py-2 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 touch-manipulation transition-colors"
              >
                Delete
              </button>
            </div>
          </Card>
        ))}

        {categories.length === 0 && (
          <Card className="p-8 text-center text-xs text-zinc-500">
            No menu categories created yet. Add your first category above.
          </Card>
        )}
      </div>

      {/* Edit Category Modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-base font-extrabold text-zinc-950">Edit Category</h3>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="min-h-[44px] min-w-[44px] text-zinc-400 hover:text-zinc-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Optional description"
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-zinc-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  min="0"
                  value={editOrder}
                  onChange={(e) => setEditOrder(parseInt(e.target.value) || 0)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-zinc-300 text-sm focus:outline-hidden focus:border-zinc-950"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="catActive"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-zinc-950 focus:ring-0"
                />
                <label htmlFor="catActive" className="text-xs font-semibold text-zinc-900">
                  Category Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !editName.trim()}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-extrabold bg-zinc-950 text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Blocked Confirmation Modal */}
      {deletingCategory && (
        <ConfirmationModal
          isOpen={true}
          onClose={() => {
            setDeletingCategory(null);
            setBlockedItemCount(null);
          }}
          title={
            blockedItemCount !== null
              ? 'Cannot Delete Category'
              : `Delete ${deletingCategory.name}?`
          }
          description={
            blockedItemCount !== null
              ? `This category contains ${blockedItemCount} menu item${blockedItemCount > 1 ? 's' : ''}. Move or delete these items before deleting the category.`
              : 'This removes the category from active menus. Historical order records will remain intact.'
          }
          isDestructive={blockedItemCount === null}
          confirmLabel="Delete Category"
          cancelLabel={blockedItemCount !== null ? 'Close' : 'Cancel'}
          isLoading={isDeleting}
          onConfirm={blockedItemCount === null ? handleConfirmDelete : undefined}
          blockedAction={
            blockedItemCount !== null
              ? {
                  actionLabel: 'View Items',
                  actionHref: '/dashboard/menu/items',
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
