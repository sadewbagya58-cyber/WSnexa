'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { grantSuperAdminAction, revokeSuperAdminAction } from '@/server/actions/super-admin';

interface SuperAdminItem {
  id: string;
  email: string;
  name: string;
  accountStatus: string;
  createdAt: string;
}

interface AdminSuperAdminsProps {
  admins: SuperAdminItem[];
  currentUserEmail: string;
}

export function AdminSuperAdminsClient({ admins: initialAdmins, currentUserEmail }: AdminSuperAdminsProps) {
  const router = useRouter();
  const [admins, setAdmins] = useState<SuperAdminItem[]>(initialAdmins);
  const [targetEmail, setTargetEmail] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ success: boolean; text: string } | null>(null);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim()) return;

    setGrantLoading(true);
    setMessage(null);

    const res = await grantSuperAdminAction(targetEmail.trim());
    setGrantLoading(false);

    if (res.success) {
      setMessage({ success: true, text: res.message });
      setTargetEmail('');
      router.refresh();
    } else {
      setMessage({ success: false, text: res.message });
    }
  };

  const handleRevoke = async (admin: SuperAdminItem) => {
    if (admins.length <= 1) {
      setMessage({ success: false, text: 'Safety rule: Cannot revoke the last platform Super Admin.' });
      return;
    }

    if (admin.email.toLowerCase() === currentUserEmail.toLowerCase()) {
      setMessage({ success: false, text: 'Safety rule: You cannot revoke your own Super Admin access.' });
      return;
    }

    setRevokingId(admin.id);
    setMessage(null);

    const res = await revokeSuperAdminAction(admin.id);
    setRevokingId(null);

    if (res.success) {
      setMessage({ success: true, text: res.message });
      setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
      router.refresh();
    } else {
      setMessage({ success: false, text: res.message });
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold ${
            message.success
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Grant Form Card */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xs space-y-4 max-w-xl">
        <h2 className="text-base font-black text-zinc-950">Grant Super Admin Privileges</h2>
        <p className="text-xs font-semibold text-zinc-500">
          Grant authoritative platform administration access to a registered user by email or User ID.
        </p>

        <form onSubmit={handleGrant} className="flex gap-2">
          <input
            type="text"
            required
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="user@wsnexa.com or UUID"
            className="flex-1 rounded-2xl border border-zinc-200 p-3 text-xs font-semibold text-zinc-950 focus:border-amber-500 focus:outline-hidden"
          />
          <Button
            type="submit"
            disabled={grantLoading}
            className="bg-amber-500 hover:bg-amber-600 text-black font-black text-xs px-6 rounded-2xl min-h-[44px]"
          >
            {grantLoading ? 'Granting...' : 'Grant Admin'}
          </Button>
        </form>
      </div>

      {/* Current Super Admins Table */}
      <div className="rounded-3xl border border-zinc-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-black text-zinc-950">Active Super Administrators ({admins.length})</h2>
            <p className="text-xs font-semibold text-zinc-500">
              Users with full authoritative platform oversight privileges.
            </p>
          </div>
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px]">
            {admins.length} Total
          </Badge>
        </div>

        <div className="divide-y divide-zinc-100">
          {admins.map((a) => {
            const isSelf = a.email.toLowerCase() === currentUserEmail.toLowerCase();
            const isSingle = admins.length <= 1;

            return (
              <div key={a.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-zinc-950 text-sm">{a.name}</span>
                    {isSelf && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[9px]">
                        YOU
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs font-mono font-bold text-zinc-600">{a.email}</div>
                  <div className="text-[10px] text-zinc-400 font-mono">ID: {a.id}</div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 font-bold text-[10px]">
                    {a.accountStatus.toUpperCase()}
                  </Badge>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isSelf || isSingle || revokingId === a.id}
                    onClick={() => handleRevoke(a)}
                    className="text-xs font-extrabold text-red-600 hover:bg-red-50 hover:border-red-200 disabled:opacity-40 min-h-[36px]"
                  >
                    {revokingId === a.id ? 'Revoking...' : 'Revoke Admin'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
