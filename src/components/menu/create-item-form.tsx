'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createMenuItemAction, createMenuCategoryAction } from '@/server/actions/menu';
import { createClient } from '@/lib/supabase/client';

interface CreateItemFormProps {
  categories: { id: string; name: string }[];
  currency: string;
  businessId: string;
  branchId: string;
}

export const CreateItemForm: React.FC<CreateItemFormProps> = ({ categories: initialCategories, currency, businessId, branchId }) => {
  const router = useRouter();
  const [categoriesList, setCategoriesList] = useState(initialCategories);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  // Quick Add Category Modal State
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    categoryId: initialCategories[0]?.id || '',
    description: '',
    price: '',
    preparationTimeMinutes: '',
    availabilityStatus: 'available' as 'available' | 'out_of_stock' | 'hidden',
    isFeatured: false,
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Invalid image format. PNG, JPG, and WEBP supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 5MB limit.');
      return;
    }

    setUploading(true);

    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const filePath = `menu-items/${businessId}/${branchId}/items/item-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        setErrorMsg(`Upload failed: ${uploadError.message}`);
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('business-assets').getPublicUrl(filePath);

      setImageUrl(publicUrl);
    } catch {
      setErrorMsg('Error uploading image.');
    } finally {
      setUploading(false);
    }
  };

  const handleQuickCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsCreatingCategory(true);
    setErrorMsg(null);

    const res = await createMenuCategoryAction({
      name: newCatName.trim(),
      description: newCatDesc.trim() || undefined,
      displayOrder: categoriesList.length,
      isActive: true,
    });

    setIsCreatingCategory(false);

    if (res.success && res.data) {
      const newCat = { id: res.data.categoryId, name: newCatName.trim() };
      setCategoriesList((prev) => [...prev, newCat]);
      setFormData((prev) => ({ ...prev, categoryId: newCat.id }));
      setSuccessMsg(`Category "${newCatName.trim()}" created and selected.`);
      setNewCatName('');
      setNewCatDesc('');
      setIsAddCategoryOpen(false);
    } else {
      setErrorMsg(res.message || 'Failed to create category.');
    }
  };

  const handleSaveItem = async (addAnother: boolean) => {
    if (isSubmittingRef.current) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const numericPrice = parseFloat(formData.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      setErrorMsg('Please enter a valid non-negative price.');
      return;
    }

    if (!formData.categoryId) {
      setErrorMsg('Please select or create a menu category first.');
      return;
    }

    if (!formData.name.trim()) {
      setErrorMsg('Please enter an item name.');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    const savedName = formData.name.trim();
    const res = await createMenuItemAction({
      name: savedName,
      categoryId: formData.categoryId,
      description: formData.description.trim() || undefined,
      price: numericPrice,
      currency,
      preparationTimeMinutes: formData.preparationTimeMinutes
        ? parseInt(formData.preparationTimeMinutes, 10)
        : null,
      availabilityStatus: formData.availabilityStatus,
      isFeatured: formData.isFeatured,
      displayOrder: 0,
      primaryImageUrl: imageUrl,
    });

    if (!res.success) {
      isSubmittingRef.current = false;
      setLoading(false);
      setErrorMsg(res.message || 'Failed to create menu item.');
      return;
    }

    if (addAnother) {
      isSubmittingRef.current = false;
      setLoading(false);
      setSuccessMsg(`✓ "${savedName}" added to menu! You can create another item below.`);
      setFormData((prev) => ({
        ...prev,
        name: '',
        description: '',
        price: '',
        preparationTimeMinutes: '',
        isFeatured: false,
      }));
      setImageUrl(null);
    } else {
      setSuccessMsg(`✓ "${savedName}" added to menu! Returning to menu items catalog...`);
      router.push('/dashboard/menu/items');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSaveItem(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-900 animate-in fade-in">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-xs font-medium text-zinc-700">
          Item Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          placeholder="e.g. Classic Truffle Burger"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="categoryId" className="block text-xs font-medium text-zinc-700">
              Category <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setIsAddCategoryOpen(true)}
              className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950"
            >
              + New Category
            </button>
          </div>
          <select
            id="categoryId"
            required
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          >
            {categoriesList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="price" className="block text-xs font-medium text-zinc-700">
            Price ({currency}) <span className="text-red-500">*</span>
          </label>
          <input
            id="price"
            type="number"
            step="0.01"
            required
            placeholder="12.50"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-xs font-medium text-zinc-700">
          Description (Optional)
        </label>
        <textarea
          id="description"
          rows={3}
          placeholder="Ingredients, dietary notes, or flavor details..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="prepTime" className="block text-xs font-medium text-zinc-700">
            Prep Time (Minutes)
          </label>
          <input
            id="prepTime"
            type="number"
            min="0"
            placeholder="e.g. 15"
            value={formData.preparationTimeMinutes}
            onChange={(e) => setFormData({ ...formData, preparationTimeMinutes: e.target.value })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="availability" className="block text-xs font-medium text-zinc-700">
            Initial Availability
          </label>
          <select
            id="availability"
            value={formData.availabilityStatus}
            onChange={(e) =>
              setFormData({
                ...formData,
                availabilityStatus: e.target.value as 'available' | 'out_of_stock' | 'hidden',
              })
            }
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          >
            <option value="available">Available</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-xs font-medium text-zinc-700">Item Image (Optional)</label>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 overflow-hidden">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] text-zinc-400">No Image</span>
            )}
          </div>
          <input
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleImageUpload}
            disabled={uploading}
            className="text-xs text-zinc-500 max-w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer"
          />
        </div>
      </div>

      <div className="flex items-start gap-2.5 pt-2">
        <input
          type="checkbox"
          id="isFeatured"
          checked={formData.isFeatured}
          onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950 cursor-pointer"
        />
        <div>
          <label htmlFor="isFeatured" className="text-xs font-semibold text-zinc-900 cursor-pointer block">
            Feature this item
          </label>
          <p className="text-[11px] text-zinc-500">
            Show this item prominently on the menu.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={() => router.push('/dashboard/menu/items')}
          disabled={loading}
          className="min-h-[44px] px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl"
        >
          Cancel
        </button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleSaveItem(true)}
          disabled={loading || uploading}
          className="min-h-[44px] px-4 py-2 font-bold text-xs border-zinc-300 text-zinc-800 hover:bg-zinc-100"
        >
          {loading ? 'Saving…' : 'Save & Add Another +'}
        </Button>
        <Button
          type="submit"
          disabled={loading || uploading}
          className="min-h-[44px] px-5 py-2 font-bold text-xs bg-zinc-950 hover:bg-zinc-800 text-white"
        >
          {loading ? 'Saving…' : 'Add Menu Item'}
        </Button>
      </div>

      {/* Quick Add Category Modal */}
      {isAddCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h3 className="text-sm font-bold text-zinc-950">Add New Menu Category</h3>
              <button
                type="button"
                onClick={() => setIsAddCategoryOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rice & Curry, Mocktails"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Brief description..."
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => setIsAddCategoryOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1 text-xs bg-zinc-950 text-white hover:bg-zinc-800"
                disabled={!newCatName.trim() || isCreatingCategory}
                onClick={handleQuickCreateCategory}
              >
                {isCreatingCategory ? 'Creating…' : 'Create Category'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};
