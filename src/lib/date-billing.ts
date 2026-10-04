/**
 * Canonical WSNexa Subscription Billing Date Calculations
 *
 * CANONICAL RULE SPECIFICATION:
 * 1. Calendar-Month Semantics: Monthly subscription cycles are calculated by advancing exactly
 *    one calendar month, matching PostgreSQL's `start_date + INTERVAL '1 month'`.
 * 2. Day-Clipping Rule: If the target month has fewer days than the start day (e.g. Jan 31 -> Feb),
 *    the expiration is clipped to the last valid day of that target month (Feb 28, or Feb 29 in leap years;
 *    March 31 -> April 30; August 31 -> September 30).
 * 3. Continuous Renewal Rule:
 *    - If an active subscription has a future expiration (`current_period_ends_at > now()`),
 *      the renewal extends from `current_period_ends_at`, ensuring the business loses zero days.
 *    - If the subscription is lapsed, expired, trialing, or suspended (`current_period_ends_at <= now()`),
 *      the new period anchors immediately to `now()`.
 */

/**
 * Adds exactly one calendar month to a given UTC date with end-of-month day clipping.
 * Strictly guarantees identical results to PostgreSQL: `date + INTERVAL '1 month'`.
 */
export function addCalendarMonth(startDate: Date): Date {
  const result = new Date(startDate.getTime());
  const originalDay = result.getUTCDate();

  // Advance month index
  result.setUTCMonth(result.getUTCMonth() + 1);

  // If day rolled over (e.g., Jan 31 jumped to March 2/3), clip to the last day of target month
  if (result.getUTCDate() !== originalDay) {
    result.setUTCDate(0); // Day 0 of next month is the last day of target month
  }

  return result;
}

/**
 * Calculates start and end timestamps for a subscription renewal according to canonical rules.
 */
export function calculateNextBillingPeriod(
  currentPeriodEndsAt: Date | string | null | undefined,
  referenceDate: Date = new Date()
): { startsAt: Date; endsAt: Date } {
  let startsAt: Date;

  if (currentPeriodEndsAt) {
    const parsedEndsAt = typeof currentPeriodEndsAt === 'string' ? new Date(currentPeriodEndsAt) : currentPeriodEndsAt;
    if (!isNaN(parsedEndsAt.getTime()) && parsedEndsAt > referenceDate) {
      startsAt = parsedEndsAt;
    } else {
      startsAt = referenceDate;
    }
  } else {
    startsAt = referenceDate;
  }

  const endsAt = addCalendarMonth(startsAt);

  return { startsAt, endsAt };
}
