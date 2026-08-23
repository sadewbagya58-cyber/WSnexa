import { AnalyticsDateRange, ResolvedDateRange } from './analytics-types';

export const DEFAULT_BRANCH_TIMEZONE = 'Asia/Colombo';

/**
 * Resolves an AnalyticsDateRange input into strict UTC start/end boundaries [startUtc, endUtc)
 * using the branch's local timezone.
 */
export function resolveAnalyticsDateRange(
  input: AnalyticsDateRange,
  branchTimezone: string = DEFAULT_BRANCH_TIMEZONE
): ResolvedDateRange {
  const tz = input.timezone || branchTimezone || DEFAULT_BRANCH_TIMEZONE;
  const preset = input.preset || 'today';
  const now = new Date();

  // Helper: Get local date components in target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);

  const year = getPart('year');
  const month = getPart('month') - 1; // 0-indexed
  const day = getPart('day');

  let startLocal: Date;
  let endLocal: Date;
  let label = 'Today';

  let prevStartLocal: Date | undefined;
  let prevEndLocal: Date | undefined;
  let prevLabel = 'Previous Period';

  if (preset === 'custom' && input.startDate && input.endDate) {
    const customStart = new Date(input.startDate);
    const customEnd = new Date(input.endDate);

    if (isNaN(customStart.getTime()) || isNaN(customEnd.getTime())) {
      throw new Error('Invalid custom date range parameters.');
    }
    if (customStart >= customEnd) {
      throw new Error('Start date must be strictly earlier than end date.');
    }

    const durationMs = customEnd.getTime() - customStart.getTime();
    startLocal = customStart;
    endLocal = customEnd;
    label = 'Custom Range';

    prevStartLocal = new Date(customStart.getTime() - durationMs);
    prevEndLocal = customStart;
    prevLabel = 'Previous Period';
  } else {
    switch (preset) {
      case 'yesterday': {
        startLocal = new Date(Date.UTC(year, month, day - 1, 0, 0, 0, 0));
        endLocal = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        label = 'Yesterday';

        prevStartLocal = new Date(Date.UTC(year, month, day - 2, 0, 0, 0, 0));
        prevEndLocal = startLocal;
        prevLabel = 'Day Before Yesterday';
        break;
      }
      case 'last_7_days': {
        startLocal = new Date(Date.UTC(year, month, day - 6, 0, 0, 0, 0));
        endLocal = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));
        label = 'Last 7 Days';

        prevStartLocal = new Date(Date.UTC(year, month, day - 13, 0, 0, 0, 0));
        prevEndLocal = startLocal;
        prevLabel = 'Prior 7 Days';
        break;
      }
      case 'last_30_days': {
        startLocal = new Date(Date.UTC(year, month, day - 29, 0, 0, 0, 0));
        endLocal = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));
        label = 'Last 30 Days';

        prevStartLocal = new Date(Date.UTC(year, month, day - 59, 0, 0, 0, 0));
        prevEndLocal = startLocal;
        prevLabel = 'Prior 30 Days';
        break;
      }
      case 'this_month': {
        startLocal = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        endLocal = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
        label = 'This Month';

        prevStartLocal = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        prevEndLocal = startLocal;
        prevLabel = 'Last Month';
        break;
      }
      case 'last_month': {
        startLocal = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
        endLocal = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        label = 'Last Month';

        prevStartLocal = new Date(Date.UTC(year, month - 2, 1, 0, 0, 0, 0));
        prevEndLocal = startLocal;
        prevLabel = 'Prior Month';
        break;
      }
      case 'today':
      default: {
        startLocal = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        endLocal = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));
        label = 'Today';

        prevStartLocal = new Date(Date.UTC(year, month, day - 1, 0, 0, 0, 0));
        prevEndLocal = startLocal;
        prevLabel = 'Yesterday';
        break;
      }
    }
  }

  return {
    preset,
    startUtc: startLocal.toISOString(),
    endUtc: endLocal.toISOString(),
    timezone: tz,
    label,
    previousRange: prevStartLocal && prevEndLocal ? {
      startUtc: prevStartLocal.toISOString(),
      endUtc: prevEndLocal.toISOString(),
      label: prevLabel,
    } : undefined,
  };
}

/**
 * Safe metric comparison calculation avoiding division-by-zero or Infinity.
 */
export function computeMetricComparison(
  currentValue: number | null,
  previousValue: number | null
): {
  absoluteChange: number | null;
  percentageChange: number | null;
} {
  if (currentValue === null || previousValue === null || previousValue === 0) {
    return {
      absoluteChange: currentValue !== null && previousValue !== null ? currentValue - previousValue : null,
      percentageChange: null,
    };
  }

  const absoluteChange = currentValue - previousValue;
  const percentageChange = Number(((absoluteChange / Math.abs(previousValue)) * 100).toFixed(2));

  return {
    absoluteChange,
    percentageChange,
  };
}

/**
 * Normalizes operational order statuses into canonical analytics status groups.
 */
export function normalizeOrderAnalyticsStatus(
  status: string
): 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'REJECTED' {
  const s = (status || '').toLowerCase().trim();
  switch (s) {
    case 'completed':
    case 'served':
      return 'COMPLETED';
    case 'cancelled':
    case 'canceled':
      return 'CANCELLED';
    case 'rejected':
      return 'REJECTED';
    case 'pending':
    case 'confirmed':
    case 'preparing':
    case 'ready':
    default:
      return 'ACTIVE';
  }
}
