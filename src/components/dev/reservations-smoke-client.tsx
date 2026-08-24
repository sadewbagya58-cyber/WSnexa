'use client';

import React, { useState } from 'react';
import {
  createStaffReservationAction,
  createPublicReservationAction,
  getReservationByIdAction,
  listReservationsAction,
  confirmReservationAction,
  cancelReservationAction,
  markReservationArrivedAction,
  markReservationSeatedAction,
  markReservationCompletedAction,
  markReservationNoShowAction,
  getReservationStatusHistoryAction,
  updateReservationSettingsAction,
} from '@/server/actions/reservation';
import {
  PaginatedReservationsDTO,
  PublicReservationDTO,
  ReservationDTO,
  ReservationSettingsDTO,
  ReservationStatus,
  ReservationStatusEventDTO,
} from '@/lib/reservations/reservation-types';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface SmokeHarnessProps {
  businessId: string;
  branches: BranchOption[];
  authorizedBranchIds: string[] | null;
  hasContactView: boolean;
  hasManagePermission: boolean;
  initialSettings: ReservationSettingsDTO | null;
  initialReservations: PaginatedReservationsDTO;
}

const CHECKLIST_ITEMS = [
  { id: 1, label: '1. Staff reservation create' },
  { id: 2, label: '2. Public/customer reservation create' },
  { id: 3, label: '3. Branch/property scope' },
  { id: 4, label: '4. Confirmation' },
  { id: 5, label: '5. Cancel' },
  { id: 6, label: '6. Mark arrived & seated & completed' },
  { id: 7, label: '7. Mark no-show' },
  { id: 8, label: '8. Illegal status transition block' },
  { id: 9, label: '9. Contact masking / contact-view permission' },
  { id: 10, label: '10. CRM customer linkage' },
  { id: 11, label: '11. Reservation settings validation' },
  { id: 12, label: '12. Pagination / search basic behavior' },
];

export function ReservationsSmokeClient({
  businessId,
  branches,
  authorizedBranchIds,
  hasContactView,
  hasManagePermission,
  initialSettings,
  initialReservations,
}: SmokeHarnessProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branches.length > 0 ? branches[0].id : ''
  );

  // Results & Feedback
  const [activeTab, setActiveTab] = useState<
    'staff_create' | 'public_create' | 'transitions' | 'illegal' | 'masking' | 'crm' | 'settings' | 'scope' | 'query' | 'checklist'
  >('staff_create');
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);

  // Panel A State (Staff Create)
  const [staffForm, setStaffForm] = useState(() => ({
    guestName: 'Jane Doe (Staff Test)',
    guestEmail: 'jane.staff@example.com',
    guestPhone: '+1 555-0199',
    reservationStartAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 16),
    partySize: 4,
    specialRequests: 'Window table requested',
    internalNotes: 'VIP guest note',
    occasion: 'Birthday',
  }));
  const [createdStaffRes, setCreatedStaffRes] = useState<ReservationDTO | null>(null);

  // Panel B State (Public Create)
  const [publicForm, setPublicForm] = useState(() => ({
    guestName: 'Alex Smith (Public Request)',
    guestEmail: 'alex.public@example.com',
    guestPhone: '+1 555-0188',
    reservationStartAt: new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 16),
    partySize: 2,
    specialRequests: 'Quiet corner request',
    occasion: 'Anniversary',
  }));
  const [createdPublicRes, setCreatedPublicRes] = useState<PublicReservationDTO | null>(null);

  // Panel C & D State (Selected Reservation & Transitions)
  const [selectedResId, setSelectedResId] = useState<string>(
    initialReservations.items.length > 0 ? initialReservations.items[0].id : ''
  );
  const [currentResDetail, setCurrentResDetail] = useState<ReservationDTO | null>(
    initialReservations.items.length > 0 ? initialReservations.items[0] : null
  );
  const [statusHistory, setStatusHistory] = useState<ReservationStatusEventDTO[]>([]);

  // Panel G State (Settings)
  const [settings, setSettings] = useState<ReservationSettingsDTO | null>(initialSettings);
  const [validationTestOutput, setValidationTestOutput] = useState<string | null>(null);

  // Panel H State (Property Scope)
  const [scopeLookupInputId, setScopeLookupInputId] = useState<string>('');
  const [scopeLookupResult, setScopeLookupResult] = useState<string | null>(null);

  // Panel I State (Query)
  const [queryState, setQueryState] = useState({
    searchQuery: '',
    statusFilter: '' as ReservationStatus | '',
    page: 1,
    pageSize: 10,
  });
  const [queryResult, setQueryResult] = useState<PaginatedReservationsDTO>(initialReservations);

  // Panel J State (Checklist)
  const [checklistResults, setChecklistResults] = useState<Record<number, 'PASS' | 'FAIL' | 'UNTESTED'>>({
    1: 'UNTESTED',
    2: 'UNTESTED',
    3: 'UNTESTED',
    4: 'UNTESTED',
    5: 'UNTESTED',
    6: 'UNTESTED',
    7: 'UNTESTED',
    8: 'UNTESTED',
    9: 'UNTESTED',
    10: 'UNTESTED',
    11: 'UNTESTED',
    12: 'UNTESTED',
  });

  const markChecklist = (id: number, result: 'PASS' | 'FAIL') => {
    setChecklistResults((prev) => ({ ...prev, [id]: result }));
  };

  // ------------------------------------------------------------------
  // Actions Handlers
  // ------------------------------------------------------------------

  const handleCreateStaffReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setLastActionMessage(null);
    try {
      const res = await createStaffReservationAction({
        businessId,
        branchId: selectedBranchId,
        guestName: staffForm.guestName,
        guestEmail: staffForm.guestEmail || null,
        guestPhone: staffForm.guestPhone || null,
        reservationStartAt: new Date(staffForm.reservationStartAt).toISOString(),
        partySize: Number(staffForm.partySize),
        specialRequests: staffForm.specialRequests || null,
        internalNotes: staffForm.internalNotes || null,
        occasion: staffForm.occasion || null,
        source: 'STAFF',
      });
      setCreatedStaffRes(res);
      setSelectedResId(res.id);
      setCurrentResDetail(res);
      setLastActionMessage(`✅ Created staff reservation code: ${res.confirmationCode}`);
      markChecklist(1, 'PASS');
      if (res.crmCustomerId) markChecklist(10, 'PASS');
    } catch (err: unknown) {
      setLastActionMessage(`❌ Staff creation failed: ${(err as Error).message}`);
      markChecklist(1, 'FAIL');
    } finally {
      setIsPending(false);
    }
  };

  const handleCreatePublicReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setLastActionMessage(null);
    try {
      const publicRes = await createPublicReservationAction({
        branchId: selectedBranchId,
        guestName: publicForm.guestName,
        guestEmail: publicForm.guestEmail || null,
        guestPhone: publicForm.guestPhone || null,
        reservationStartAt: new Date(publicForm.reservationStartAt).toISOString(),
        partySize: Number(publicForm.partySize),
        specialRequests: publicForm.specialRequests || null,
        occasion: publicForm.occasion || null,
      });
      setCreatedPublicRes(publicRes);
      setLastActionMessage(`✅ Created public reservation code: ${publicRes.confirmationCode}`);
      markChecklist(2, 'PASS');
    } catch (err: unknown) {
      setLastActionMessage(`❌ Public creation failed: ${(err as Error).message}`);
      markChecklist(2, 'FAIL');
    } finally {
      setIsPending(false);
    }
  };

  const handleLoadReservationDetail = async (idToLoad: string) => {
    if (!idToLoad) return;
    setIsPending(true);
    try {
      const detail = await getReservationByIdAction(idToLoad);
      setCurrentResDetail(detail);
      if (detail) {
        const history = await getReservationStatusHistoryAction(detail.id);
        setStatusHistory(history);
      }
    } catch (err: unknown) {
      setLastActionMessage(`❌ Load reservation failed: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleTransition = async (
    type: 'confirm' | 'arrived' | 'seated' | 'complete' | 'cancel' | 'no_show'
  ) => {
    if (!selectedResId) {
      setLastActionMessage('❌ Select or create a reservation first');
      return;
    }
    setIsPending(true);
    setLastActionMessage(null);
    try {
      let updated: ReservationDTO;
      if (type === 'confirm') {
        updated = await confirmReservationAction(selectedResId);
        markChecklist(4, 'PASS');
      } else if (type === 'arrived') {
        updated = await markReservationArrivedAction(selectedResId);
        markChecklist(6, 'PASS');
      } else if (type === 'seated') {
        updated = await markReservationSeatedAction(selectedResId);
        markChecklist(6, 'PASS');
      } else if (type === 'complete') {
        updated = await markReservationCompletedAction(selectedResId);
        markChecklist(6, 'PASS');
      } else if (type === 'cancel') {
        updated = await cancelReservationAction({ reservationId: selectedResId, reason: 'Smoke test cancellation' });
        markChecklist(5, 'PASS');
      } else {
        updated = await markReservationNoShowAction(selectedResId);
        markChecklist(7, 'PASS');
      }
      setCurrentResDetail(updated);
      const history = await getReservationStatusHistoryAction(updated.id);
      setStatusHistory(history);
      setLastActionMessage(`✅ Status transition to '${updated.status}' succeeded`);
    } catch (err: unknown) {
      setLastActionMessage(`❌ Status transition failed: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleIllegalTransitionAttempt = async (illegalTarget: 'PENDING' | 'SEATED') => {
    if (!selectedResId || !currentResDetail) {
      setLastActionMessage('❌ Select a reservation first');
      return;
    }
    setIsPending(true);
    setLastActionMessage(null);
    try {
      if (illegalTarget === 'PENDING') {
        // Attempting invalid PENDING transition on an existing non-pending status or completed
        await confirmReservationAction(selectedResId); // Valid
        await markReservationArrivedAction(selectedResId); // Valid
        await markReservationSeatedAction(selectedResId); // Valid
        await markReservationCompletedAction(selectedResId); // Terminal
        // Now try illegal transition
        await confirmReservationAction(selectedResId);
      } else {
        // Attempt SEATED on CANCELLED
        await cancelReservationAction({ reservationId: selectedResId, reason: 'Test illegal' });
        await markReservationSeatedAction(selectedResId);
      }
      setLastActionMessage(`❌ UNEXPECTED: Illegal transition allowed!`);
      markChecklist(8, 'FAIL');
    } catch (err: unknown) {
      setLastActionMessage(`✅ SAFELY REJECTED: ${(err as Error).message}`);
      markChecklist(8, 'PASS');
    } finally {
      setIsPending(false);
    }
  };

  const handleSaveSettings = async (updates: Partial<ReservationSettingsDTO>) => {
    setIsPending(true);
    try {
      const updated = await updateReservationSettingsAction({
        branchId: selectedBranchId,
        ...updates,
      });
      setSettings(updated);
      setLastActionMessage('✅ Reservation settings updated successfully');
      markChecklist(11, 'PASS');
    } catch (err: unknown) {
      setLastActionMessage(`❌ Settings update failed: ${(err as Error).message}`);
      markChecklist(11, 'FAIL');
    } finally {
      setIsPending(false);
    }
  };

  const handleTestValidationRejection = async (testCase: 'min_party' | 'max_party' | 'past_time') => {
    setIsPending(true);
    setValidationTestOutput(null);
    try {
      if (testCase === 'min_party') {
        await createStaffReservationAction({
          businessId,
          branchId: selectedBranchId,
          guestName: 'Invalid Party Test',
          partySize: 0,
          reservationStartAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        });
      } else if (testCase === 'max_party') {
        await createStaffReservationAction({
          businessId,
          branchId: selectedBranchId,
          guestName: 'Huge Party Test',
          partySize: 500,
          reservationStartAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        });
      } else {
        await createStaffReservationAction({
          businessId,
          branchId: selectedBranchId,
          guestName: 'Past Reservation Test',
          partySize: 2,
          reservationStartAt: new Date(Date.now() - 3600 * 1000).toISOString(),
        });
      }
      setValidationTestOutput('❌ UNEXPECTED: Server accepted invalid input!');
      markChecklist(11, 'FAIL');
    } catch (err: unknown) {
      setValidationTestOutput(`✅ SAFELY REJECTED BY SERVER: ${(err as Error).message}`);
      markChecklist(11, 'PASS');
    } finally {
      setIsPending(false);
    }
  };

  const handleScopeLookup = async () => {
    if (!scopeLookupInputId) return;
    setIsPending(true);
    try {
      const res = await getReservationByIdAction(scopeLookupInputId);
      if (res) {
        setScopeLookupResult(`✅ FOUND: ${res.guestName} (${res.confirmationCode}) - Branch: ${res.branchId}`);
      } else {
        setScopeLookupResult('🔒 NEUTRAL DENIAL: Reservation not found or authorized scope reach denied');
        markChecklist(3, 'PASS');
      }
    } catch (err: unknown) {
      setScopeLookupResult(`🔒 NEUTRAL DENIAL: ${(err as Error).message}`);
      markChecklist(3, 'PASS');
    } finally {
      setIsPending(false);
    }
  };

  const handleRunQuery = async (page: number) => {
    setIsPending(true);
    try {
      const res = await listReservationsAction({
        branchId: selectedBranchId,
        status: queryState.statusFilter ? (queryState.statusFilter as ReservationStatus) : undefined,
        searchQuery: queryState.searchQuery || undefined,
        limit: queryState.pageSize,
        offset: (page - 1) * queryState.pageSize,
      });
      setQueryResult(res);
      setQueryState((prev) => ({ ...prev, page }));
      markChecklist(12, 'PASS');
    } catch (err: unknown) {
      setLastActionMessage(`❌ Query failed: ${(err as Error).message}`);
      markChecklist(12, 'FAIL');
    } finally {
      setIsPending(false);
    }
  };

  // Calculate Checklist Score
  const passCount = Object.values(checklistResults).filter((v) => v === 'PASS').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md">
              DEV / SMOKE TEST HARNESS
            </span>
            <span className="text-xs text-slate-400">Phase 35 Step 1</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 text-slate-100">Reservation Foundation Production Harness</h1>
          <p className="text-sm text-slate-400 mt-1">
            Internal manual verification surface for server actions, settings, RLS, identity linkage, & status transitions.
          </p>
        </div>

        {/* Global Branch Selector */}
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-1">
          <label className="text-xs font-medium text-slate-300">Active Test Branch</label>
          <select
            className="w-full bg-slate-900 text-white text-sm px-3 py-1.5 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Global Status Notice */}
      {lastActionMessage && (
        <div
          className={`p-4 rounded-lg border text-sm font-mono shadow ${
            lastActionMessage.startsWith('✅')
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}
        >
          {lastActionMessage}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('staff_create')}
          className={`px-3 py-2 text-sm font-semibold rounded-t-md transition ${
            activeTab === 'staff_create' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          A. Staff Create
        </button>
        <button
          onClick={() => setActiveTab('public_create')}
          className={`px-3 py-2 text-sm font-semibold rounded-t-md transition ${
            activeTab === 'public_create' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          B. Public Create
        </button>
        <button
          onClick={() => setActiveTab('transitions')}
          className={`px-3 py-2 text-sm font-semibold rounded-t-md transition ${
            activeTab === 'transitions' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          C. Transitions & History
        </button>
        <button
          onClick={() => setActiveTab('illegal')}
          className={`px-3 py-2 text-sm font-semibold rounded-t-md transition ${
            activeTab === 'illegal' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          D. Illegal Transition Test
        </button>
        <button
          onClick={() => setActiveTab('masking')}
          className={`px-3 py-2 text-sm font-semibold rounded-t-md transition ${
            activeTab === 'masking' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          E. Contact Privacy
        </button>
        <button
          onClick={() => setActiveTab('crm')}
          className={`px-3 py-2 text-sm font-semibold rounded-t-md transition ${
            activeTab === 'crm' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          F. CRM Linkage
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-2 text-sm font-semibold rounded-t-md transition ${
            activeTab === 'settings' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          G. Settings & Validation
        </button>
        <button
          onClick={() => setActiveTab('scope')}
          className={`px-3 py-2 text-sm font-semibold rounded-t-md transition ${
            activeTab === 'scope' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          H. Property Reach
        </button>
        <button
          onClick={() => setActiveTab('query')}
          className={`px-3 py-2 text-sm font-semibold rounded-t-md transition ${
            activeTab === 'query' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          I. Query & Search
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={`px-3 py-2 text-sm font-semibold rounded-t-md transition ${
            activeTab === 'checklist' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
          }`}
        >
          J. Smoke Checklist ({passCount}/12)
        </button>
      </div>

      {/* PANEL A: STAFF CREATE */}
      {activeTab === 'staff_create' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Panel A: Staff Reservation Creation</h2>
            <p className="text-sm text-slate-500">
              Executes <code className="text-amber-700">createStaffReservationAction</code> with server capability checks.
            </p>
          </div>

          <form onSubmit={handleCreateStaffReservation} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Name</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-2"
                value={staffForm.guestName}
                onChange={(e) => setStaffForm({ ...staffForm, guestName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Email</label>
              <input
                type="email"
                className="w-full text-sm border rounded px-3 py-2"
                value={staffForm.guestEmail}
                onChange={(e) => setStaffForm({ ...staffForm, guestEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Phone</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-2"
                value={staffForm.guestPhone}
                onChange={(e) => setStaffForm({ ...staffForm, guestPhone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Party Size</label>
              <input
                type="number"
                min="1"
                max="50"
                className="w-full text-sm border rounded px-3 py-2"
                value={staffForm.partySize}
                onChange={(e) => setStaffForm({ ...staffForm, partySize: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date & Time (ISO)</label>
              <input
                type="datetime-local"
                className="w-full text-sm border rounded px-3 py-2"
                value={staffForm.reservationStartAt}
                onChange={(e) => setStaffForm({ ...staffForm, reservationStartAt: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Occasion</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-2"
                value={staffForm.occasion}
                onChange={(e) => setStaffForm({ ...staffForm, occasion: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Special Requests</label>
              <textarea
                className="w-full text-sm border rounded px-3 py-2"
                rows={2}
                value={staffForm.specialRequests}
                onChange={(e) => setStaffForm({ ...staffForm, specialRequests: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Staff Notes</label>
              <textarea
                className="w-full text-sm border rounded px-3 py-2"
                rows={2}
                value={staffForm.internalNotes}
                onChange={(e) => setStaffForm({ ...staffForm, internalNotes: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isPending}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2 rounded text-sm disabled:opacity-50"
              >
                {isPending ? 'Creating Staff Reservation...' : 'Create Staff Reservation'}
              </button>
            </div>
          </form>

          {createdStaffRes && (
            <div className="bg-slate-50 border p-4 rounded-lg space-y-2 text-sm font-mono">
              <p className="font-bold text-amber-800">Returned Staff Reservation Payload:</p>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-x-auto">
                {JSON.stringify(createdStaffRes, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* PANEL B: PUBLIC CREATE */}
      {activeTab === 'public_create' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Panel B: Public/Customer Booking Simulator</h2>
            <p className="text-sm text-slate-500">
              Executes <code className="text-amber-700">createPublicReservationAction</code> using trusted branch-to-business tenancy resolution.
            </p>
          </div>

          <form onSubmit={handleCreatePublicReservation} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Name</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-2"
                value={publicForm.guestName}
                onChange={(e) => setPublicForm({ ...publicForm, guestName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Email</label>
              <input
                type="email"
                className="w-full text-sm border rounded px-3 py-2"
                value={publicForm.guestEmail}
                onChange={(e) => setPublicForm({ ...publicForm, guestEmail: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Phone</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-2"
                value={publicForm.guestPhone}
                onChange={(e) => setPublicForm({ ...publicForm, guestPhone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Party Size</label>
              <input
                type="number"
                min="1"
                max="20"
                className="w-full text-sm border rounded px-3 py-2"
                value={publicForm.partySize}
                onChange={(e) => setPublicForm({ ...publicForm, partySize: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date & Time</label>
              <input
                type="datetime-local"
                className="w-full text-sm border rounded px-3 py-2"
                value={publicForm.reservationStartAt}
                onChange={(e) => setPublicForm({ ...publicForm, reservationStartAt: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Occasion</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-2"
                value={publicForm.occasion}
                onChange={(e) => setPublicForm({ ...publicForm, occasion: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded text-sm disabled:opacity-50"
              >
                {isPending ? 'Submitting Public Reservation...' : 'Submit Public Reservation'}
              </button>
            </div>
          </form>

          {createdPublicRes && (
            <div className="bg-slate-50 border p-4 rounded-lg space-y-2 text-sm font-mono">
              <p className="font-bold text-emerald-800">Returned Sanitized Public DTO Payload:</p>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-x-auto">
                {JSON.stringify(createdPublicRes, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* PANEL C: STATUS TRANSITIONS */}
      {activeTab === 'transitions' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Panel C: Canonical Status Transitions & Event Log</h2>
            <p className="text-sm text-slate-500">
              Executes state machine status actions (<code className="text-amber-700">confirm</code>, <code className="text-amber-700">markArrived</code>, <code className="text-amber-700">markSeated</code>, <code className="text-amber-700">markCompleted</code>, <code className="text-amber-700">cancel</code>, <code className="text-amber-700">markNoShow</code>).
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg border">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Reservation ID</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-2 font-mono"
                placeholder="Paste reservation UUID or use created one"
                value={selectedResId}
                onChange={(e) => setSelectedResId(e.target.value)}
              />
            </div>
            <button
              onClick={() => handleLoadReservationDetail(selectedResId)}
              disabled={isPending || !selectedResId}
              className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded text-sm"
            >
              Load Details & History
            </button>
          </div>

          {currentResDetail && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 text-white rounded-lg flex flex-wrap justify-between items-center gap-4">
                <div>
                  <div className="text-xs text-slate-400">Current Reservation</div>
                  <div className="text-lg font-bold text-amber-400">
                    {currentResDetail.guestName} ({currentResDetail.confirmationCode})
                  </div>
                </div>
                <div>
                  <span className="px-3 py-1 text-sm font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                    Status: {currentResDetail.status}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleTransition('confirm')}
                  disabled={isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold"
                >
                  Confirm
                </button>
                <button
                  onClick={() => handleTransition('arrived')}
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-bold"
                >
                  Mark Arrived
                </button>
                <button
                  onClick={() => handleTransition('seated')}
                  disabled={isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-bold"
                >
                  Mark Seated
                </button>
                <button
                  onClick={() => handleTransition('complete')}
                  disabled={isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-xs font-bold"
                >
                  Mark Completed
                </button>
                <button
                  onClick={() => handleTransition('cancel')}
                  disabled={isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleTransition('no_show')}
                  disabled={isPending}
                  className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-bold"
                >
                  Mark No-Show
                </button>
              </div>

              {/* Status Audit History Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 border-b">
                  Append-Only Status Event History Trail
                </div>
                <table className="w-full text-xs text-left text-slate-600">
                  <thead className="bg-slate-50 border-b font-semibold text-slate-700">
                    <tr>
                      <th className="px-4 py-2">Timestamp</th>
                      <th className="px-4 py-2">From Status</th>
                      <th className="px-4 py-2">To Status</th>
                      <th className="px-4 py-2">Actor Type</th>
                      <th className="px-4 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusHistory.map((ev) => (
                      <tr key={ev.id} className="border-b hover:bg-slate-50 font-mono">
                        <td className="px-4 py-2">{new Date(ev.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-2">{ev.fromStatus || 'NULL'}</td>
                        <td className="px-4 py-2 font-bold text-amber-700">{ev.toStatus}</td>
                        <td className="px-4 py-2">{ev.actorType}</td>
                        <td className="px-4 py-2">{ev.reason || '-'}</td>
                      </tr>
                    ))}
                    {statusHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-center text-slate-400">
                          No status transition events logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANEL D: ILLEGAL TRANSITION TEST */}
      {activeTab === 'illegal' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Panel D: Illegal Transition Safety Test</h2>
            <p className="text-sm text-slate-500">
              Deliberately attempts illegal state machine transitions to verify server-side rejection without database mutation.
            </p>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm space-y-2">
            <p className="font-semibold">Target Reservation: {selectedResId || 'None Selected'}</p>
            <p className="text-xs">
              This panel will test illegal state jumps (e.g. progressing to COMPLETED then attempting to jump back to PENDING).
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleIllegalTransitionAttempt('PENDING')}
              disabled={isPending || !selectedResId}
              className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              Test Illegal Jump: COMPLETED → PENDING
            </button>
            <button
              onClick={() => handleIllegalTransitionAttempt('SEATED')}
              disabled={isPending || !selectedResId}
              className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              Test Illegal Jump: CANCELLED → SEATED
            </button>
          </div>
        </div>
      )}

      {/* PANEL E: CONTACT MASKING */}
      {activeTab === 'masking' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Panel E: Guest Contact Privacy & Masking Audit</h2>
            <p className="text-sm text-slate-500">
              Verifies default email and phone masking behavior vs unmasked view capability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 border rounded-lg space-y-2 text-sm">
              <span className="font-bold text-slate-800">Current Context Privileges:</span>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span>customers.contact_view:</span>
                <span className={hasContactView ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                  {hasContactView ? 'PRESENT (UNMASKED ALLOWED)' : 'ABSENT (DEFAULT MASKED)'}
                </span>
              </div>
            </div>

            {currentResDetail && (
              <div className="p-4 bg-slate-900 text-slate-100 rounded-lg space-y-2 text-xs font-mono">
                <p className="font-bold text-amber-400">DTO Contact Fields Returned:</p>
                <p>guestEmail (Raw): {currentResDetail.guestEmail || '[HIDDEN / NULL]'}</p>
                <p>guestPhone (Raw): {currentResDetail.guestPhone || '[HIDDEN / NULL]'}</p>
                <p>guestEmailMasked: {currentResDetail.guestEmailMasked || 'NULL'}</p>
                <p>guestPhoneMasked: {currentResDetail.guestPhoneMasked || 'NULL'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PANEL F: CRM LINKAGE */}
      {activeTab === 'crm' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Panel F: CRM Identity Resolution & Linkage</h2>
            <p className="text-sm text-slate-500">
              Inspects linked <code className="text-amber-700">crm_customer_id</code> generated via canonical <code className="text-amber-700">CustomerIdentityService</code>.
            </p>
          </div>

          {currentResDetail ? (
            <div className="p-4 bg-slate-900 text-slate-100 rounded-lg space-y-3 text-xs font-mono">
              <p className="font-bold text-amber-400">CRM Linkage Status:</p>
              <p>Reservation ID: {currentResDetail.id}</p>
              <p>Linked crm_customer_id: {currentResDetail.crmCustomerId || 'NULL (Anonymous Guest)'}</p>
              <p>Guest Snapshot Name: {currentResDetail.guestName}</p>
              <p>Created Source: {currentResDetail.createdBySource}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select or create a reservation first to inspect CRM identity linkage.</p>
          )}
        </div>
      )}

      {/* PANEL G: SETTINGS & VALIDATION */}
      {activeTab === 'settings' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Panel G: Branch Settings & Validation Rejection Testing</h2>
            <p className="text-sm text-slate-500">
              Inspects branch rules and triggers intentional validation rejections.
            </p>
          </div>

          {settings && (
            <div className="space-y-4">
              <div className="bg-slate-50 border p-4 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-500">Enabled:</span>
                  <p className="font-bold text-slate-900">{settings.reservationsEnabled ? 'TRUE' : 'FALSE'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Default Duration:</span>
                  <p className="font-bold text-slate-900">{settings.defaultDurationMinutes} min</p>
                </div>
                <div>
                  <span className="text-slate-500">Min Party Size:</span>
                  <p className="font-bold text-slate-900">{settings.minimumPartySize}</p>
                </div>
                <div>
                  <span className="text-slate-500">Max Party Size:</span>
                  <p className="font-bold text-slate-900">{settings.maximumPartySize}</p>
                </div>
                <div>
                  <span className="text-slate-500">Min Advance:</span>
                  <p className="font-bold text-slate-900">{settings.minimumAdvanceMinutes} min</p>
                </div>
                <div>
                  <span className="text-slate-500">Max Advance:</span>
                  <p className="font-bold text-slate-900">{settings.maximumAdvanceDays} days</p>
                </div>
                <div>
                  <span className="text-slate-500">Require Phone:</span>
                  <p className="font-bold text-slate-900">{settings.requireGuestPhone ? 'TRUE' : 'FALSE'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Auto Confirm:</span>
                  <p className="font-bold text-slate-900">{settings.autoConfirm ? 'TRUE' : 'FALSE'}</p>
                </div>
              </div>

              {hasManagePermission && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSaveSettings({ autoConfirm: !settings.autoConfirm })}
                    disabled={isPending}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded"
                  >
                    Toggle Auto Confirm ({settings.autoConfirm ? 'Currently ON' : 'Currently OFF'})
                  </button>
                  <button
                    onClick={() => handleSaveSettings({ reservationsEnabled: !settings.reservationsEnabled })}
                    disabled={isPending}
                    className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded"
                  >
                    Toggle Reservations Enabled ({settings.reservationsEnabled ? 'Currently ON' : 'Currently OFF'})
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800">Trigger Validation Rejection Tests:</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleTestValidationRejection('min_party')}
                disabled={isPending}
                className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold px-3 py-2 rounded"
              >
                Test: Party Size = 0 (Min Rejection)
              </button>
              <button
                onClick={() => handleTestValidationRejection('max_party')}
                disabled={isPending}
                className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold px-3 py-2 rounded"
              >
                Test: Party Size = 500 (Max Rejection)
              </button>
              <button
                onClick={() => handleTestValidationRejection('past_time')}
                disabled={isPending}
                className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold px-3 py-2 rounded"
              >
                Test: Start Time in Past (Advance Rejection)
              </button>
            </div>

            {validationTestOutput && (
              <div className="p-3 bg-slate-900 text-slate-100 rounded text-xs font-mono">
                {validationTestOutput}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PANEL H: PROPERTY SCOPE */}
      {activeTab === 'scope' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Panel H: Property Scope Reach Audit</h2>
            <p className="text-sm text-slate-500">
              Verifies neutral non-disclosure rejections for unauthorized cross-property queries.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border rounded-lg text-xs font-mono space-y-2">
            <p>User Authorized Branch IDs: {authorizedBranchIds ? JSON.stringify(authorizedBranchIds) : 'ALL (Unrestricted / Business Owner)'}</p>
            <p>Active Selected Branch ID: {selectedBranchId}</p>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              className="flex-1 text-sm border rounded px-3 py-2 font-mono"
              placeholder="Enter cross-branch reservation UUID to attempt lookup"
              value={scopeLookupInputId}
              onChange={(e) => setScopeLookupInputId(e.target.value)}
            />
            <button
              onClick={handleScopeLookup}
              disabled={isPending || !scopeLookupInputId}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded text-xs"
            >
              Test Cross-Property Lookup
            </button>
          </div>

          {scopeLookupResult && (
            <div className="p-3 bg-slate-900 text-slate-100 rounded text-xs font-mono">
              {scopeLookupResult}
            </div>
          )}
        </div>
      )}

      {/* PANEL I: QUERY & SEARCH */}
      {activeTab === 'query' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Panel I: Pagination & Filtered Search</h2>
            <p className="text-sm text-slate-500">
              Tests server-side bounded pagination, status filtering, and confirmation code search.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-lg border">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Search Guest / Code</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-1.5"
                placeholder="e.g. Jane or RSV-..."
                value={queryState.searchQuery}
                onChange={(e) => setQueryState({ ...queryState, searchQuery: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status Filter</label>
              <select
                className="text-sm border rounded px-3 py-1.5 bg-white"
                value={queryState.statusFilter}
                onChange={(e) => setQueryState({ ...queryState, statusFilter: e.target.value as ReservationStatus })}
              >
                <option value="">All Statuses</option>
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="ARRIVED">ARRIVED</option>
                <option value="SEATED">SEATED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="NO_SHOW">NO_SHOW</option>
              </select>
            </div>
            <button
              onClick={() => handleRunQuery(1)}
              disabled={isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-1.5 rounded text-sm"
            >
              Filter & Search
            </button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left text-slate-600">
              <thead className="bg-slate-100 border-b text-slate-700 font-semibold">
                <tr>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Guest Name</th>
                  <th className="px-4 py-2">Party Size</th>
                  <th className="px-4 py-2">Date & Time</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {queryResult.items.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-slate-50 font-mono">
                    <td className="px-4 py-2 font-bold text-amber-700">{r.confirmationCode}</td>
                    <td className="px-4 py-2 font-sans font-semibold">{r.guestName}</td>
                    <td className="px-4 py-2">{r.partySize}</td>
                    <td className="px-4 py-2">{new Date(r.reservationStartAt).toLocaleString()}</td>
                    <td className="px-4 py-2 font-bold">{r.status}</td>
                    <td className="px-4 py-2">{r.source}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => {
                          setSelectedResId(r.id);
                          setCurrentResDetail(r);
                          setActiveTab('transitions');
                        }}
                        className="text-amber-700 hover:underline font-sans font-bold"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
                {queryResult.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-center text-slate-400">
                      No reservations match the query filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PANEL J: SMOKE CHECKLIST */}
      {activeTab === 'checklist' && (
        <div className="bg-white border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Panel J: Step 1 Production Smoke Test Log</h2>
              <p className="text-sm text-slate-500">
                Interactive checklist for recording manual production verification results.
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-emerald-600">{passCount} / 12</span>
              <p className="text-xs text-slate-400">PASSED VERIFICATIONS</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CHECKLIST_ITEMS.map((item) => {
              const status = checklistResults[item.id];
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border flex items-center justify-between text-xs font-semibold ${
                    status === 'PASS'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : status === 'FAIL'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span>{item.label}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markChecklist(item.id, 'PASS')}
                      className={`px-2 py-1 rounded text-xs ${
                        status === 'PASS' ? 'bg-emerald-700 text-white font-bold' : 'bg-slate-200 text-slate-700 hover:bg-emerald-200'
                      }`}
                    >
                      PASS
                    </button>
                    <button
                      onClick={() => markChecklist(item.id, 'FAIL')}
                      className={`px-2 py-1 rounded text-xs ${
                        status === 'FAIL' ? 'bg-rose-700 text-white font-bold' : 'bg-slate-200 text-slate-700 hover:bg-rose-200'
                      }`}
                    >
                      FAIL
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
