'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { CustomerNoteDTO, CustomerTagAssignmentDTO, CustomerTagDTO, RetentionOpportunityDTO } from '@/lib/crm/crm-action.types';
import type { CustomerSegmentationDTO, UnifiedCustomerProfileDTO } from '@/lib/crm/crm-types';
import {
  addCustomerNoteServerAction,
  assignCustomerTagServerAction,
  createCustomerTagServerAction,
  deleteCustomerNoteServerAction,
  removeCustomerTagServerAction,
  revealCustomerContactDetailsServerAction,
} from '@/server/actions/crm';

interface CustomerProfileClientProps {
  businessId: string;
  profile: UnifiedCustomerProfileDTO;
  segmentation: CustomerSegmentationDTO | null;
  notes: CustomerNoteDTO[];
  tags: CustomerTagAssignmentDTO[];
  actions: RetentionOpportunityDTO[];
  availableTags: CustomerTagDTO[];
  canManage: boolean;
  hasContactView: boolean;
}

export function CustomerProfileClient({
  businessId,
  profile,
  segmentation,
  notes: initialNotes,
  tags: initialTags,
  actions,
  availableTags,
  canManage,
  hasContactView,
}: CustomerProfileClientProps) {
  const [unmaskedContact, setUnmaskedContact] = useState<{ email: string | null; phone: string | null } | null>(null);
  const [notesList, setNotesList] = useState<CustomerNoteDTO[]>(initialNotes);
  const [tagsList, setTagsList] = useState<CustomerTagAssignmentDTO[]>(initialTags);

  const [newNoteText, setNewNoteText] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const [allAvailableTags, setAllAvailableTags] = useState<CustomerTagDTO[]>(availableTags);
  const [newTagName, setNewTagName] = useState('');
  const [isCreatingTagMode, setIsCreatingTagMode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRevealContact = () => {
    startTransition(async () => {
      try {
        const details = await revealCustomerContactDetailsServerAction(businessId, profile.customerId);
        setUnmaskedContact(details);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    startTransition(async () => {
      try {
        const newNote = await addCustomerNoteServerAction(businessId, profile.customerId, newNoteText);
        setNotesList([newNote, ...notesList]);
        setNewNoteText('');
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  const handleDeleteNote = (noteId: string) => {
    startTransition(async () => {
      try {
        await deleteCustomerNoteServerAction(businessId, noteId);
        setNotesList(notesList.filter((n) => n.id !== noteId));
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  const handleAssignTag = () => {
    if (!selectedTagId) return;
    startTransition(async () => {
      try {
        await assignCustomerTagServerAction(businessId, profile.customerId, selectedTagId);
        const tagObj = allAvailableTags.find((t) => t.id === selectedTagId);
        if (tagObj) {
          setTagsList([
            ...tagsList,
            {
              tagId: tagObj.id,
              tagName: tagObj.name,
              tagSlug: tagObj.slug,
              colorHex: tagObj.colorHex,
              assignedBy: 'Current User',
              assignedAt: new Date().toISOString(),
            },
          ]);
        }
        setSelectedTagId('');
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  const handleCreateAndAssignTag = () => {
    if (!newTagName.trim()) return;
    startTransition(async () => {
      try {
        const createdTag = await createCustomerTagServerAction(businessId, newTagName.trim());
        setAllAvailableTags((prev) => [...prev, createdTag]);
        await assignCustomerTagServerAction(businessId, profile.customerId, createdTag.id);
        setTagsList((prev) => [
          ...prev,
          {
            tagId: createdTag.id,
            tagName: createdTag.name,
            tagSlug: createdTag.slug,
            colorHex: createdTag.colorHex,
            assignedBy: 'Current User',
            assignedAt: new Date().toISOString(),
          },
        ]);
        setNewTagName('');
        setIsCreatingTagMode(false);
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  const handleRemoveTag = (tagId: string) => {
    startTransition(async () => {
      try {
        await removeCustomerTagServerAction(businessId, profile.customerId, tagId);
        setTagsList(tagsList.filter((t) => t.tagId !== tagId));
      } catch (err: unknown) {
        setErrorMessage((err as Error).message);
      }
    });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/dashboard/customers" className="hover:underline">Customers</Link>
        <span>/</span>
        <span className="text-slate-900 dark:text-white font-medium">{profile.displayName}</span>
      </div>

      {errorMessage && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="font-bold">✕</button>
        </div>
      )}

      {/* Profile Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{profile.displayName}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${
              profile.identityType === 'REGISTERED'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
            }`}>
              {profile.identityType === 'REGISTERED' ? 'Registered Account' : 'Known Guest'}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Contact:{' '}
              <span className="font-mono text-slate-900 dark:text-slate-200">
                {unmaskedContact
                  ? `${unmaskedContact.email || 'No email'} / ${unmaskedContact.phone || 'No phone'}`
                  : `${profile.emailMasked || profile.phoneMasked || 'Masked'}`}
              </span>
            </div>

            {hasContactView && !unmaskedContact && (
              <button
                onClick={handleRevealContact}
                disabled={isPending}
                className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                Reveal full contact
              </button>
            )}

            <div>First Seen: <strong>{new Date(profile.firstSeenAt).toLocaleDateString()}</strong></div>
            <div>Last Visit: <strong>{new Date(profile.lastSeenAt).toLocaleDateString()}</strong></div>
          </div>
        </div>

        {segmentation && (
          <div className="flex flex-col items-start md:items-end gap-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">Segment:</span>
              <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 font-extrabold text-xs dark:bg-amber-950 dark:text-amber-200">
                {segmentation.primarySegmentCode}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">Retention Risk:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                segmentation.riskLevel === 'CRITICAL' ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300' :
                segmentation.riskLevel === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' :
                segmentation.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                {segmentation.riskLevel} ({segmentation.retentionRiskScore}/100)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Completed Orders</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{profile.activity.completedOrders}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Spend</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {(profile.activity.totalSpendCents / 100).toLocaleString('en-US', { style: 'currency', currency: profile.activity.currency })}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Average Order Value</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {(profile.activity.aovCents / 100).toLocaleString('en-US', { style: 'currency', currency: profile.activity.currency })}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Branches Visited</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{profile.activity.branchesVisitedCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Loyalty Points</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{profile.loyalty.pointsBalance}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">Avg Feedback Rating</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
            {profile.reviews.avgRatingGiven ? `${profile.reviews.avgRatingGiven} / 5.0` : 'No reviews'}
          </p>
        </div>
      </div>

      {/* RFM & Segmentation Panel */}
      {segmentation && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">RFM Scores & Behavioral Intelligence</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Deterministic RFM scoring (1-5 range) derived from cohort population quantiles.
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">RECENCY SCORE</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{segmentation.rfmScore.recencyScore} / 5</p>
              <p className="text-xs text-slate-500 mt-1">{segmentation.rfmScore.recencyDays} days since last order</p>
            </div>
            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">FREQUENCY SCORE</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{segmentation.rfmScore.frequencyScore} / 5</p>
              <p className="text-xs text-slate-500 mt-1">{segmentation.rfmScore.frequency90d} orders in past 90 days</p>
            </div>
            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">MONETARY SCORE</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{segmentation.rfmScore.monetaryScore} / 5</p>
              <p className="text-xs text-slate-500 mt-1">Relative population percentile rank</p>
            </div>
          </div>
        </div>
      )}

      {/* Internal Staff Notes & Tags Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff Notes */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Internal Staff Notes</h2>
            <span className="text-xs text-slate-500">{notesList.length} notes</span>
          </div>

          <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300">
            ⚠️ Internal note. Do not store passwords, payment card details, government IDs, or sensitive personal information.
          </div>

          {canManage && (
            <div className="space-y-2">
              <textarea
                rows={3}
                maxLength={2000}
                placeholder="Add an internal guest note (plain text, max 2000 chars)..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{newNoteText.length} / 2000 characters</span>
                <button
                  disabled={!newNoteText.trim() || isPending}
                  onClick={handleAddNote}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Add Note
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-200 dark:divide-slate-800 max-h-60 overflow-y-auto">
            {notesList.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">No internal notes for this guest yet.</p>
            ) : (
              notesList.map((note) => (
                <div key={note.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{note.noteText}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{new Date(note.createdAt).toLocaleString()}</p>
                  </div>
                  {canManage && (
                    <button
                      disabled={isPending}
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Operational Tags */}
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Operational Tags</h2>
            <span className="text-xs text-slate-500">{tagsList.length} assigned</span>
          </div>

          {canManage && (
            <div className="space-y-3">
              {isCreatingTagMode || allAvailableTags.length === 0 ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    placeholder="Enter new tag name (e.g. Preferred Guest)..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={!newTagName.trim() || isPending}
                      onClick={handleCreateAndAssignTag}
                      className="px-3 py-2 text-xs font-medium rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Create & Assign
                    </button>
                    {allAvailableTags.length > 0 && (
                      <button
                        onClick={() => setIsCreatingTagMode(false)}
                        className="px-3 py-2 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={selectedTagId}
                    onChange={(e) => setSelectedTagId(e.target.value)}
                    className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">Select tag to assign...</option>
                    {allAvailableTags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    disabled={!selectedTagId || isPending}
                    onClick={handleAssignTag}
                    className="px-3 py-2 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Assign Tag
                  </button>
                  <button
                    onClick={() => setIsCreatingTagMode(true)}
                    className="px-3 py-2 text-xs font-medium rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    + New Tag
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {tagsList.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500 w-full">No operational tags assigned.</p>
            ) : (
              tagsList.map((tag) => (
                <span
                  key={tag.tagId}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                >
                  {tag.tagName}
                  {canManage && (
                    <button
                      onClick={() => handleRemoveTag(tag.tagId)}
                      className="ml-1.5 text-slate-400 hover:text-red-500 font-bold"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Active Retention Actions */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Active Retention Actions</h2>

        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {actions.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500 col-span-2">No active retention actions queued for this guest.</p>
          ) : (
            actions.map((act) => (
              <div key={act.id} className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{act.priority} PRIORITY</span>
                  <span className="text-xs text-slate-500">Status: {act.status}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{act.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{act.summary}</p>
                <div className="mt-2 text-xs bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-800">
                  <strong>Recommendation:</strong> {act.recommendedAction}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
