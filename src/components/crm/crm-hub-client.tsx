'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
    startTransition(async () => {
      try {
        await startCRMActionServerAction(businessId, actionId);
        const res = await listCRMActionsServerAction(businessId, authorizedBranchIds, actionsStatusFilter);
        setActionsList(res.actions);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  const handleSnoozeSubmit = () => {
    if (!snoozeModalActionId) return;
    const snoozedUntil = new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000).toISOString();

    startTransition(async () => {
      try {
        await snoozeCRMActionServerAction(businessId, snoozeModalActionId, snoozedUntil);
        setSnoozeModalActionId(null);
        const res = await listCRMActionsServerAction(businessId, authorizedBranchIds, actionsStatusFilter);
        setActionsList(res.actions);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  const handleCompleteAction = (actionId: string) => {
    startTransition(async () => {
      try {
        await completeCRMActionServerAction(businessId, actionId);
        const res = await listCRMActionsServerAction(businessId, authorizedBranchIds, actionsStatusFilter);
        setActionsList(res.actions);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  const handleDismissAction = (actionId: string) => {
    startTransition(async () => {
      try {
        await dismissCRMActionServerAction(businessId, actionId);
        const res = await listCRMActionsServerAction(businessId, authorizedBranchIds, actionsStatusFilter);
        setActionsList(res.actions);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Guest CRM & Retention Hub</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Unified customer profiles, deterministic RFM segmentation, and consent-safe hospitality actions.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('directory')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'directory'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Customer Directory ({totalCustomers})
          </button>

          <button
            onClick={() => setActiveTab('intelligence')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'intelligence'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Retention & Intelligence
          </button>

          <button
            onClick={() => setActiveTab('actions')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors relative ${
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
          {/* Search & Filter Bar */}
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
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">All Identity Types</option>
                <option value="REGISTERED">Registered Account</option>
                <option value="KNOWN_GUEST">Known Guest</option>
              </select>
            </div>
          </div>

          {/* Directory Table */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
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
                            onClick={() => {
                              router.push(`/dashboard/customers/${cust.customerId}`);
                            }}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
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

            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing {directoryItems.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, totalCustomers)} of {totalCustomers} guests
              </span>
              <div className="flex space-x-2">
                <button
                  disabled={page <= 1 || isPending}
                  onClick={() => handleSearch(searchQuery, selectedSegment, selectedIdentity, page - 1)}
                  className="px-3 py-1 text-xs font-medium rounded border border-slate-300 bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Previous
                </button>
                <button
                  disabled={page * pageSize >= totalCustomers || isPending}
                  onClick={() => handleSearch(searchQuery, selectedSegment, selectedIdentity, page + 1)}
                  className="px-3 py-1 text-xs font-medium rounded border border-slate-300 bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Deterministic Segment Breakdown</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Calculated using relative population quantiles and visit interval decay ratios. Currency-independent V1 rules.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-md border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">VIP</p>
                <p className="text-xl font-extrabold text-amber-900 dark:text-amber-100 mt-1">{overview.vipCount}</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">High spend + high recency/frequency</p>
              </div>

              <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">REGULAR</p>
                <p className="text-xl font-extrabold text-emerald-900 dark:text-emerald-100 mt-1">{overview.regularCount}</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">Consistent repeat visit pattern</p>
              </div>

              <div className="rounded-md border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-900/40 dark:bg-orange-950/20">
                <p className="text-xs font-bold text-orange-800 dark:text-orange-300">AT_RISK</p>
                <p className="text-xl font-extrabold text-orange-900 dark:text-orange-100 mt-1">{overview.atRiskCount}</p>
                <p className="text-[11px] text-orange-700 dark:text-orange-400 mt-1">Decaying visit interval</p>
              </div>

              <div className="rounded-md border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
                <p className="text-xs font-bold text-red-800 dark:text-red-300">LAPSED</p>
                <p className="text-xl font-extrabold text-red-900 dark:text-red-100 mt-1">{overview.lapsedCount}</p>
                <p className="text-[11px] text-red-700 dark:text-red-400 mt-1">&gt; 90 days inactive</p>
              </div>

              <div className="rounded-md border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                <p className="text-xs font-bold text-blue-800 dark:text-blue-300">NEW_GUEST</p>
                <p className="text-xl font-extrabold text-blue-900 dark:text-blue-100 mt-1">{overview.newGuestCount}</p>
                <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-1">&le; 2 orders in past 30 days</p>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">ONE_TIME</p>
                <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">{overview.oneTimeCount}</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">Single order 31–90 days ago</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Retention Risk Distribution</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Calculated from visit interval expansion ratios. Strictly non-overlapping ranges (LOW 0–29, MEDIUM 30–54, HIGH 55–74, CRITICAL 75–100).
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
            <div className="flex space-x-2">
              {(['ACTIVE', 'OPEN', 'IN_PROGRESS', 'SNOOZED', 'COMPLETED', 'DISMISSED', 'ALL'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => handleActionStatusChange(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
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
                        onClick={() => {
                          router.push(`/dashboard/customers/${action.customerId}`);
                        }}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:underline"
                      >
                        View Guest Profile &rarr;
                      </Link>
                    </div>
                  </div>

                  {canManage && action.status !== 'COMPLETED' && action.status !== 'DISMISSED' && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-end">
                      {action.status === 'OPEN' && (
                        <button
                          disabled={isPending}
                          onClick={() => handleStartAction(action.id)}
                          className="px-3 py-1 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          Start Action
                        </button>
                      )}

                      {(action.status === 'OPEN' || action.status === 'IN_PROGRESS') && (
                        <button
                          disabled={isPending}
                          onClick={() => setSnoozeModalActionId(action.id)}
                          className="px-3 py-1 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          Snooze
                        </button>
                      )}

                      <button
                        disabled={isPending}
                        onClick={() => handleCompleteAction(action.id)}
                        className="px-3 py-1 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Complete
                      </button>

                      <button
                        disabled={isPending}
                        onClick={() => handleDismissAction(action.id)}
                        className="px-3 py-1 text-xs font-medium rounded border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        Dismiss
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
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
                <option value={7}>7 Days (1 Week)</option>
                <option value={14}>14 Days (2 Weeks)</option>
                <option value={30}>30 Days (1 Month)</option>
                <option value={60}>60 Days (2 Months)</option>
              </select>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setSnoozeModalActionId(null)}
                className="px-4 py-2 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={isPending}
                onClick={handleSnoozeSubmit}
                className="px-4 py-2 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Confirm Snooze
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
