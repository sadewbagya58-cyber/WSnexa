'use client';

import React, { useState } from 'react';
import {
  confirmReservationAction,
  declineReservationAction,
  cancelReservationAction,
  markReservationArrivedAction,
  markReservationSeatedAction,
  markReservationCompletedAction,
  markReservationNoShowAction,
  createStaffReservationAction,
  getReservationStatusHistoryAction,
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
  ReservationStatusEventDTO,
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
  hasCreatePermission?: boolean;
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
  hasCreatePermission = true,
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
  const [statusFilter, setStatusFilter] = useState<string>('OPERATIONAL');
  const [searchQuery, setSearchQuery] = useState<string>('');
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

  // Staff Create Modal State
  const [showStaffCreateModal, setShowStaffCreateModal] = useState<boolean>(false);
  const [staffCreateForm, setStaffCreateForm] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    partySize: 2,
    reservationStartAt: '',
    occasion: '',
    specialRequests: '',
    internalNotes: '',
  });

  // Decline Modal State
  const [declineModalRes, setDeclineModalRes] = useState<ReservationDTO | null>(null);
  const [declineReason, setDeclineReason] = useState<string>('');

  // Detail Modal State
  const [detailModalRes, setDetailModalRes] = useState<ReservationDTO | null>(null);
  const [detailStatusHistory, setDetailStatusHistory] = useState<ReservationStatusEventDTO[]>([]);

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

  const handleOpenDetailModal = async (res: ReservationDTO) => {
    setDetailModalRes(res);
    setDetailStatusHistory([]);
    try {
      const historyRes = await getReservationStatusHistoryAction(res.id);
      if (historyRes.ok) {
        setDetailStatusHistory(historyRes.data);
      }
    } catch (err: unknown) {
      console.warn('Failed to load status history:', (err as Error).message);
    }
  };

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
        setLastMessage(`❌ Availability lookup error: ${availRes.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Failed to check availability: ${(err as Error).message}`);
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
        setLastMessage(`❌ Assignment failed: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Assignment error: ${(err as Error).message}`);
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
        const count = result.data.length;
        setLastMessage(`✅ Auto-fitted ${count} table(s) for ${res.guestName}`);
      } else {
        setLastMessage(`❌ Auto-fit failed: ${result.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Auto-fit error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleRelease = async (reservationId: string) => {
    setIsPending(true);
    try {
      const res = await releaseReservationTablesAction(reservationId);
      if (res.ok) {
        setActiveAssignmentsMap((prev) => {
          const updated = { ...prev };
          delete updated[reservationId];
          return updated;
        });
        setLastMessage('✅ Table assignments released');
      } else {
        setLastMessage(`❌ Release failed: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Release error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleStatusTransition = async (
    reservationId: string,
    action: 'confirm' | 'arrived' | 'seated' | 'complete' | 'cancel' | 'noshow'
  ) => {
    setIsPending(true);
    try {
      let res;
      if (action === 'confirm') res = await confirmReservationAction(reservationId);
      else if (action === 'arrived') res = await markReservationArrivedAction(reservationId);
      else if (action === 'seated') res = await markReservationSeatedAction(reservationId);
      else if (action === 'complete') res = await markReservationCompletedAction(reservationId);
      else if (action === 'cancel') res = await cancelReservationAction({ reservationId, reason: 'Staff cancelled' });
      else if (action === 'noshow') res = await markReservationNoShowAction(reservationId);

      if (res && res.ok) {
        setReservations((prev) => ({
          ...prev,
          items: prev.items.map((r) => (r.id === reservationId ? res.data : r)),
        }));
        if (['complete', 'cancel', 'noshow'].includes(action)) {
          setActiveAssignmentsMap((prev) => {
            const updated = { ...prev };
            delete updated[reservationId];
            return updated;
          });
        }
        setLastMessage(`✅ Reservation marked as ${res.data.status}`);
      } else if (res) {
        setLastMessage(`❌ Action failed: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Transition error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineModalRes) return;
    setIsPending(true);
    try {
      const res = await declineReservationAction({
        reservationId: declineModalRes.id,
        reason: declineReason || 'Declined by staff',
      });
      if (res.ok) {
        setReservations((prev) => ({
          ...prev,
          items: prev.items.map((r) => (r.id === declineModalRes.id ? res.data : r)),
        }));
        setActiveAssignmentsMap((prev) => {
          const updated = { ...prev };
          delete updated[declineModalRes.id];
          return updated;
        });
        setDeclineModalRes(null);
        setDeclineReason('');
        setLastMessage(`✅ Reservation declined: ${declineModalRes.guestName}`);
      } else {
        setLastMessage(`❌ Decline failed: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Decline error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  const handleStaffCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    try {
      const startAtIso = new Date(staffCreateForm.reservationStartAt).toISOString();
      const res = await createStaffReservationAction({
        businessId,
        branchId: selectedBranchId,
        guestName: staffCreateForm.guestName,
        guestPhone: staffCreateForm.guestPhone || null,
        guestEmail: staffCreateForm.guestEmail || null,
        partySize: Number(staffCreateForm.partySize),
        reservationStartAt: startAtIso,
        durationMinutes: 90,
        occasion: staffCreateForm.occasion || null,
        specialRequests: staffCreateForm.specialRequests || null,
        internalNotes: staffCreateForm.internalNotes || null,
        source: 'STAFF',
      });

      if (res.ok) {
        setReservations((prev) => ({
          ...prev,
          items: [res.data, ...prev.items],
        }));
        setShowStaffCreateModal(false);
        setLastMessage(`✅ Reservation created for ${res.data.guestName} (${res.data.confirmationCode})`);
      } else {
        setLastMessage(`❌ Creation failed: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Creation error: ${(err as Error).message}`);
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
        partySize: Number(walkInForm.partySize),
        guestPhone: walkInForm.guestPhone || null,
        specialRequests: walkInForm.specialRequests || null,
      });

      if (res.ok) {
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
        setShowWalkInModal(false);
        setLastMessage(`✅ Walk-in seated for ${res.data.reservation.guestName}!`);
      } else {
        setLastMessage(`❌ Walk-in rejected: ${res.error.message}`);
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
        setLastMessage(`❌ Waitlist failed: ${res.error.message}`);
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
        setLastMessage(`✅ Promoted waitlist guest ${entry.guestName}!`);
      } else {
        setLastMessage(`❌ Promotion error: ${res.error.message}`);
      }
    } catch (err: unknown) {
      setLastMessage(`❌ Promotion error: ${(err as Error).message}`);
    } finally {
      setIsPending(false);
    }
  };

  // Filter reservations based on search and status
  const displayedReservations = reservations.items.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameMatch = r.guestName.toLowerCase().includes(q);
      const codeMatch = r.confirmationCode.toLowerCase().includes(q);
      if (!nameMatch && !codeMatch) return false;
    }
    if (statusFilter === 'OPERATIONAL') {
      return ['PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED'].includes(r.status);
    }
    if (statusFilter !== 'ALL') {
      return r.status === statusFilter;
    }
    return true;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'CONFIRMED': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'ARRIVED': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'SEATED': return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'COMPLETED': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'CANCELLED': return 'bg-rose-50 text-rose-800 border-rose-200';
      case 'NO_SHOW': return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'DECLINED': return 'bg-rose-50 text-rose-800 border-rose-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 font-sans">
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Reservations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage bookings, arrivals, seating, and waitlist.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 min-h-[40px]"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>

          {hasCreatePermission && (
            <button
              onClick={() => {
                setStaffCreateForm((prev) => ({
                  ...prev,
                  reservationStartAt: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
                }));
                setShowStaffCreateModal(true);
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition min-h-[40px]"
            >
              + New Reservation
            </button>
          )}

          {hasManagePermission && (
            <button
              onClick={() => setShowWalkInModal(true)}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition min-h-[40px]"
            >
              Walk-In
            </button>
          )}

          {hasWaitlistPermission && (
            <button
              onClick={() => setShowWaitlistModal(true)}
              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold px-3.5 py-2 rounded-lg transition min-h-[40px]"
            >
              Add to Waitlist
            </button>
          )}
        </div>
      </div>

      {/* Global Status Banner */}
      {lastMessage && (
        <div
          className={`p-3.5 rounded-lg text-xs font-mono border flex items-center justify-between ${
            lastMessage.startsWith('✅')
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          <span>{lastMessage}</span>
          <button onClick={() => setLastMessage(null)} className="text-slate-400 hover:text-slate-600 ml-4 font-sans font-bold">✕</button>
        </div>
      )}

      {/* View Tabs & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => {
              setActiveTab('today');
              setStatusFilter('OPERATIONAL');
            }}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'today'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Today Operations
          </button>
          <button
            onClick={() => {
              setActiveTab('upcoming');
              setStatusFilter('ALL');
            }}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'upcoming'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({reservations.items.length})
          </button>
          <button
            onClick={() => setActiveTab('waitlist')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'waitlist'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Waitlist ({waitlist.filter((w) => w.status === 'WAITING').length})
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
              className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'settings'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Settings
            </button>
          )}
        </div>

        {(activeTab === 'today' || activeTab === 'upcoming') && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search guest or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 min-h-[36px]"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 min-h-[36px]"
            >
              <option value="OPERATIONAL">Active (Pending, Confirmed, Arrived, Seated)</option>
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="ARRIVED">Arrived</option>
              <option value="SEATED">Seated</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No-Show</option>
              <option value="DECLINED">Declined</option>
            </select>
          </div>
        )}
      </div>

      {/* RESERVATIONS CARD GRID */}
      {(activeTab === 'today' || activeTab === 'upcoming') && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedReservations.map((r) => {
            const assignments = activeAssignmentsMap[r.id] || [];
            return (
              <div
                key={r.id}
                className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Row: Guest Name & Status Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 leading-tight">{r.guestName}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {r.confirmationCode} · {r.source}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-md border ${getStatusBadgeClass(r.status)}`}>
                      {r.status}
                    </span>
                  </div>

                  {/* Primary Info: Time & Party Size */}
                  <div className="flex items-center gap-3 text-xs font-semibold text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span>⏰ {new Date(r.reservationStartAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>👥 {r.partySize} Guests</span>
                  </div>

                  {/* Table Assignment & Contact Info */}
                  <div className="text-xs text-slate-600 space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Table:</span>
                      {assignments.length > 0 ? (
                        <span className="font-bold text-slate-800">
                          {assignments.map((a) => a.tableName || `T${a.tableNumber}`).join(', ')}
                        </span>
                      ) : (
                        <span className="italic text-slate-400">No table assigned</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-slate-400 font-medium">Contact:</span>
                      <span className="font-mono text-slate-700">
                        {hasContactView
                          ? r.guestPhone || r.guestEmail || 'None'
                          : r.guestPhoneMasked || r.guestEmailMasked || 'Masked'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                  {/* Primary & Secondary Action Button Row */}
                  {r.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStatusTransition(r.id, 'confirm')}
                        disabled={isPending}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition disabled:opacity-50 min-h-[44px]"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeclineModalRes(r)}
                        disabled={isPending}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-200 transition min-h-[44px]"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {r.status === 'CONFIRMED' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStatusTransition(r.id, 'arrived')}
                        disabled={isPending}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition disabled:opacity-50 min-h-[44px]"
                      >
                        Mark Arrived
                      </button>
                      {hasAssignPermission && (
                        <button
                          onClick={() => handleOpenAssignModal(r)}
                          disabled={isPending}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-200 transition min-h-[44px]"
                        >
                          {assignments.length > 0 ? 'Reassign' : 'Assign Table'}
                        </button>
                      )}
                    </div>
                  )}

                  {r.status === 'ARRIVED' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStatusTransition(r.id, 'seated')}
                        disabled={isPending}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition disabled:opacity-50 min-h-[44px]"
                      >
                        Seat Party
                      </button>
                      {hasAssignPermission && (
                        <button
                          onClick={() => handleOpenAssignModal(r)}
                          disabled={isPending}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-200 transition min-h-[44px]"
                        >
                          {assignments.length > 0 ? 'Reassign' : 'Assign Table'}
                        </button>
                      )}
                    </div>
                  )}

                  {r.status === 'SEATED' && (
                    <button
                      onClick={() => handleStatusTransition(r.id, 'complete')}
                      disabled={isPending}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition disabled:opacity-50 min-h-[44px]"
                    >
                      Complete Session
                    </button>
                  )}

                  {/* Secondary Action Row: Cancel / Details */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    {['PENDING', 'CONFIRMED', 'ARRIVED'].includes(r.status) ? (
                      <button
                        onClick={() => handleStatusTransition(r.id, 'cancel')}
                        disabled={isPending}
                        className="text-rose-600 hover:text-rose-800 font-medium text-xs py-1"
                      >
                        Cancel Booking
                      </button>
                    ) : (
                      <span />
                    )}
                    <button
                      onClick={() => handleOpenDetailModal(r)}
                      className="text-slate-600 hover:text-slate-900 font-semibold text-xs py-1 ml-auto"
                    >
                      View details →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {displayedReservations.length === 0 && (
            <div className="col-span-full bg-white p-12 rounded-xl text-center border border-slate-200 space-y-2">
              <p className="text-sm font-semibold text-slate-700">No reservations found</p>
              <p className="text-xs text-slate-400">Try adjusting your status filter or search query.</p>
            </div>
          )}
        </div>
      )}

      {/* WAITLIST QUEUE */}
      {activeTab === 'waitlist' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 font-bold border-b text-slate-600">
              <tr>
                <th className="p-3.5">Priority</th>
                <th className="p-3.5">Guest Name</th>
                <th className="p-3.5">Party Size</th>
                <th className="p-3.5">Contact</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Waiting Time</th>
                <th className="p-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {waitlist.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50/50">
                  <td className="p-3.5 font-mono font-bold text-amber-700">#{w.priority}</td>
                  <td className="p-3.5 font-bold text-slate-900">{w.guestName}</td>
                  <td className="p-3.5 font-medium">{w.partySize} guests</td>
                  <td className="p-3.5 font-mono">{w.guestPhoneMasked || w.guestPhone || '-'}</td>
                  <td className="p-3.5 font-bold">{w.status}</td>
                  <td className="p-3.5 font-mono text-slate-500">
                    {new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-3.5">
                    {w.status === 'WAITING' && hasWaitlistPermission && (
                      <button
                        onClick={() => handlePromoteWaitlist(w)}
                        disabled={isPending}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold disabled:opacity-40 min-h-[36px]"
                      >
                        Promote & Seat
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {waitlist.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                    No guests are currently waiting.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* GROUPED BRANCH SETTINGS PANEL */}
      {activeTab === 'settings' && branchSettings && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Branch Reservation Settings</h2>
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
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm disabled:opacity-40 min-h-[40px]"
            >
              Save Settings
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Group 1: Availability Rules */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">1. Availability Policy</h3>
              <div className="flex items-center gap-3">
                <input
                  id="reservationsEnabled"
                  type="checkbox"
                  checked={branchSettings.reservationsEnabled}
                  onChange={(e) =>
                    setBranchSettings((prev) => (prev ? { ...prev, reservationsEnabled: e.target.checked } : prev))
                  }
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <label htmlFor="reservationsEnabled" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Enable Public Online Reservations
                </label>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="allowSameDay"
                  type="checkbox"
                  checked={branchSettings.allowSameDay}
                  onChange={(e) =>
                    setBranchSettings((prev) => (prev ? { ...prev, allowSameDay: e.target.checked } : prev))
                  }
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <label htmlFor="allowSameDay" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Allow Same-Day Bookings
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block uppercase">Min Advance (Minutes)</label>
                  <input
                    type="number"
                    min={0}
                    value={branchSettings.minimumAdvanceMinutes}
                    onChange={(e) =>
                      setBranchSettings((prev) =>
                        prev ? { ...prev, minimumAdvanceMinutes: parseInt(e.target.value, 10) || 0 } : prev
                      )
                    }
                    className="w-full text-xs font-bold border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block uppercase">Max Advance (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={branchSettings.maximumAdvanceDays}
                    onChange={(e) =>
                      setBranchSettings((prev) =>
                        prev ? { ...prev, maximumAdvanceDays: parseInt(e.target.value, 10) || 90 } : prev
                      )
                    }
                    className="w-full text-xs font-bold border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Group 2: Party Bounds & Timing */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">2. Party Bounds & Timing</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block uppercase">Default Duration (Min)</label>
                  <input
                    type="number"
                    min={15}
                    value={branchSettings.defaultDurationMinutes}
                    onChange={(e) =>
                      setBranchSettings((prev) =>
                        prev ? { ...prev, defaultDurationMinutes: parseInt(e.target.value, 10) || 90 } : prev
                      )
                    }
                    className="w-full text-xs font-bold border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block uppercase">Turnover Buffer (Min)</label>
                  <input
                    type="number"
                    min={0}
                    value={branchSettings.tableTurnoverBufferMinutes || 15}
                    onChange={(e) =>
                      setBranchSettings((prev) =>
                        prev ? { ...prev, tableTurnoverBufferMinutes: parseInt(e.target.value, 10) || 15 } : prev
                      )
                    }
                    className="w-full text-xs font-bold border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block uppercase">Min Party Size</label>
                  <input
                    type="number"
                    min={1}
                    value={branchSettings.minimumPartySize}
                    onChange={(e) =>
                      setBranchSettings((prev) =>
                        prev ? { ...prev, minimumPartySize: parseInt(e.target.value, 10) || 1 } : prev
                      )
                    }
                    className="w-full text-xs font-bold border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block uppercase">Max Party Size</label>
                  <input
                    type="number"
                    min={1}
                    value={branchSettings.maximumPartySize}
                    onChange={(e) =>
                      setBranchSettings((prev) =>
                        prev ? { ...prev, maximumPartySize: parseInt(e.target.value, 10) || 20 } : prev
                      )
                    }
                    className="w-full text-xs font-bold border rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Group 3: Automation & Contact Rules */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 col-span-full">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">3. Guest Policy & Automation</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id="autoConfirm"
                    type="checkbox"
                    checked={branchSettings.autoConfirm}
                    onChange={(e) =>
                      setBranchSettings((prev) => (prev ? { ...prev, autoConfirm: e.target.checked } : prev))
                    }
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <label htmlFor="autoConfirm" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Auto-Confirm Bookings
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="requireGuestPhone"
                    type="checkbox"
                    checked={branchSettings.requireGuestPhone}
                    onChange={(e) =>
                      setBranchSettings((prev) => (prev ? { ...prev, requireGuestPhone: e.target.checked } : prev))
                    }
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <label htmlFor="requireGuestPhone" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Require Guest Phone
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="requireGuestEmail"
                    type="checkbox"
                    checked={branchSettings.requireGuestEmail}
                    onChange={(e) =>
                      setBranchSettings((prev) => (prev ? { ...prev, requireGuestEmail: e.target.checked } : prev))
                    }
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                  <label htmlFor="requireGuestEmail" className="text-xs font-bold text-slate-800 cursor-pointer">
                    Require Guest Email
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAFF CREATE RESERVATION MODAL */}
      {showStaffCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleStaffCreateReservation} className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2">New Reservation</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Guest Name</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={staffCreateForm.guestName}
                  onChange={(e) => setStaffCreateForm({ ...staffCreateForm, guestName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Party Size</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  className="w-full border rounded px-3 py-2"
                  value={staffCreateForm.partySize}
                  onChange={(e) => setStaffCreateForm({ ...staffCreateForm, partySize: Number(e.target.value) })}
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Guest Phone</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={staffCreateForm.guestPhone}
                  onChange={(e) => setStaffCreateForm({ ...staffCreateForm, guestPhone: e.target.value })}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Guest Email</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={staffCreateForm.guestEmail}
                  onChange={(e) => setStaffCreateForm({ ...staffCreateForm, guestEmail: e.target.value })}
                />
              </div>

              <div className="col-span-full">
                <label className="block font-semibold text-slate-700 mb-1">Reservation Date & Time</label>
                <input
                  type="datetime-local"
                  className="w-full border rounded px-3 py-2"
                  value={staffCreateForm.reservationStartAt}
                  onChange={(e) => setStaffCreateForm({ ...staffCreateForm, reservationStartAt: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Occasion</label>
                <select
                  className="w-full border rounded px-3 py-2 bg-white"
                  value={staffCreateForm.occasion}
                  onChange={(e) => setStaffCreateForm({ ...staffCreateForm, occasion: e.target.value })}
                >
                  <option value="">None</option>
                  <option value="Birthday">Birthday</option>
                  <option value="Anniversary">Anniversary</option>
                  <option value="Business Meal">Business Meal</option>
                  <option value="Date Night">Date Night</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Special Requests</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder="Window table..."
                  value={staffCreateForm.specialRequests}
                  onChange={(e) => setStaffCreateForm({ ...staffCreateForm, specialRequests: e.target.value })}
                />
              </div>

              <div className="col-span-full">
                <label className="block font-semibold text-slate-700 mb-1">Internal Staff Note</label>
                <textarea
                  rows={2}
                  className="w-full border rounded px-3 py-2"
                  placeholder="VIP guest, allergy note..."
                  value={staffCreateForm.internalNotes}
                  onChange={(e) => setStaffCreateForm({ ...staffCreateForm, internalNotes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowStaffCreateModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold disabled:opacity-40 min-h-[40px]"
              >
                {isPending ? 'Saving…' : 'Create Reservation'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DECLINE RESERVATION MODAL */}
      {declineModalRes && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleDeclineSubmit} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Decline Reservation</h3>
            <p className="text-xs text-slate-600">
              Decline booking request for <strong>{declineModalRes.guestName}</strong> ({declineModalRes.confirmationCode}).
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Decline Reason</label>
              <textarea
                rows={3}
                className="w-full text-xs border rounded px-3 py-2"
                placeholder="Fully booked, private event..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <button
                type="button"
                onClick={() => setDeclineModalRes(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold disabled:opacity-40 min-h-[40px]"
              >
                {isPending ? 'Declining…' : 'Decline Booking'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* RESERVATION DETAIL & HISTORY MODAL */}
      {detailModalRes && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-amber-700">{detailModalRes.confirmationCode}</span>
                <h3 className="text-lg font-bold text-slate-900">{detailModalRes.guestName}</h3>
              </div>
              <button
                onClick={() => setDetailModalRes(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-sans">Status</span>
                <strong className="text-slate-900 font-sans text-sm">{detailModalRes.status}</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-sans">Party Size</span>
                <strong className="text-slate-900 font-sans text-sm">{detailModalRes.partySize} guests</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-sans">Source</span>
                <span>{detailModalRes.source}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-sans">CRM Customer Link</span>
                <span className="font-bold text-emerald-700 font-sans">
                  {detailModalRes.crmCustomerId ? '✓ Linked CRM Profile' : 'Guest Booking'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-sans">Start Time</span>
                <span>{new Date(detailModalRes.reservationStartAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-sans">Contact</span>
                <span>
                  {hasContactView
                    ? detailModalRes.guestPhone || detailModalRes.guestEmail || 'No contact provided'
                    : detailModalRes.guestPhoneMasked || detailModalRes.guestEmailMasked || 'Masked contact'}
                </span>
              </div>
              {detailModalRes.specialRequests && (
                <div className="col-span-full">
                  <span className="text-[10px] text-slate-400 block uppercase font-sans">Special Requests</span>
                  <span className="font-sans text-slate-800">{detailModalRes.specialRequests}</span>
                </div>
              )}
              {detailModalRes.internalNotes && (
                <div className="col-span-full bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  <span className="text-[10px] text-amber-800 font-bold block uppercase font-sans">Internal Staff Note</span>
                  <span className="font-sans text-amber-950">{detailModalRes.internalNotes}</span>
                </div>
              )}
            </div>

            {/* Operational Outcome Section */}
            {['DECLINED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(detailModalRes.status) && (
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs font-sans">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px] pb-1 border-b border-slate-200">
                  Operational Outcome
                </div>

                {detailModalRes.status === 'DECLINED' && (
                  <>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500 font-medium">Outcome:</span>
                      <span className="font-bold text-rose-700">Declined by staff</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Reason:</span>
                      <span className="font-semibold text-slate-800">{detailModalRes.declineReason || 'No reason provided'}</span>
                    </div>
                    {detailModalRes.declinedAt && (
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Time:</span>
                        <span>{new Date(detailModalRes.declinedAt).toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}

                {detailModalRes.status === 'CANCELLED' && (
                  <>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500 font-medium">Outcome:</span>
                      <span className="font-bold text-rose-700">Cancelled</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Reason:</span>
                      <span className="font-semibold text-slate-800">{detailModalRes.cancellationReason || 'No reason provided'}</span>
                    </div>
                    {detailModalRes.cancelledAt && (
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Time:</span>
                        <span>{new Date(detailModalRes.cancelledAt).toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}

                {detailModalRes.status === 'NO_SHOW' && (
                  <>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500 font-medium">Outcome:</span>
                      <span className="font-bold text-slate-700">No-Show</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Reason:</span>
                      <span className="font-semibold text-slate-800">{detailModalRes.cancellationReason || 'No reason provided'}</span>
                    </div>
                    {detailModalRes.noShowAt && (
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Time:</span>
                        <span>{new Date(detailModalRes.noShowAt).toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}

                {detailModalRes.status === 'COMPLETED' && (
                  <>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500 font-medium">Outcome:</span>
                      <span className="font-bold text-emerald-700">Completed Session</span>
                    </div>
                    {detailModalRes.completedAt && (
                      <div className="flex justify-between text-slate-500 text-[11px]">
                        <span>Time:</span>
                        <span>{new Date(detailModalRes.completedAt).toLocaleString()}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Status Event Timeline Audit */}
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Lifecycle Status History</h4>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {detailStatusHistory.map((ev) => (
                  <div key={ev.id} className="p-2 bg-slate-50 border rounded-lg text-xs font-mono flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">
                        {ev.fromStatus ? `${ev.fromStatus} → ${ev.toStatus}` : ev.toStatus}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-2">via {ev.actorType}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{new Date(ev.createdAt).toLocaleTimeString()}</span>
                  </div>
                ))}
                {detailStatusHistory.length === 0 && (
                  <div className="text-xs text-slate-400 italic">No history records loaded.</div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setDetailModalRes(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold min-h-[40px]"
              >
                Close
              </button>
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
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold min-h-[40px]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAssignment}
                disabled={isPending || selectedTableIds.length === 0}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold disabled:opacity-40 min-h-[40px]"
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
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold disabled:opacity-40 min-h-[40px]"
              >
                {isPending ? 'Seating…' : 'Seat Walk-In'}
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
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold disabled:opacity-40 min-h-[40px]"
              >
                {isPending ? 'Adding…' : 'Add to Waitlist'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
