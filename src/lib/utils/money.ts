/**
 * Deterministic Money Parser Utility for 2-Decimal Currencies (MVP)
 * Converts price string to integer minor-units (cents) without floating-point arithmetic.
 */

/**
 * Parses a price string into integer minor units (cents).
 * Examples:
 *   "12.50" -> 1250
 *   "12.5"  -> 1250
 *   "12"    -> 1200
 *   "0.05"  -> 5
 *   "0.5"   -> 50
 */
export function parseDecimalToMinorUnits(value: string | number): number {
  if (typeof value === 'number') {
    value = value.toString();
  }

  const trimmed = value.trim();
  if (!trimmed) return 0;

  // Validate format (digits optionally followed by dot and up to 2 decimal digits)
  const regex = /^\d+(\.\d{1,2})?$/;
  if (!regex.test(trimmed)) {
    throw new Error(`Invalid price format: "${trimmed}". Price must be a valid positive number with up to 2 decimal places.`);
  }

  const parts = trimmed.split('.');
  const majorPart = parseInt(parts[0], 10);
  let minorPart = 0;

  if (parts.length > 1) {
    const minorStr = parts[1].padEnd(2, '0');
    minorPart = parseInt(minorStr.substring(0, 2), 10);
  }

  return majorPart * 100 + minorPart;
}

/**
 * Formats minor-unit integer (cents) to a formatted decimal string (e.g. 1250 -> "12.50").
 */
export function formatMinorUnitsToDecimal(cents: number): string {
  if (isNaN(cents) || cents < 0) return '0.00';
  const major = Math.floor(cents / 100);
  const minor = (cents % 100).toString().padStart(2, '0');
  return `${major}.${minor}`;
}
