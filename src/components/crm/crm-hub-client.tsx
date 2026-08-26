'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { CustomerCRMOverviewDTO } from '@/server/crm/crm-overview.service';
import type { CustomerDirectoryItemDTO, IdentityType } from '@/lib/crm/crm-types';
import type { CRMActionStatus, RetentionOpportunityDTO } from '@/lib/crm/crm-action.types';
import {
  completeCRMActionServerAction,
  dismissCRMActionServerAction,
  listCRMActionsServerAction,
  listCustomerDirectoryServerAction,
  snoozeCRMActionServerAction,
  startCRMActionServerAction,
} from '@/server/actions/crm';

interface CRMHubClientProps {
  businessId: string;
  overview: CustomerCRMOverviewDTO;
  initialDirectory: CustomerDirectoryItemDTO[];
  initialTotalCustomers: number;
  initialActions: RetentionOpportunityDTO[];
  initialTotalActions: number;
  canManage: boolean;
  hasContactView: boolean;
  authorizedBranchIds: string[] | null;
}

export function CRMHubClient({
  businessId,
  overview,
  initialDirectory,
  initialTotalCustomers,
  initialActions,
  initialTotalActions,
  canManage,
  hasContactView,
  authorizedBranchIds,
}: CRMHubClientProps) {
  const [activeTab, setActiveTab] = useState<'directory' | 'intelligence' | 'actions'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('');
  const [selectedIdentity, setSelectedIdentity] = useState<string>('');
  const [directoryItems, setDirectoryItems] = useState<CustomerDirectoryItemDTO[]>(initialDirectory);
  const [totalCustomers, setTotalCustomers] = useState(initialTotalCustomers);
  const [page, setPage] = useState(1);

  const [actionsList, setActionsList] = useState<RetentionOpportunityDTO[]>(initialActions);
  const [actionsStatusFilter, setActionsStatusFilter] = useState<CRMActionStatus | 'ACTIVE' | 'ALL'>('ACTIVE');
  const [snoozeModalActionId, setSnoozeModalActionId] = useState<string | null>(null);
  const [snoozeDays, setSnoozeDays] = useState(7);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pageSize = 25;

  const handleSearch = (query: string, segment?: string, identity?: string, p = 1) => {
    setSearchQuery(query);
    setSelectedSegment(segment !== undefined ? segment : selectedSegment);
    setSelectedIdentity(identity !== undefined ? identity : selectedIdentity);
    setPage(p);

    startTransition(async () => {
      try {
        const res = await listCustomerDirectoryServerAction({
          businessId,
          searchQuery: query,
          identityType: (identity || undefined) as IdentityType | undefined,
          limit: pageSize,
          offset: (p - 1) * pageSize,
        });
        setDirectoryItems(res.items);
        setTotalCustomers(res.totalCount);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  const handleActionStatusChange = (statusFilter: CRMActionStatus | 'ACTIVE' | 'ALL') => {
    setActionsStatusFilter(statusFilter);
    startTransition(async () => {
      try {
        const res = await listCRMActionsServerAction(businessId, authorizedBranchIds, statusFilter);
        setActionsList(res.actions);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  const handleStartAction = (actionId: string) => {
    setActiveActionId(`start_${actionId}`);
    startTransition(async () => {
      try {
        await startCRMActionServerAction(businessId, actionId);
        const res = await listCRMActionsServerAction(businessId, authorizedBranchIds, actionsStatusFilter);
        setActionsList(res.actions);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      } finally {
        setActiveActionId(null);
      }
    });
  };

  const handleSnoozeSubmit = () => {
    if (!snoozeModalActionId) return;
    const snoozedUntil = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000).toISOString();
    setActiveActionId(`snooze_${snoozeModalActionId}`);

    startTransition(async () => {
      try {
        await snoozeCRMActionServerAction(businessId, snoozeModalActionId, snoozedUntil);
        setSnoozeModalActionId(null);
        const res = await listCRMActionsServerAction(businessId, authorizedBranchIds, actionsStatusFilter);
        setActionsList(res.actions);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      } finally {
        setActiveActionId(null);
      }
    });
  };

  const handleCompleteAction = (actionId: string) => {
    setActiveActionId(`complete_${actionId}`);
    startTransition(async () => {
      try {
        await completeCRMActionServerAction(businessId, actionId);
        const res = await listCRMActionsServerAction(businessId, authorizedBranchIds, actionsStatusFilter);
        setActionsList(res.actions);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      } finally {
        setActiveActionId(null);
      }
    });
  };

  const handleDismissAction = (actionId: string) => {
    setActiveActionId(`dismiss_${actionId}`);
    startTransition(async () => {
      try {
        await dismissCRMActionServerAction(businessId, actionId);
        const res = await listCRMActionsServerAction(businessId, authorizedBranchIds, actionsStatusFilter);
        setActionsList(res.actions);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      } finally {
        setActiveActionId(null);
      }
    });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto min-w-0 max-w-full overflow-x-hidden">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Customer Workspace</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Unified customer profiles, customer feedback reviews, reputation analytics, and retention.
          </p>
        </div>
      </div>

      {/* Workspace Quick Links */}
      <div className="flex flex-wrap gap-2 pb-2">
        <Link href="/dashboard/customers" className="min-h-[44px] inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-extrabold bg-slate-900 text-white shadow-xs">
          👥 Customer Directory
        </Link>
        <Link href="/dashboard/reviews" className="min-h-[44px] inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
          ⭐ Customer Reviews
        </Link>
        <Link href="/dashboard/reputation" className="min-h-[44px] inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
          📊 Reputation & Scores
        </Link>
        <Link href="/dashboard/loyalty" className="min-h-[44px] inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-extrabold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
          🎁 Loyalty Program
        </Link>
      </div>

      {errorMessage && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="font-bold min-h-[44px] min-w-[44px] flex items-center justify-center">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Customers</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{overview.totalCustomers}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{overview.registeredCount} registered • {overview.guestCount} guests</p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-sm">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Active VIPs</p>
          <p className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-200">{overview.vipCount}</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">High spend & visit frequency</p>
        </div>

        <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-900/40 dark:bg-orange-950/20 shadow-sm">
          <p className="text-xs font-medium text-orange-800 dark:text-orange-300">Retention At-Risk</p>
          <p className="mt-2 text-2xl font-bold text-orange-900 dark:text-orange-200">{overview.atRiskCount}</p>
          <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">Expanding visit intervals</p>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20 shadow-sm">
          <p className="text-xs font-medium text-red-800 dark:text-red-300">Lapsed Repeat Guests</p>
          <p className="mt-2 text-2xl font-bold text-red-900 dark:text-red-200">{overview.lapsedCount}</p>
          <p className="text-xs text-red-700 dark:text-red-400 mt-1">&gt; 90 days since last visit</p>
        </div>

        <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20 shadow-sm col-span-2 lg:col-span-1">
          <p className="text-xs font-medium text-indigo-800 dark:text-indigo-300">Open CRM Actions</p>
          <p className="mt-2 text-2xl font-bold text-indigo-900 dark:text-indigo-200">{overview.actionsCounts.open}</p>
          <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">{overview.actionsCounts.criticalPriority} critical priority</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800 overflow-x-auto max-w-full">
        <nav className="-mb-px flex space-x-2 sm:space-x-8 min-w-max touch-manipulation" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab('directory')}
            className={`whitespace-nowrap py-3 px-3 border-b-2 font-medium text-sm transition-colors min-h-[44px] flex items-center touch-manipulation ${
              activeTab === 'directory'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Customer Directory ({totalCustomers})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('intelligence')}
            className={`whitespace-nowrap py-3 px-3 border-b-2 font-medium text-sm transition-colors min-h-[44px] flex items-center touch-manipulation ${
              activeTab === 'intelligence'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Retention & Intelligence
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('actions')}
            className={`whitespace-nowrap py-3 px-3 border-b-2 font-medium text-sm transition-colors min-h-[44px] flex items-center touch-manipulation ${
              activeTab === 'actions'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            CRM Action Queue ({actionsList.length})
            {overview.actionsCounts.open > 0 && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                {overview.actionsCounts.open}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* TAB 1: DIRECTORY */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="w-full sm:w-96 relative">
              <input
                type="text"
                placeholder="Search guest display name or contact..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <select
                value={selectedIdentity}
                onChange={(e) => handleSearch(searchQuery, selectedSegment, e.target.value)}
                className="w-full sm:w-auto rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">All Identity Types</option>
                <option value="REGISTERED">Registered Account</option>
                <option value="KNOWN_GUEST">Known Guest</option>
              </select>
            </div>
          </div>

          {/* Directory Desktop Table & Mobile Card View */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Guest</th>
                    <th className="py-3 px-4">Identity</th>
                    <th className="py-3 px-4">Masked Contact</th>
                    <th className="py-3 px-4">Completed Orders</th>
                    <th className="py-3 px-4">Total Spend</th>
                    <th className="py-3 px-4">Last Visit</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {directoryItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                        No guest profiles match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    directoryItems.map((cust) => (
                      <tr key={cust.customerId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                          <Link href={`/dashboard/customers/${cust.customerId}`} className="hover:underline text-indigo-600 dark:text-indigo-400">
                            {cust.displayName}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            cust.identityType === 'REGISTERED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {cust.identityType === 'REGISTERED' ? 'Registered' : 'Known Guest'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                          {cust.emailMasked || cust.phoneMasked || 'No contact'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {cust.totalOrders}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {(cust.totalSpendCents / 100).toLocaleString('en-US', { style: 'currency', currency: cust.currency })}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                          {new Date(cust.lastSeenAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/dashboard/customers/${cust.customerId}`}
                            prefetch={true}
                            className="inline-flex items-center px-3 py-2 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px] touch-manipulation"
                          >
                            View Profile
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
              {directoryItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No guest profiles match the selected filter criteria.
                </div>
              ) : (
                directoryItems.map((cust) => (
                  <div key={cust.customerId} className="p-4 space-y-2 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/dashboard/customers/${cust.customerId}`}
                        prefetch={true}
                        className="font-bold text-sm text-indigo-600 dark:text-indigo-400 hover:underline min-h-[44px] flex items-center touch-manipulation"
                      >
                        {cust.displayName}
                      </Link>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        cust.identityType === 'REGISTERED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {cust.identityType === 'REGISTERED' ? 'Registered' : 'Known Guest'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <div>Contact: <span className="font-mono text-slate-900 dark:text-slate-200">{cust.emailMasked || cust.phoneMasked || 'No contact'}</span></div>
                      <div>Orders: <strong className="text-slate-900 dark:text-white">{cust.totalOrders}</strong></div>
                      <div>Spend: <strong className="text-slate-900 dark:text-white">{(cust.totalSpendCents / 100).toLocaleString('en-US', { style: 'currency', currency: cust.currency })}</strong></div>
                      <div>Last Visit: <span className="text-slate-900 dark:text-slate-200">{new Date(cust.lastSeenAt).toLocaleDateString()}</span></div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Link
                        href={`/dashboard/customers/${cust.customerId}`}
                        prefetch={true}
                        className="w-full text-center px-3 py-2.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 min-h-[44px] flex items-center justify-center touch-manipulation"
                      >
                        View Profile
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing {directoryItems.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, totalCustomers)} of {totalCustomers} guests
              </span>
              <div className="flex space-x-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={page <= 1 || isPending}
                  onClick={() => handleSearch(searchQuery, selectedSegment, selectedIdentity, page - 1)}
                  className="px-3.5 py-2 text-xs font-medium rounded border border-slate-300 bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 min-h-[44px] touch-manipulation flex items-center"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page * pageSize >= totalCustomers || isPending}
                  onClick={() => handleSearch(searchQuery, selectedSegment, selectedIdentity, page + 1)}
                  className="px-3.5 py-2 text-xs font-medium rounded border border-slate-300 bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 min-h-[44px] touch-manipulation flex items-center"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RETENTION & INTELLIGENCE */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Customer Cohort Segments</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Deterministic, rule-based audience breakdown based on visit recency, frequency, and relative monetary quantiles.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {overview.vipCount > 0 && (
                <div className="p-4 rounded-md border border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-amber-900 dark:text-amber-200">VIP GUESTS</span>
                    <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100">{overview.vipCount}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Monetary & Frequency scores $\ge$ 4. Core revenue generators.</p>
                </div>
              )}

              {overview.regularCount > 0 && (
                <div className="p-4 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">REGULAR GUESTS</span>
                    <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200">{overview.regularCount}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Steady repeat visits with consistent cadence.</p>
                </div>
              )}

              {overview.atRiskCount > 0 && (
                <div className="p-4 rounded-md border border-orange-200 bg-orange-50/40 dark:border-orange-900/40 dark:bg-orange-950/20">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-orange-900 dark:text-orange-200">AT RISK</span>
                    <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-orange-200 text-orange-900 dark:bg-orange-900 dark:text-orange-100">{overview.atRiskCount}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Previously regular guests whose visit interval expanded significantly.</p>
                </div>
              )}

              {overview.lapsedCount > 0 && (
                <div className="p-4 rounded-md border border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-red-900 dark:text-red-200">LAPSED GUESTS</span>
                    <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100">{overview.lapsedCount}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Repeat guests with no orders in over 90 days.</p>
                </div>
              )}

              {overview.newGuestCount > 0 && (
                <div className="p-4 rounded-md border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200">NEW GUESTS</span>
                    <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">{overview.newGuestCount}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">First order completed within past 30 days.</p>
                </div>
              )}

              {overview.oneTimeCount > 0 && (
                <div className="p-4 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">ONE TIME VISITORS</span>
                    <span className="px-2 py-0.5 rounded text-xs font-extrabold bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200">{overview.oneTimeCount}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Single completed order with no return visit in 31–90 days.</p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Retention Risk Distribution</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Calculated from visit interval expansion ratios. Strictly non-overlapping ranges (LOW 0–29, MEDIUM 30–54, HIGH 55–74, CRITICAL 75–100).
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
              <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">LOW RISK (0–29)</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{overview.riskCounts.low}</p>
              </div>
              <div className="p-4 rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">MEDIUM RISK (30–54)</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-1">{overview.riskCounts.medium}</p>
              </div>
              <div className="p-4 rounded-md border border-orange-200 dark:border-orange-900/40 bg-orange-50/40 dark:bg-orange-950/20">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">HIGH RISK (55–74)</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-200 mt-1">{overview.riskCounts.high}</p>
              </div>
              <div className="p-4 rounded-md border border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20">
                <p className="text-xs font-semibold text-red-700 dark:text-red-400">CRITICAL RISK (75–100)</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-200 mt-1">{overview.riskCounts.critical}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTION QUEUE */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 w-full">
              {(['ACTIVE', 'OPEN', 'IN_PROGRESS', 'SNOOZED', 'COMPLETED', 'DISMISSED', 'ALL'] as const).map((filter) => (
                <button
                  type="button"
                  key={filter}
                  onClick={() => handleActionStatusChange(filter)}
                  className={`px-3 py-2 text-xs font-medium rounded-md transition-colors min-h-[44px] touch-manipulation flex items-center justify-center ${
                    actionsStatusFilter === filter
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {actionsList.length === 0 ? (
              <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm text-slate-500 dark:text-slate-400">No CRM actions found for the selected status filter.</p>
              </div>
            ) : (
              actionsList.map((action) => (
                <div
                  key={action.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                        action.priority === 'CRITICAL'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          : action.priority === 'HIGH'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300'
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {action.priority} PRIORITY
                      </span>

                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        Status: <strong className="text-slate-800 dark:text-slate-200">{action.status}</strong>
                      </span>
                    </div>

                    <h3 className="mt-2 text-base font-bold text-slate-900 dark:text-white">{action.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{action.summary}</p>

                    <div className="mt-3 rounded-md bg-slate-50 p-3 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Recommended Next Step:</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{action.recommendedAction}</p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400 items-center justify-between">
                      <div className="flex flex-wrap gap-2 items-center">
                        <span>Reason: <code className="text-slate-700 dark:text-slate-300">{action.reasonCode}</code></span>
                        <span>•</span>
                        <span>Channel: <strong className="text-slate-700 dark:text-slate-300">{action.engagementEligibility.allowedChannels.join(', ') || 'In-App'}</strong></span>
                      </div>
                      <Link
                        href={`/dashboard/customers/${action.customerId}`}
                        prefetch={true}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline min-h-[44px] flex items-center touch-manipulation"
                      >
                        View Guest Profile &rarr;
                      </Link>
                    </div>
                  </div>

                  {canManage && action.status !== 'COMPLETED' && action.status !== 'DISMISSED' && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-end">
                      {action.status === 'OPEN' && (
                        <button
                          type="button"
                          disabled={activeActionId !== null || isPending}
                          onClick={() => handleStartAction(action.id)}
                          className="px-3.5 py-2 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 min-h-[44px] touch-manipulation flex items-center justify-center"
                        >
                          {activeActionId === `start_${action.id}` ? 'Starting...' : 'Start Action'}
                        </button>
                      )}

                      {(action.status === 'OPEN' || action.status === 'IN_PROGRESS') && (
                        <button
                          type="button"
                          disabled={activeActionId !== null || isPending}
                          onClick={() => setSnoozeModalActionId(action.id)}
                          className="px-3.5 py-2 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-50 min-h-[44px] touch-manipulation flex items-center justify-center"
                        >
                          Snooze
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={activeActionId !== null || isPending}
                        onClick={() => handleCompleteAction(action.id)}
                        className="px-3.5 py-2 text-xs font-medium rounded bg-emerald-600 text-white hover:emerald-700 disabled:opacity-50 min-h-[44px] touch-manipulation flex items-center justify-center"
                      >
                        {activeActionId === `complete_${action.id}` ? 'Completing...' : 'Complete'}
                      </button>

                      <button
                        type="button"
                        disabled={activeActionId !== null || isPending}
                        onClick={() => handleDismissAction(action.id)}
                        className="px-3.5 py-2 text-xs font-medium rounded border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50 min-h-[44px] touch-manipulation flex items-center justify-center"
                      >
                        {activeActionId === `dismiss_${action.id}` ? 'Dismissing...' : 'Dismiss'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Snooze Modal */}
      {snoozeModalActionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Snooze Action</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Select snooze duration (max 90 days).</p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Days to Snooze</label>
              <select
                value={snoozeDays}
                onChange={(e) => setSnoozeDays(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value={3}>3 Days</option>
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSnoozeModalActionId(null)}
                className="px-3.5 py-2 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 min-h-[44px] touch-manipulation flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={activeActionId !== null || isPending}
                onClick={handleSnoozeSubmit}
                className="px-3.5 py-2 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 min-h-[44px] touch-manipulation flex items-center justify-center"
              >
                {activeActionId === `snooze_${snoozeModalActionId}` ? 'Snoozing...' : 'Confirm Snooze'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
