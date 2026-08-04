'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createServiceAreaAction, archiveServiceAreaAction } from '@/server/actions/table';

interface ServiceAreaItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
}

interface AreaManagerProps {
  initialAreas: ServiceAreaItem[];
}

export const AreaManager: React.FC<AreaManagerProps> = ({ initialAreas }) => {
  const [areas, setAreas] = useState<ServiceAreaItem[]>(initialAreas);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    const res = await createServiceAreaAction({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      displayOrder: areas.length,
      isActive: true,
    });

    if (!res.success) {
      setErrorMsg(res.message || 'Failed to create service area.');
    } else {
      setName('');
      setCode('');
      setDescription('');
      window.location.reload();
    }
    setLoading(false);
  };

  const handleArchiveArea = async (areaId: string) => {
    if (!confirm('Are you sure you want to archive this service area? Active tables must be moved or archived first.')) return;
    const res = await archiveServiceAreaAction(areaId);
    if (res.success) {
      setAreas(areas.filter((a) => a.id !== areaId));
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Area Card */}
      <Card className="p-6">
        <h2 className="text-base font-semibold text-zinc-950">Add New Service Area</h2>
        <p className="text-xs text-zinc-500">
          Examples: Main Hall, Outdoor Terrace, VIP Section, Rooftop, Poolside Bar.
        </p>

        {errorMsg && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreateArea} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            required
            placeholder="Area Name (e.g. Main Hall)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
          <input
            type="text"
            required
            placeholder="Area Code (e.g. HALL)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full sm:w-36 rounded-md border border-zinc-300 px-3 py-2 text-sm uppercase text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Description (Optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-950 focus:outline-none"
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : '+ Create Area'}
          </Button>
        </form>
      </Card>

      {/* Areas List */}
      <div className="space-y-3">
        {areas.map((area) => (
          <Card key={area.id} className="flex items-center justify-between p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-950">{area.name}</span>
                <Badge variant="neutral">{area.code}</Badge>
                <Badge variant={area.is_active ? 'success' : 'neutral'}>
                  {area.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {area.description && (
                <p className="mt-1 text-xs text-zinc-500">{area.description}</p>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={() => handleArchiveArea(area.id)}>
              Archive
            </Button>
          </Card>
        ))}

        {areas.length === 0 && (
          <Card className="p-8 text-center text-xs text-zinc-500">
            No service areas created yet. Create your first area above.
          </Card>
        )}
      </div>
    </div>
  );
};
