/**
 * Helper utility to conditionally join classNames cleanly.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
