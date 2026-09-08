'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { updateMenuItemAction, archiveMenuItemAction } from '@/server/actions/menu';
import { createClient } from '@/lib/supabase/client';

export interface EditableMenuItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  preparation_time_minutes: number | null;
  availability_status: 'available' | 'out_of_stock' | 'hidden';
  is_featured: boolean;
  is_active: boolean;
  display_order: number;
  primary_image_url: string | null;
  category_id: string;
}

interface EditItemFormProps {
  item: EditableMenuItem;
  categories: { id: string; name: string }[];
  canEditPrice?: boolean;
  businessId: string;
  branchId: string;
}

export const EditItemForm: React.FC<EditItemFormProps> = ({
  item,
  categories,
  canEditPrice = true,
  businessId,
  branchId,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  // Form Fields State
  const [name, setName] = useState(item.name);
  const [categoryId, setCategoryId] = useState(item.category_id);
  const [description, setDescription] = useState(item.description || '');
  const [price, setPrice] = useState((item.price_cents / 100).toFixed(2));
  const [prepTime, setPrepTime] = useState(item.preparation_time_minutes ? String(item.preparation_time_minutes) : '');
  const [availabilityStatus, setAvailabilityStatus] = useState<'available' | 'out_of_stock' | 'hidden'>(
    item.availability_status || 'available'
  );
  const [isActive, setIsActive] = useState(item.is_active ?? true);
  const [isFeatured, setIsFeatured] = useState(item.is_featured ?? false);
  const [displayOrder, setDisplayOrder] = useState<number>(item.display_order ?? 0);

  // Image Upload State
  const [imageUrl, setImageUrl] = useState<string | null>(item.primary_image_url || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(item.primary_image_url || null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMsg('Invalid image format. PNG, JPG, and WEBP supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 5MB limit.');
      return;
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    setImageUrl(null);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    if (!name.trim()) {
      setErrorMsg('Please enter a menu item name.');
      return;
    }

    if (!categoryId) {
      setErrorMsg('Please select a valid menu category.');
      return;
    }

    const numericPrice = parseFloat(price);
    if (canEditPrice && (isNaN(numericPrice) || numericPrice < 0)) {
      setErrorMsg('Please enter a valid non-negative price.');
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    let finalImageUrl = imageUrl;

    // Upload new image file if selected
    if (imageFile) {
      setUploadingImage(true);
      try {
        const supabase = createClient();
        const fileExt = imageFile.name.split('.').pop();
        const filePath = `menu-items/${businessId}/${branchId}/items/item-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('business-assets')
          .upload(filePath, imageFile, { upsert: true });

        if (uploadError) {
          setErrorMsg(`Image upload failed: ${uploadError.message}`);
          setUploadingImage(false);
          setLoading(false);
          isSubmittingRef.current = false;
          return;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('business-assets').getPublicUrl(filePath);

        finalImageUrl = publicUrl;
        setImageUrl(publicUrl);
      } catch {
        setErrorMsg('Error uploading image to storage.');
        setUploadingImage(false);
        setLoading(false);
        isSubmittingRef.current = false;
        return;
      } finally {
        setUploadingImage(false);
      }
    } else if (!imagePreviewUrl) {
      finalImageUrl = null;
    }

    const payload = {
      id: item.id,
      name: name.trim(),
      categoryId,
      description: description.trim() || undefined,
      ...(canEditPrice ? { price: numericPrice } : {}),
      preparationTimeMinutes: prepTime.trim() ? parseInt(prepTime, 10) : undefined,
      availabilityStatus,
      isFeatured,
      isActive,
      displayOrder,
      primaryImageUrl: finalImageUrl || undefined,
    };

    const res = await updateMenuItemAction(payload);
    setLoading(false);
    isSubmittingRef.current = false;

    if (res.success) {
      setSuccessMsg(`Menu item "${name.trim()}" updated successfully.`);
      setImageFile(null);
      router.refresh();
    } else {
      setErrorMsg(res.message || 'Failed to update menu item.');
    }
  };

  const handleDeleteItem = async () => {
    setIsDeleting(true);
    setErrorMsg(null);

    const res = await archiveMenuItemAction(item.id);
    setIsDeleting(false);
    setShowDeleteModal(false);

    if (res.success) {
      router.push('/dashboard/menu/items');
    } else {
      setErrorMsg(res.message || 'Failed to delete menu item.');
    }
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

      <form onSubmit={handleSaveItem} className="space-y-6">
        {/* Item Name & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="editItemName" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              id="editItemName"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full min-h-[44px] rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-950 shadow-xs focus:border-zinc-950 focus:outline-hidden"
            />
          </div>

          <div>
            <label htmlFor="editItemCategory" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="editItemCategory"
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="mt-1 block w-full min-h-[44px] rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-950 shadow-xs focus:border-zinc-950 focus:outline-hidden"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Price & Prep Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="editItemPrice" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Price ({item.currency}) <span className="text-red-500">*</span>
            </label>
            <input
              id="editItemPrice"
              type="number"
              step="0.01"
              min="0"
              required
              disabled={!canEditPrice}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 block w-full min-h-[44px] rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-950 shadow-xs focus:border-zinc-950 focus:outline-hidden disabled:bg-zinc-100 disabled:text-zinc-500"
            />
            {!canEditPrice && (
              <span className="text-[11px] text-zinc-400 mt-1 block">
                Price edits restricted for your user role.
              </span>
            )}
          </div>

          <div>
            <label htmlFor="editItemPrep" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Prep Time (Minutes)
            </label>
            <input
              id="editItemPrep"
              type="number"
              min="0"
              placeholder="e.g. 15"
              value={prepTime}
              onChange={(e) => setPrepTime(e.target.value)}
              className="mt-1 block w-full min-h-[44px] rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-950 shadow-xs focus:border-zinc-950 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="editItemDesc" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
            Description
          </label>
          <textarea
            id="editItemDesc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ingredients, allergen details, notes..."
            className="mt-1 block w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-950 shadow-xs focus:border-zinc-950 focus:outline-hidden"
          />
        </div>

        {/* Availability Status & Active Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="editItemAvail" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Availability Status
            </label>
            <select
              id="editItemAvail"
              value={availabilityStatus}
              onChange={(e) =>
                setAvailabilityStatus(e.target.value as 'available' | 'out_of_stock' | 'hidden')
              }
              className="mt-1 block w-full min-h-[44px] rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-950 shadow-xs focus:border-zinc-950 focus:outline-hidden"
            >
              <option value="available">Available (Publicly Visible)</option>
              <option value="out_of_stock">Out of Stock (Visible, marked unavailable)</option>
              <option value="hidden">Hidden (Excluded from Public Menu)</option>
            </select>
          </div>

          <div>
            <label htmlFor="editItemOrder" className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
              Display Order
            </label>
            <input
              id="editItemOrder"
              type="number"
              min="0"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 0)}
              className="mt-1 block w-full min-h-[44px] rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-950 shadow-xs focus:border-zinc-950 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Checkbox Toggles: Active & Featured */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100/60 cursor-pointer min-h-[44px] touch-manipulation">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded mt-0.5 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-zinc-900 block">Active Status</span>
              <span className="text-[11px] text-zinc-500">Uncheck to deactivate item across all channels.</span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100/60 cursor-pointer min-h-[44px] touch-manipulation">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded mt-0.5 cursor-pointer"
            />
            <div>
              <span className="text-xs font-bold text-zinc-900 block">Featured Item ⭐</span>
              <span className="text-[11px] text-zinc-500">Highlight this item prominently in venue discovery.</span>
            </div>
          </label>
        </div>

        {/* Image Upload / Change Section */}
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-bold text-zinc-700 uppercase tracking-wider">
            Item Image
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl border border-zinc-200 bg-zinc-50">
            <div className="h-20 w-20 rounded-xl border border-zinc-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
              {imagePreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreviewUrl} alt="Item Preview" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[11px] text-zinc-400 font-semibold text-center px-1">No Image</span>
              )}
            </div>

            <div className="space-y-2 flex-1">
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={handleImageFileSelect}
                disabled={uploadingImage || loading}
                className="text-xs text-zinc-600 max-w-full file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-zinc-200 file:text-zinc-800 hover:file:bg-zinc-300 cursor-pointer"
              />
              <p className="text-[11px] text-zinc-500">
                Supported: PNG, JPG, WEBP up to 5MB. Uploading replaces the current image.
              </p>
              {imagePreviewUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="text-xs font-bold text-rose-600 hover:underline inline-block touch-manipulation min-h-[32px]"
                >
                  Remove Image
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="pt-4 border-t border-zinc-200 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              disabled={loading || isDeleting}
              className="w-full sm:w-auto flex items-center justify-center min-h-[44px] px-4 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 rounded-xl transition-colors touch-manipulation"
            >
              Delete Item
            </button>

            <Link
              href={`/dashboard/menu/items/${item.id}/modifiers`}
              className="w-full sm:w-auto flex items-center justify-center min-h-[44px] px-4 py-2 text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-50 active:bg-zinc-100 border border-zinc-200 rounded-xl transition-colors touch-manipulation text-center"
            >
              Manage Modifiers →
            </Link>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Link
              href="/dashboard/menu/items"
              className="w-full sm:w-auto flex items-center justify-center min-h-[44px] px-4 py-2 text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-50 border border-zinc-200 rounded-xl transition-colors touch-manipulation text-center"
            >
              Cancel
            </Link>

            <Button
              type="submit"
              disabled={loading || uploadingImage}
              className="w-full sm:w-auto min-h-[44px] px-6 font-black text-xs bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl shadow-xs"
            >
              {loading || uploadingImage ? 'Saving Changes…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>

      {/* Delete Item Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Menu Item"
        description={`Are you sure you want to delete "${item.name}"? This will archive the item from active menus.`}
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete Item'}
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteItem}
      />
    </div>
  );
};
