'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createMenuCategoryAction, archiveMenuCategoryAction } from '@/server/actions/menu';

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

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const res = await createMenuCategoryAction({
      name: name.trim(),
      description: description.trim() || undefined,
      displayOrder: categories.length,
      isActive: true,
    });

    if (!res.success) {
      setErrorMsg(res.message || 'Failed to create category.');
    } else {
      setName('');
      setDescription('');
      window.location.reload();
    }
    setLoading(false);
  };

  const handleArchive = async (categoryId: string) => {
    if (!confirm('Are you sure you want to archive this category?')) return;
    const res = await archiveMenuCategoryAction(categoryId);
    if (res.success) {
      setCategories(categories.filter((c) => c.id !== categoryId));
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Creation Form */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-zinc-950">Add New Category</h2>
        {errorMsg && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleCreateCategory} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            required
            placeholder="Category Name (e.g. Appetizers, Main Courses)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : '+ Create Category'}
          </Button>
        </form>
      </Card>

      {/* Category List */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <Card key={cat.id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-950">{cat.name}</span>
                <Badge variant={cat.is_active ? 'success' : 'neutral'}>
                  {cat.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {cat.description && (
                <p className="mt-1 text-xs text-zinc-500">{cat.description}</p>
              )}
              <p className="mt-1 text-[11px] font-mono text-zinc-400">Slug: {cat.slug}</p>
            </div>

            <Button variant="outline" size="sm" onClick={() => handleArchive(cat.id)}>
              Archive
            </Button>
          </Card>
        ))}

        {categories.length === 0 && (
          <Card className="p-8 text-center text-xs text-zinc-500">
            No menu categories created yet. Add your first category above.
          </Card>
        )}
      </div>
    </div>
  );
};
