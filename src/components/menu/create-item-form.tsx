'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createMenuItemAction } from '@/server/actions/menu';
import { createClient } from '@/lib/supabase/client';

interface CreateItemFormProps {
  categories: { id: string; name: string }[];
  currency: string;
  businessId: string;
  branchId: string;
}

export const CreateItemForm: React.FC<CreateItemFormProps> = ({ categories, currency, businessId, branchId }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    categoryId: categories[0]?.id || '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericPrice = parseFloat(formData.price);
    if (isNaN(numericPrice) || numericPrice < 0) {
      setErrorMsg('Please enter a valid non-negative price.');
      return;
    }

    if (!formData.categoryId) {
      setErrorMsg('Please select or create a menu category first.');
      return;
    }

    setLoading(true);

    const res = await createMenuItemAction({
      name: formData.name.trim(),
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
      setErrorMsg(res.message || 'Failed to create menu item.');
      setLoading(false);
    } else {
      router.push('/dashboard/menu/items');
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="categoryId" className="block text-xs font-medium text-zinc-700">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            id="categoryId"
            required
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          >
            {categories.map((c) => (
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
        <div className="mt-2 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 overflow-hidden">
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
            className="text-xs text-zinc-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <input
          type="checkbox"
          id="isFeatured"
          checked={formData.isFeatured}
          onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
          className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
        />
        <label htmlFor="isFeatured" className="text-xs font-medium text-zinc-900">
          Feature this item on the menu highlight list
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="submit" disabled={loading || uploading}>
          {loading ? 'Creating Item...' : 'Save & Add Item'}
        </Button>
      </div>
    </form>
  );
};
