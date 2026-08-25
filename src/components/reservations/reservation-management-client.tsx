'use client';

import React, { useState } from 'react';
import {
  confirmReservationAction,
  cancelReservationAction,
  markReservationArrivedAction,
  markReservationSeatedAction,
  markReservationCompletedAction,
  markReservationNoShowAction,
  updateReservationSettingsAction,
  getReservationSettingsAction,
} from '@/server/actions/reservation';
import {
  getAvailableTablesAction,
  autoAllocateReservationTablesAction,
  manuallyAssignTablesAction,
  releaseReservationTablesAction,
  createWalkInSeatingAction,
  addWaitlistEntryAction,
  promoteWaitlistEntryAction,
} from '@/server/actions/reservation-allocation';
import {
  DiningTableDTO,
  ReservationTableAssignmentDTO,
  TableAvailabilityResultDTO,
  WaitlistEntryDTO,
} from '@/lib/reservations/table-allocation-types';
import {
  PaginatedReservationsDTO,
  ReservationDTO,
  ReservationSettingsDTO,
} from '@/lib/reservations/reservation-types';

interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface ReservationManagementClientProps {
  businessId: string;
  branches: BranchOption[];
  hasManagePermission: boolean;
  hasAssignPermission: boolean;
  hasWaitlistPermission: boolean;
  hasContactView: boolean;
  initialReservations: PaginatedReservationsDTO;
  initialWaitlist: WaitlistEntryDTO[];
}

export function ReservationManagementClient({
  businessId,
  branches,
  hasManagePermission,
  hasAssignPermission,
  hasWaitlistPermission,
  hasContactView,
  initialReservations,
  initialWaitlist,
}: ReservationManagementClientProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branches.length > 0 ? branches[0].id : ''
  );
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'waitlist' | 'settings'>('today');
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [branchSettings, setBranchSettings] = useState<ReservationSettingsDTO | null>(null);

  // Data states
  const [reservations, setReservations] = useState<PaginatedReservationsDTO>(initialReservations);
  const [waitlist, setWaitlist] = useState<WaitlistEntryDTO[]>(initialWaitlist);
  const [activeAssignmentsMap, setActiveAssignmentsMap] = useState<Record<string, ReservationTableAssignmentDTO[]>>({});

  // Assignment Modal State
  const [assignmentModalRes, setAssignmentModalRes] = useState<ReservationDTO | null>(null);
  const [availabilityResult, setAvailabilityResult] = useState<TableAvailabilityResultDTO | null>(null);
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);

  // Walk-In Modal State
  const [showWalkInModal, setShowWalkInModal] = useState<boolean>(false);
  const [walkInForm, setWalkInForm] = useState({
    guestName: 'Walk-In Guest',
    partySize: 2,
    guestPhone: '',
    specialRequests: '',
  });

  // Waitlist Modal State
  const [showWaitlistModal, setShowWaitlistModal] = useState<boolean>(false);
  const [waitlistForm, setWaitlistForm] = useState({
    guestName: '',
    partySize: 2,
    guestPhone: '',
    notes: '',
  });

  // ------------------------------------------------------------------
  // Actions & Handlers
  // ------------------------------------------------------------------

  const handleOpenAssignModal = async (res: ReservationDTO) => {
    setAssignmentModalRes(res);
    setSelectedTableIds([]);
    setIsPending(true);
    try {
      const availRes = await getAvailableTablesAction({
        branchId: res.branchId,
        reservationStartAt: res.reservationStartAt,
        reservationEndAt: res.reservationEndAt,
        partySize: res.partySize,
        excludedReservationId: res.id,
      });

      if (availRes.ok) {
        setAvailabilityResult(availRes.data);
        if (availRes.data.recommendedSingleTable) {
          setSelectedTableIds([availRes.data.recommendedSingleTable.id]);
        } else if (availRes.data.recommendedCombination) {
          setSelectedTableIds(availRes.data.recommendedCombination.tables.map((t) => t.id));
        }
      } else {
        setLastMessage(`❌ Failed to check availability: ${availRes.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleConfirmAssignment = async () => {
    if (!assignmentModalRes || selectedTableIds.length === 0) return;
    setIsPending(true);
    try {
      const res = await manuallyAssignTablesAction({
        reservationId: assignmentModalRes.id,
        tableIds: selectedTableIds,
      });

      if (res.ok) {
        setActiveAssignmentsMap((prev) => ({
          ...prev,
          [assignmentModalRes.id]: res.data,
        }));
        setLastMessage(`✅ Assigned ${res.data.length} table(s) to ${assignmentModalRes.guestName}`);
        setAssignmentModalRes(null);
      } else {
        setLastMessage(`✅ SAFELY REJECTED: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleAutoAssign = async (res: ReservationDTO) => {
    setIsPending(true);
    try {
      const result = await autoAllocateReservationTablesAction(res.id);
      if (result.ok) {
        setActiveAssignmentsMap((prev) => ({
          ...prev,
          [res.id]: result.data,
        }));
        setLastMessage(`✅ Auto-allocated ${result.data.length} table(s)`);
      } else {
        setLastMessage(`✅ SAFELY REJECTED: ${result.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Auto-allocate error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleRelease = async (resId: string) => {
    setIsPending(true);
    try {
      const result = await releaseReservationTablesAction(resId);
      if (result.ok) {
        setActiveAssignmentsMap((prev) => ({ ...prev, [resId]: [] }));
        setLastMessage('✅ Table assignments released');
      } else {
        setLastMessage(`❌ Release error: ${result.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Release error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleStatusTransition = async (
    resId: string,
    action: 'confirm' | 'arrived' | 'seated' | 'complete' | 'cancel' | 'no_show'
  ) => {
    setIsPending(true);
    setLastMessage(null);
    try {
      let result;
      if (action === 'confirm') result = await confirmReservationAction(resId);
      else if (action === 'arrived') result = await markReservationArrivedAction(resId);
      else if (action === 'seated') result = await markReservationSeatedAction(resId);
      else if (action === 'complete') result = await markReservationCompletedAction(resId);
      else if (action === 'cancel') result = await cancelReservationAction({ reservationId: resId, reason: 'Staff cancelled' });
      else result = await markReservationNoShowAction(resId);

      if (result.ok) {
        setReservations((prev) => ({
          ...prev,
          items: prev.items.map((r) => (r.id === resId ? result.data : r)),
        }));
        setLastMessage(`✅ Status updated to '${result.data.status}'`);
      } else {
        setLastMessage(`✅ SAFELY REJECTED: ${result.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const res = await createWalkInSeatingAction({
        businessId,
        branchId: selectedBranchId,
        guestName: walkInForm.guestName,
        guestPhone: walkInForm.guestPhone || null,
        partySize: Number(walkInForm.partySize),
        specialRequests: walkInForm.specialRequests || null,
      });

      if (res.ok) {
        setReservations((prev) => ({
          ...prev,
          items: [res.data.reservation, ...prev.items],
        }));
        setActiveAssignmentsMap((prev) => ({
          ...prev,
          [res.data.reservation.id]: res.data.assignments,
        }));
        setShowWalkInModal(false);
        setLastMessage(`✅ Walk-in guest ${res.data.reservation.guestName} seated successfully!`);
      } else {
        setLastMessage(`✅ SAFELY REJECTED: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Walk-in error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleAddWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const res = await addWaitlistEntryAction({
        businessId,
        branchId: selectedBranchId,
        guestName: waitlistForm.guestName,
        guestPhone: waitlistForm.guestPhone || null,
        partySize: Number(waitlistForm.partySize),
        requestedStartAt: new Date().toISOString(),
        notes: waitlistForm.notes || null,
      });

      if (res.ok) {
        setWaitlist((prev) => [...prev, res.data]);
        setShowWaitlistModal(false);
        setLastMessage(`✅ Added ${res.data.guestName} to waitlist`);
      } else {
        setLastMessage(`✅ SAFELY REJECTED: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Waitlist error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handlePromoteWaitlist = async (entry: WaitlistEntryDTO) => {
    setIsPending(true);
    try {
      const res = await promoteWaitlistEntryAction({
        waitlistEntryId: entry.id,
      });

      if (res.ok) {
        setWaitlist((prev) =>
          prev.map((w) => (w.id === entry.id ? res.data.waitlistEntry : w))
        );
        setReservations((prev) => ({
          ...prev,
          items: [res.data.reservation, ...prev.items],
        }));
        if (res.data.assignments && res.data.assignments.length > 0) {
          setActiveAssignmentsMap((prev) => ({
            ...prev,
            [res.data.reservation.id]: res.data.assignments,
          }));
        }
        const count = res.data.assignments?.length || 0;
        const tablesText = count === 1
          ? `and seated at ${res.data.assignments[0].tableName || `Table ${res.data.assignments[0].tableNumber}`}`
          : `and seated using ${count} tables`;
        setLastMessage(`✅ Promoted waitlist guest ${entry.guestName} ${tablesText}!`);
      } else {
        setLastMessage(`✅ SAFELY REJECTED: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Promotion error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
            PHASE 35 STEP 2
          </span>
          <h1 className="text-2xl font-bold mt-1">Reservations & Table Allocation</h1>
          <p className="text-sm text-slate-400">
            Real-time dining table assignment, walk-in seating, & waitlist management.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700">
            <label className="block text-xs text-slate-300 mb-1">Branch</label>
            <select
              className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded border border-slate-600 focus:outline-none"
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

          {hasManagePermission && (
            <button
              onClick={() => setShowWalkInModal(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow min-h-[44px]"
            >
              + Walk-In Seating
            </button>
          )}

          {hasWaitlistPermission && (
            <button
              onClick={() => setShowWaitlistModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow min-h-[44px]"
            >
              + Add to Waitlist
            </button>
          )}
        </div>
      </div>

      {/* Global Status Message */}
      {lastMessage && (
        <div
          className={`p-4 rounded-lg text-sm font-mono border ${
            lastMessage.startsWith('✅')
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
              : 'bg-rose-950/60 text-rose-300 border-rose-800'
          }`}
        >
          {lastMessage}
        </div>
      )}

      {/* View Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('today')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            activeTab === 'today' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Today Reservations
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            activeTab === 'upcoming' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          All Reservations ({reservations.items.length})
        </button>
        <button
          onClick={() => setActiveTab('waitlist')}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
            activeTab === 'waitlist' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          Waitlist Queue ({waitlist.filter((w) => w.status === 'WAITING').length})
        </button>
        {hasManagePermission && (
          <button
            onClick={async () => {
              setActiveTab('settings');
              if (selectedBranchId) {
                setIsPending(true);
                const res = await getReservationSettingsAction(selectedBranchId);
                setIsPending(false);
                if (res.ok) {
                  setBranchSettings(res.data);
                }
              }
            }}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition ${
              activeTab === 'settings' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            ⚙️ Branch Settings
          </button>
        )}
      </div>

      {/* RESERVATIONS CARDS LIST */}
      {(activeTab === 'today' || activeTab === 'upcoming') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reservations.items.map((r) => {
            const assignments = activeAssignmentsMap[r.id] || [];
            return (
              <div key={r.id} className="bg-white border rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-mono font-bold text-amber-700">{r.confirmationCode}</span>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">{r.guestName}</h3>
                    </div>
                    <span className="px-2.5 py-1 text-xs font-extrabold rounded bg-slate-100 text-slate-800 border">
                      {r.status}
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-slate-600 space-y-1 font-mono">
                    <p>Party Size: <strong className="text-slate-900">{r.partySize} guests</strong></p>
                    <p>Time: {new Date(r.reservationStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p>Source: {r.source}</p>
                    {hasContactView && r.guestPhone && <p>Phone: {r.guestPhone}</p>}
                    {!hasContactView && r.guestPhoneMasked && <p>Phone: {r.guestPhoneMasked}</p>}
                  </div>

                  {/* Table Assignment Display */}
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-xs font-semibold text-slate-500 block mb-1">Table Assignment:</span>
                    {assignments.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {assignments.map((a) => (
                          <span key={a.id} className="px-2 py-1 text-xs font-bold bg-amber-100 text-amber-900 rounded border border-amber-300">
                            {a.tableName || `Table ${a.tableNumber}`} ({a.assignmentType})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs italic text-slate-400 block">No table assigned</span>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {hasAssignPermission && (
                      <>
                        <button
                          onClick={() => handleOpenAssignModal(r)}
                          disabled={isPending || r.status === 'COMPLETED' || r.status === 'CANCELLED'}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold disabled:opacity-40 min-h-[36px]"
                        >
                          {assignments.length > 0 ? 'Reassign' : 'Assign Table'}
                        </button>
                        {assignments.length === 0 && (
                          <button
                            onClick={() => handleAutoAssign(r)}
                            disabled={isPending || r.status === 'COMPLETED' || r.status === 'CANCELLED'}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold disabled:opacity-40 min-h-[36px]"
                          >
                            Auto Fit
                          </button>
                        )}
                        {assignments.length > 0 && (
                          <button
                            onClick={() => handleRelease(r.id)}
                            disabled={isPending}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-semibold disabled:opacity-40 min-h-[36px]"
                          >
                            Release
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {r.status === 'PENDING' && (
                      <button
                        onClick={() => handleStatusTransition(r.id, 'confirm')}
                        disabled={isPending}
                        className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-bold disabled:opacity-40"
                      >
                        Confirm
                      </button>
                    )}
                    {r.status === 'CONFIRMED' && (
                      <button
                        onClick={() => handleStatusTransition(r.id, 'arrived')}
                        disabled={isPending}
                        className="px-2.5 py-1 bg-indigo-600 text-white rounded text-xs font-bold disabled:opacity-40"
                      >
                        Arrived
                      </button>
                    )}
                    {r.status === 'ARRIVED' && (
                      <button
                        onClick={() => handleStatusTransition(r.id, 'seated')}
                        disabled={isPending}
                        className="px-2.5 py-1 bg-purple-600 text-white rounded text-xs font-bold disabled:opacity-40"
                      >
                        Seat
                      </button>
                    )}
                    {r.status === 'SEATED' && (
                      <button
                        onClick={() => handleStatusTransition(r.id, 'complete')}
                        disabled={isPending}
                        className="px-2.5 py-1 bg-emerald-600 text-white rounded text-xs font-bold disabled:opacity-40"
                      >
                        Complete
                      </button>
                    )}
                    {['PENDING', 'CONFIRMED', 'ARRIVED'].includes(r.status) && (
                      <button
                        onClick={() => handleStatusTransition(r.id, 'cancel')}
                        disabled={isPending}
                        className="px-2.5 py-1 bg-rose-600 text-white rounded text-xs font-bold disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {reservations.items.length === 0 && (
            <div className="col-span-full bg-white p-8 rounded-xl text-center text-slate-500 border">
              No reservations found.
            </div>
          )}
        </div>
      )}

      {/* WAITLIST QUEUE */}
      {activeTab === 'waitlist' && (
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-100 font-bold border-b">
              <tr>
                <th className="p-3">Priority</th>
                <th className="p-3">Guest Name</th>
                <th className="p-3">Party Size</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {waitlist.map((w) => (
                <tr key={w.id} className="border-b hover:bg-slate-50 font-mono">
                  <td className="p-3 font-bold text-amber-700">#{w.priority}</td>
                  <td className="p-3 font-sans font-bold">{w.guestName}</td>
                  <td className="p-3 font-bold">{w.partySize} guests</td>
                  <td className="p-3">{w.guestPhoneMasked || w.guestPhone || '-'}</td>
                  <td className="p-3 font-bold">{w.status}</td>
                  <td className="p-3">{new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-3 font-sans">
                    {w.status === 'WAITING' && hasWaitlistPermission && (
                      <button
                        onClick={() => handlePromoteWaitlist(w)}
                        disabled={isPending}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold disabled:opacity-40 min-h-[36px]"
                      >
                        Promote & Seat
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {waitlist.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    Waitlist queue is empty.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* BRANCH SETTINGS PANEL */}
      {activeTab === 'settings' && branchSettings && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Branch Reservation Settings</h2>
              <p className="text-xs text-slate-500">
                Configure operational booking limits, turn buffer, party size bounds, and public rules.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setIsPending(true);
                const res = await updateReservationSettingsAction({
                  branchId: selectedBranchId,
                  reservationsEnabled: branchSettings.reservationsEnabled,
                  defaultDurationMinutes: branchSettings.defaultDurationMinutes,
                  minimumPartySize: branchSettings.minimumPartySize,
                  maximumPartySize: branchSettings.maximumPartySize,
                  minimumAdvanceMinutes: branchSettings.minimumAdvanceMinutes,
                  maximumAdvanceDays: branchSettings.maximumAdvanceDays,
                  allowSameDay: branchSettings.allowSameDay,
                  requireGuestPhone: branchSettings.requireGuestPhone,
                  requireGuestEmail: branchSettings.requireGuestEmail,
                  autoConfirm: branchSettings.autoConfirm,
                  tableTurnoverBufferMinutes: branchSettings.tableTurnoverBufferMinutes,
                  maxTableCombination: branchSettings.maxTableCombination,
                });
                setIsPending(false);
                if (res.ok) {
                  setBranchSettings(res.data);
                  setLastMessage('✅ Branch reservation settings updated successfully');
                } else {
                  setLastMessage(`❌ Failed to update settings: ${res.error.message}`);
                }
              }}
              disabled={isPending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow disabled:opacity-40 min-h-[44px]"
            >
              Save Settings
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs text-slate-700">
            {/* Reservations Enabled */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input
                id="reservationsEnabled"
                type="checkbox"
                checked={branchSettings.reservationsEnabled}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) => (prev ? { ...prev, reservationsEnabled: e.target.checked } : prev))
                }
                className="w-4 h-4 text-amber-600 rounded"
              />
              <label htmlFor="reservationsEnabled" className="font-bold text-slate-900 cursor-pointer">
                Enable Public Reservations
              </label>
            </div>

            {/* Auto Confirm */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input
                id="autoConfirm"
                type="checkbox"
                checked={branchSettings.autoConfirm}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) => (prev ? { ...prev, autoConfirm: e.target.checked } : prev))
                }
                className="w-4 h-4 text-amber-600 rounded"
              />
              <label htmlFor="autoConfirm" className="font-bold text-slate-900 cursor-pointer">
                Auto Confirm Bookings
              </label>
            </div>

            {/* Allow Same Day */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input
                id="allowSameDay"
                type="checkbox"
                checked={branchSettings.allowSameDay}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) => (prev ? { ...prev, allowSameDay: e.target.checked } : prev))
                }
                className="w-4 h-4 text-amber-600 rounded"
              />
              <label htmlFor="allowSameDay" className="font-bold text-slate-900 cursor-pointer">
                Allow Same-Day Bookings
              </label>
            </div>

            {/* Require Phone */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input
                id="requireGuestPhone"
                type="checkbox"
                checked={branchSettings.requireGuestPhone}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) => (prev ? { ...prev, requireGuestPhone: e.target.checked } : prev))
                }
                className="w-4 h-4 text-amber-600 rounded"
              />
              <label htmlFor="requireGuestPhone" className="font-bold text-slate-900 cursor-pointer">
                Require Guest Phone Number
              </label>
            </div>

            {/* Require Email */}
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input
                id="requireGuestEmail"
                type="checkbox"
                checked={branchSettings.requireGuestEmail}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) => (prev ? { ...prev, requireGuestEmail: e.target.checked } : prev))
                }
                className="w-4 h-4 text-amber-600 rounded"
              />
              <label htmlFor="requireGuestEmail" className="font-bold text-slate-900 cursor-pointer">
                Require Guest Email Address
              </label>
            </div>

            {/* Default Duration */}
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
                Default Duration (Minutes)
              </label>
              <input
                type="number"
                min={15}
                max={480}
                value={branchSettings.defaultDurationMinutes}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) =>
                    prev ? { ...prev, defaultDurationMinutes: parseInt(e.target.value, 10) || 90 } : prev
                  )
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-xs font-bold"
              />
            </div>

            {/* Minimum Party Size */}
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
                Minimum Party Size
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={branchSettings.minimumPartySize}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) =>
                    prev ? { ...prev, minimumPartySize: parseInt(e.target.value, 10) || 1 } : prev
                  )
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-xs font-bold"
              />
            </div>

            {/* Maximum Party Size */}
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
                Maximum Party Size
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={branchSettings.maximumPartySize}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) =>
                    prev ? { ...prev, maximumPartySize: parseInt(e.target.value, 10) || 20 } : prev
                  )
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-xs font-bold"
              />
            </div>

            {/* Minimum Advance Minutes */}
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
                Minimum Advance Booking (Minutes)
              </label>
              <input
                type="number"
                min={0}
                max={10080}
                value={branchSettings.minimumAdvanceMinutes}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) =>
                    prev ? { ...prev, minimumAdvanceMinutes: parseInt(e.target.value, 10) || 0 } : prev
                  )
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-xs font-bold"
              />
            </div>

            {/* Maximum Advance Days */}
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
                Maximum Advance Booking (Days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={branchSettings.maximumAdvanceDays}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) =>
                    prev ? { ...prev, maximumAdvanceDays: parseInt(e.target.value, 10) || 90 } : prev
                  )
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-xs font-bold"
              />
            </div>

            {/* Turnover Buffer */}
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
                Table Turnover Buffer (Minutes)
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={branchSettings.tableTurnoverBufferMinutes || 15}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) =>
                    prev ? { ...prev, tableTurnoverBufferMinutes: parseInt(e.target.value, 10) || 15 } : prev
                  )
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-xs font-bold"
              />
            </div>

            {/* Max Table Combination */}
            <div className="space-y-1">
              <label className="font-bold text-slate-900 block uppercase tracking-wider text-[10px]">
                Max Table Combination Count
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={branchSettings.maxTableCombination || 3}
                onChange={(e) =>
                  setBranchSettings((prev: ReservationSettingsDTO | null) =>
                    prev ? { ...prev, maxTableCombination: parseInt(e.target.value, 10) || 3 } : prev
                  )
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-xs font-bold"
              />
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNMENT MODAL */}
      {assignmentModalRes && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Table Assignment</h3>
                <p className="text-xs text-slate-500">
                  {assignmentModalRes.guestName} (Party of {assignmentModalRes.partySize})
                </p>
              </div>
              <button
                onClick={() => setAssignmentModalRes(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {availabilityResult && (
              <div className="space-y-4">
                <div className="text-xs font-semibold text-slate-700">Available Tables:</div>
                <div className="grid grid-cols-2 gap-2">
                  {availabilityResult.availableTables.map((t: DiningTableDTO) => {
                    const isSelected = selectedTableIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTableIds(selectedTableIds.filter((id: string) => id !== t.id));
                          } else {
                            setSelectedTableIds([...selectedTableIds, t.id]);
                          }
                        }}
                        className={`p-3 rounded-lg border text-left flex flex-col justify-between transition min-h-[44px] ${
                          isSelected ? 'bg-amber-100 border-amber-500 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <span className="font-bold text-sm">{t.name}</span>
                        <span className="text-xs text-slate-500 font-mono">Cap: {t.capacity} (Min: {t.minCapacity})</span>
                        <span className="text-[10px] font-bold text-emerald-700 mt-1">● AVAILABLE</span>
                      </button>
                    );
                  })}
                </div>

                {availabilityResult.occupiedTableIds.length > 0 && (
                  <div className="text-xs text-slate-500 font-mono">
                    Blocked Occupied Table IDs: {availabilityResult.occupiedTableIds.length}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 border-t pt-4">
              <button
                onClick={() => setAssignmentModalRes(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssignment}
                disabled={isPending || selectedTableIds.length === 0}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold disabled:opacity-40"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WALK-IN SEATING MODAL */}
      {showWalkInModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateWalkIn} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Walk-In Seating</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Name</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-2"
                value={walkInForm.guestName}
                onChange={(e) => setWalkInForm({ ...walkInForm, guestName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Party Size</label>
              <input
                type="number"
                min="1"
                max="30"
                className="w-full text-sm border rounded px-3 py-2"
                value={walkInForm.partySize}
                onChange={(e) => setWalkInForm({ ...walkInForm, partySize: Number(e.target.value) })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Phone (Optional)</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-2"
                value={walkInForm.guestPhone}
                onChange={(e) => setWalkInForm({ ...walkInForm, guestPhone: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWalkInModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold disabled:opacity-40"
              >
                Seat Walk-In
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD WAITLIST MODAL */}
      {showWaitlistModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddWaitlist} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Add to Waitlist</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Name</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-2"
                value={waitlistForm.guestName}
                onChange={(e) => setWaitlistForm({ ...waitlistForm, guestName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Party Size</label>
              <input
                type="number"
                min="1"
                max="30"
                className="w-full text-sm border rounded px-3 py-2"
                value={waitlistForm.partySize}
                onChange={(e) => setWaitlistForm({ ...waitlistForm, partySize: Number(e.target.value) })}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Guest Phone</label>
              <input
                type="text"
                className="w-full text-sm border rounded px-3 py-2"
                value={waitlistForm.guestPhone}
                onChange={(e) => setWaitlistForm({ ...waitlistForm, guestPhone: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWaitlistModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold disabled:opacity-40"
              >
                Add Guest
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
