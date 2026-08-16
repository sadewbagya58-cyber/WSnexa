'use client';

import React, { useState } from 'react';
import { InventoryOverviewPayload } from '@/server/services/inventory.service';

interface InventoryHealthCardProps {
  overview: InventoryOverviewPayload;
}

export function InventoryHealthCard({ overview }: InventoryHealthCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getStatusColor = (status: InventoryOverviewPayload['healthStatus']) => {
    switch (status) {
      case 'excellent':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'good':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'fair':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'critical':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-zinc-50 text-zinc-700 border-zinc-200';
    }
  };

  const getStatusLabel = (status: InventoryOverviewPayload['healthStatus']) => {
    switch (status) {
      case 'excellent': return 'Optimal Health';
      case 'good': return 'Good Condition';
      case 'fair': return 'Needs Attention';
      case 'critical': return 'Critical Stockouts';
      default: return 'Getting Started';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Inventory Health Score</span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-3xl sm:text-4xl font-black text-zinc-950">
              {overview.healthStatus === 'insufficient_data' ? '—' : `${overview.healthScore}`}
            </span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusColor(overview.healthStatus)}`}>
              {getStatusLabel(overview.healthStatus)}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs font-bold text-zinc-600 hover:text-zinc-950 underline underline-offset-4 cursor-pointer"
        >
          {showDetails ? 'Hide Explanation' : 'How is this calculated?'}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-100 h-2 rounded-full mt-4 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 rounded-full ${
            overview.healthScore >= 90
              ? 'bg-emerald-500'
              : overview.healthScore >= 75
              ? 'bg-blue-500'
              : overview.healthScore >= 50
              ? 'bg-amber-500'
              : 'bg-rose-500'
          }`}
          style={{ width: `${overview.healthScore}%` }}
        />
      </div>

      {/* Explanation Drawer */}
      {showDetails && (
        <div className="mt-4 pt-4 border-t border-zinc-100 space-y-2 text-xs text-zinc-600 bg-zinc-50 p-3 rounded-xl">
          <p className="font-bold text-zinc-900">Health Score Breakdown:</p>
          <ul className="list-disc list-inside space-y-1">
            {overview.healthExplanation.map((exp, idx) => (
              <li key={idx}>{exp}</li>
            ))}
          </ul>
          <p className="text-[11px] text-zinc-400 mt-2">
            The health score evaluates active out-of-stock items, items below minimum par thresholds, and unresolved discrepancies.
          </p>
        </div>
      )}
    </div>
  );
}
