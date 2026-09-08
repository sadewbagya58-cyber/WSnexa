'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmedTableContext } from '@/features/cart/cart-types';
import { verifyTableAccessAction } from '@/server/actions/table';
import { useGuestLanguage } from '@/features/qr/guest-language-context';

export interface TableItem {
  id: string;
  name: string;
  code: string;
  table_number: number | null;
  capacity?: number;
  service_area_id?: string;
  has_pin?: boolean;
}

export interface ServiceAreaItem {
  id: string;
  name: string;
  code: string;
  display_order?: number;
}

export interface TablePickerGridProps {
  branchId: string;
  serviceAreaId?: string | null;
  serviceAreaName?: string | null;
  diningTables: TableItem[];
  serviceAreas?: ServiceAreaItem[];
  requireTablePin?: boolean;
  tablePinLength?: number;
  currentTableId?: string | null;
  qrVisitSessionToken?: string | null;
  onTableConfirmed: (confirmedTable: ConfirmedTableContext) => void;
  onCancel?: () => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
  isInline?: boolean;
}

export const TablePickerGrid: React.FC<TablePickerGridProps> = ({
  branchId,
  serviceAreaId,
  serviceAreaName,
  diningTables,
  serviceAreas = [],
  requireTablePin = false,
  tablePinLength = 4,
  currentTableId,
  qrVisitSessionToken,
  onTableConfirmed,
  onCancel,
  title,
  subtitle,
  compact = false,
  isInline = false,
}) => {
  const { t } = useGuestLanguage();
  const [selectedTableId, setSelectedTableId] = useState<string>(currentTableId || '');
  const [pinInput, setPinInput] = useState<string>('');
  const [showPinPrompt, setShowPinPrompt] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showPinPrompt && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [showPinPrompt]);

  // Filter tables to active service area if scoped
  const filteredTables = React.useMemo(() => {
    let tables = diningTables;
    if (serviceAreaId) {
      const areaScoped = diningTables.filter((t) => t.service_area_id === serviceAreaId);
      if (areaScoped.length > 0) {
        tables = areaScoped;
      }
    }
    // Sort tables by table_number or name naturally
    return [...tables].sort((a, b) => {
      if (a.table_number !== null && b.table_number !== null) {
        return a.table_number - b.table_number;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });
  }, [diningTables, serviceAreaId]);

  // Resolve service area name for badge
  const resolvedAreaName = React.useMemo(() => {
    if (serviceAreaName) return serviceAreaName;
    if (serviceAreaId && serviceAreas.length > 0) {
      const found = serviceAreas.find((a) => a.id === serviceAreaId);
      if (found) return found.name;
    }
    return null;
  }, [serviceAreaName, serviceAreaId, serviceAreas]);

  const isTablePinRequired = (table: TableItem) => Boolean(requireTablePin || table.has_pin);

  const executeVerification = async (targetTable: TableItem, pin?: string) => {
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const res = await verifyTableAccessAction(
        branchId,
        targetTable.id,
        pin,
        qrVisitSessionToken || undefined,
        serviceAreaId || undefined
      );

      if (res.success && res.data?.table) {
        const confirmed: ConfirmedTableContext = {
          branchId,
          tableId: res.data.table.id,
          tableName: res.data.table.name,
          tableCode: res.data.table.code,
          serviceAreaId: targetTable.service_area_id || serviceAreaId || null,
          serviceAreaName: resolvedAreaName,
          signedTableAccessProof: res.data.signedTableAccessProof,
          verifiedAt: res.data.verifiedAt || new Date().toISOString(),
          expiresAt: res.data.expiresAt,
        };

        setShowPinPrompt(false);
        onTableConfirmed(confirmed);
      } else {
        const isPinIssue = res.message?.toLowerCase().includes('pin');
        if (isPinIssue) {
          setShowPinPrompt(true);
          setErrorMessage(
            pin
              ? t(
                  "That PIN doesn't match. Please check the 4-digit PIN on your table and try again.",
                  "PIN අංකය නොගැලපේ. කරුණාකර Table එකේ ඇති 4-digit PIN අංකය පරීක්ෂා කර නැවත උත්සාහ කරන්න."
                )
              : t(
                  "This table requires a PIN. Enter the 4-digit PIN shown on your table.",
                  "මෙම Table එක සඳහා PIN අංකයක් අවශ්‍යයි. Table එකේ ඇති 4-digit PIN එක ඇතුළත් කරන්න."
                )
          );
        } else {
          setErrorMessage(
            res.message ||
              t(
                "Unable to verify table. Please try again.",
                "Table එක තහවුරු කිරීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න."
              )
          );
        }
      }
    } catch {
      setErrorMessage(
        t(
          "Connection issue. Please try again.",
          "Connection එකේ ගැටළුවක් තියෙනවා. කරුණාකර නැවත උත්සාහ කරන්න."
        )
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTableClick = (table: TableItem) => {
    if (isVerifying) return;
    setSelectedTableId(table.id);
    setErrorMessage(null);

    if (isTablePinRequired(table)) {
      setShowPinPrompt(true);
      setPinInput('');
    } else {
      // 1-Tap verification for PIN-less venues
      executeVerification(table);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetTable = filteredTables.find((t) => t.id === selectedTableId);
    if (!targetTable) {
      setErrorMessage(
        t('Please select a table.', 'කරුණාකර Table එකක් තෝරන්න.')
      );
      return;
    }

    if (pinInput.trim().length !== tablePinLength) {
      setErrorMessage(
        t(
          `Please enter the ${tablePinLength}-digit PIN shown on your table.`,
          `කරුණාකර Table sticker එකේ ඇති ඉලක්කම් ${tablePinLength} ක PIN අංකය ඇතුළත් කරන්න.`
        )
      );
      return;
    }

    executeVerification(targetTable, pinInput.trim());
  };

  const selectedTableObj = filteredTables.find((t) => t.id === selectedTableId);

  return (
    <div className={`space-y-4 text-zinc-900 ${compact ? 'p-1' : ''}`}>
      {/* Header with Bilingual Guidance */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🪑</span>
            <h3 className="text-base sm:text-lg font-black tracking-tight text-zinc-950">
              {title || t('Which table are you at?', 'ඔයා ඉන්නේ කුමන Table එකේද?')}
            </h3>
          </div>
          {resolvedAreaName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-extrabold text-zinc-800 border border-zinc-200 shrink-0">
              <span>📍</span>
              <span className="truncate max-w-[130px]">{resolvedAreaName}</span>
            </span>
          )}
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed font-medium">
          {subtitle ||
            t(
              'Select your table so we can send your order to the correct table.',
              'Order එක නිවැරදි Table එකට එවන්න ඔයාගේ Table එක තෝරන්න.'
            )}
        </p>
      </div>

      {/* Error Feedback */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-900 flex items-start gap-2 animate-in fade-in duration-150">
          <span className="text-sm">⚠️</span>
          <span className="flex-1 leading-snug">{errorMessage}</span>
        </div>
      )}

      {/* PIN Prompt View if Table PIN is required */}
      {showPinPrompt && selectedTableObj ? (
        <form
          onSubmit={handlePinSubmit}
          className="rounded-2xl border-2 border-zinc-950 bg-white p-5 sm:p-6 space-y-4 shadow-lg animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔐</span>
                <h4 className="text-base sm:text-lg font-black tracking-tight text-zinc-950">
                  {t('Enter Table PIN', 'Table PIN එක ඇතුළත් කරන්න')}
                </h4>
              </div>
              <p className="text-xs text-zinc-600 font-medium leading-relaxed">
                {t(
                  `Enter the ${tablePinLength}-digit PIN shown on your table.`,
                  `ඔබේ Table එකේ ඇති ඉලක්කම් ${tablePinLength} ක PIN එක ඇතුළත් කරන්න.`
                )}
              </p>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-900 border border-zinc-200 shrink-0">
              <span>🪑</span>
              <span>{selectedTableObj.name}</span>
            </span>
          </div>

          {/* Secure 4-Digit Display & Hidden Numeric Input */}
          <div className="py-2">
            <div
              onClick={() => pinInputRef.current?.focus()}
              className="relative flex justify-center items-center gap-3 cursor-pointer py-2"
            >
              {Array.from({ length: tablePinLength }).map((_, idx) => {
                const char = pinInput[idx];
                const isCurrent = pinInput.length === idx;
                return (
                  <div
                    key={idx}
                    className={`h-12 w-12 sm:h-14 sm:w-14 rounded-2xl border-2 flex items-center justify-center text-xl font-mono font-black transition-all ${
                      char
                        ? 'border-zinc-950 bg-zinc-950 text-white shadow-xs'
                        : isCurrent
                        ? 'border-zinc-950 bg-zinc-50 ring-2 ring-zinc-950/20'
                        : 'border-zinc-200 bg-zinc-50 text-zinc-400'
                    }`}
                  >
                    {char ? '•' : ''}
                  </div>
                );
              })}

              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={tablePinLength}
                value={pinInput}
                autoFocus
                disabled={isVerifying}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, tablePinLength);
                  setPinInput(cleaned);
                  if (errorMessage) setErrorMessage(null);
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label={t('Enter Table PIN', 'Table PIN එක ඇතුළත් කරන්න')}
              />
            </div>
            <p className="text-[11px] text-zinc-400 text-center mt-1 font-medium">
              {t('Tap above to enter numbers', 'PIN එක ඇතුළත් කිරීමට ඉහත click කරන්න')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <Button
              type="submit"
              disabled={isVerifying || pinInput.length !== tablePinLength}
              className="w-full text-sm font-extrabold py-3.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl shadow-md min-h-[48px] cursor-pointer disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed"
            >
              {isVerifying
                ? t('Verifying...', 'තහවුරු කරමින්...')
                : t('Verify Table', 'Table එක තහවුරු කරන්න')}
            </Button>

            <button
              type="button"
              onClick={() => {
                setShowPinPrompt(false);
                setPinInput('');
                setErrorMessage(null);
              }}
              disabled={isVerifying}
              className="w-full py-2.5 text-xs font-bold text-zinc-600 hover:text-zinc-950 text-center transition-colors cursor-pointer min-h-[44px]"
            >
              ← {t('Back to Tables', 'වෙනත් Table එකක් තෝරන්න')}
            </button>
          </div>
        </form>
      ) : (
        /* Mobile-First Touch Table Grid */
        <div>
          {filteredTables.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-xs text-amber-900 space-y-1">
              <span className="text-2xl block mb-1">⚠️</span>
              <p className="font-extrabold">{t('No Dining Tables Found', 'Dining Tables කිසිවක් හමු නොවීය')}</p>
              <p className="text-[11px] text-amber-800 font-medium">
                {t(
                  'No active tables configured for this service area. Please ask staff for assistance.',
                  'මෙම Service Area එක සඳහා active tables සකසා නැත. කරුණාකර කාර්ය මණ්ඩලයෙන් විමසන්න.'
                )}
              </p>
            </div>
          ) : (
            <div className="max-h-72 sm:max-h-80 overflow-y-auto pr-1 py-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredTables.map((table) => {
                  const isSelected = selectedTableId === table.id;

                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => handleTableClick(table)}
                      disabled={isVerifying}
                      className={`group relative flex flex-col items-center justify-center p-3 sm:p-3.5 rounded-2xl border text-center transition-all min-h-[58px] cursor-pointer select-none touch-manipulation active:scale-[0.97] ${
                        isSelected
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-md ring-2 ring-zinc-950'
                          : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/80 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-black text-sm sm:text-base tracking-tight leading-none">
                        <span>{table.name}</span>
                        {isSelected && <span className="text-xs text-emerald-400">✓</span>}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1">
                        {table.code && table.code !== table.name && (
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider ${
                              isSelected ? 'text-zinc-300' : 'text-zinc-400'
                            }`}
                          >
                            {table.code}
                          </span>
                        )}
                        {table.capacity && table.capacity > 0 && (
                          <span
                            className={`text-[10px] font-medium ${
                              isSelected ? 'text-zinc-400' : 'text-zinc-500'
                            }`}
                          >
                            • {table.capacity} {t('seats', 'ආසන')}
                          </span>
                        )}
                      </div>

                      {(requireTablePin || table.has_pin) && (
                        <div
                          className={`mt-1 text-[9px] font-bold ${
                            isSelected ? 'text-amber-300' : 'text-amber-700'
                          }`}
                        >
                          🔒 {t('PIN required', 'PIN අවශ්‍යයි')}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Footer if not inline */}
      {!isInline && onCancel && (
        <div className="pt-2 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            className="text-xs font-bold text-zinc-600 hover:text-zinc-900 cursor-pointer min-h-[44px]"
          >
            {t('Cancel', 'අවලංගු කරන්න')}
          </Button>
        </div>
      )}
    </div>
  );
};
