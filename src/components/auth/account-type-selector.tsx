'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingIntent } from '@/lib/validation/account';
import { selectAccountTypeAction } from '@/server/actions/account';

export function AccountTypeSelector() {
  const router = useRouter();
  const [selectedIntent, setSelectedIntent] = useState<OnboardingIntent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const options = [
    {
      id: 'business_owner' as OnboardingIntent,
      title: 'Business Owner',
      icon: '🏢',
      description: 'Manage your hospitality business, branches, menus, staff, POS, and revenue analytics.',
      badge: 'Full Access',
      requiresInvite: false,
    },
    {
      id: 'branch_manager' as OnboardingIntent,
      title: 'Branch Manager',
      icon: '🏬',
      description: 'Manage an assigned branch location, staff, kitchen orders, and branch reports.',
      badge: 'Requires Invite',
      requiresInvite: true,
    },
    {
      id: 'staff' as OnboardingIntent,
      title: 'Staff Member',
      icon: '👨‍🍳',
      description: 'Access assigned staff area (Cashier POS, Kitchen Queue, or Waiter Request Center).',
      badge: 'Requires Invite',
      requiresInvite: true,
    },
    {
      id: 'customer' as OnboardingIntent,
      title: 'Customer / Normal User',
      icon: '🍽️',
      description: 'Order food, track hospitality activity, view order history, and save favorite venues.',
      badge: 'Instant Access',
      requiresInvite: false,
    },
  ];

  const handleContinue = async () => {
    if (!selectedIntent) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await selectAccountTypeAction({ intent: selectedIntent });

    if (res.success && res.targetRoute) {
      router.push(res.targetRoute);
    } else {
      setErrorMsg(res.message || 'Failed to set account type intent.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-black text-zinc-950 uppercase tracking-wider">What best describes you?</h1>
        <p className="text-sm text-zinc-600">
          Select your intended workspace. Note: Business Owner & Staff access is verified server-side.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold text-center">
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((opt) => {
          const isSelected = selectedIntent === opt.id;
          return (
            <div
              key={opt.id}
              onClick={() => setSelectedIntent(opt.id)}
              className={`cursor-pointer p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3 relative ${
                isSelected
                  ? 'bg-zinc-900 border-zinc-950 text-white shadow-xl ring-2 ring-zinc-950'
                  : 'bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 text-zinc-900 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-3xl">{opt.icon}</span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    isSelected
                      ? 'bg-white text-zinc-950 border-white font-extrabold'
                      : opt.requiresInvite
                      ? 'bg-zinc-100 border-zinc-200 text-zinc-600'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold'
                  }`}
                >
                  {opt.badge}
                </span>
              </div>

              <div>
                <h3 className={`text-base font-extrabold ${isSelected ? 'text-white' : 'text-zinc-950'}`}>{opt.title}</h3>
                <p className={`text-xs leading-relaxed mt-1 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>{opt.description}</p>
              </div>

              {opt.requiresInvite && (
                <div className={`text-[10px] italic border-t pt-2 ${isSelected ? 'text-zinc-400 border-zinc-800' : 'text-zinc-400 border-zinc-100'}`}>
                  * Must be linked by a Business Owner before gaining dashboard access.
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={handleContinue}
        disabled={!selectedIntent || isSubmitting}
        className="w-full py-3.5 bg-zinc-950 hover:bg-zinc-800 text-white font-extrabold text-sm uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 shadow-lg active:scale-95"
      >
        {isSubmitting ? 'Saving Preference...' : 'Continue'}
      </button>
    </div>
  );
}
